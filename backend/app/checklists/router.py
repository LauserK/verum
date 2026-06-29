from fastapi import APIRouter, Depends, HTTPException, Header
from typing import List, Optional, Dict
from datetime import datetime, timezone
import pytz
from uuid import UUID
from decimal import Decimal

from database import get_db
from auth_deps import security, get_current_user
from app.deps import get_active_org_id, require_permission
from permissions import resolve_permission

from app.checklists.schemas import (
    ChecklistItem, CreateSubmissionRequest, SubmissionQuestion, SubmissionDetail, PatchSubmissionRequest, HistoryItem, BulkAnswersRequest
)
from app.checklists.utils import get_current_shift, get_user_shift_identifier, CARACAS_TZ
from app.admin.schemas import CreateTemplateRequest, CreateQuestionRequest, ReorderQuestionsRequest

router = APIRouter(prefix="", tags=["Checklists"])


@router.get("/checklists/library/{venue_id}")
async def get_library_templates(venue_id: str, user=Depends(require_permission("checklists.view"))):
    """Returns all on_demand templates for a venue."""
    try:
        db = get_db()
        # Permission check logic
        venue_res = db.table("venues").select("org_id").eq("id", venue_id).execute()
        if not venue_res.data:
            raise HTTPException(404, "Sede no encontrada")
        v_org_id = venue_res.data[0]["org_id"]
        
        is_org_admin = await resolve_permission(user.id, "admin.view_dashboard", db, org_id=v_org_id)
        if not is_org_admin:
            pv_check = db.table("profile_venues").select("venue_id").eq("profile_id", user.id).eq("venue_id", venue_id).execute()
            if not pv_check.data:
                 raise HTTPException(403, "No tienes acceso a esta sede")

        templates_res = (
            db.table("checklist_templates")
            .select("id, title, description, frequency")
            .eq("venue_id", venue_id)
            .eq("frequency", "on_demand")
            .execute()
        )
        return templates_res.data or []
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/checklists/{venue_id}", response_model=list[ChecklistItem])
async def get_checklists(venue_id: str, user=Depends(require_permission("checklists.view"))):
    """
    Returns checklist templates for a venue with their computed status
    for the current shift. Handles prerequisite locking.
    """
    try:
        db = get_db()
        
        # Security: Verify user belongs to this venue OR is admin of the organization
        # 1. Get venue's organization
        venue_res = db.table("venues").select("org_id").eq("id", venue_id).execute()
        if not venue_res.data:
            raise HTTPException(404, "Sede no encontrada")
        v_org_id = venue_res.data[0]["org_id"]

        # 2. Check if user is Admin of this org OR Super Admin (resolve_permission handles Super Admin bypass)
        is_org_admin = await resolve_permission(user.id, "admin.view_dashboard", db, org_id=v_org_id)
        
        if not is_org_admin:
            # If not admin, must be assigned to venue via profile_venues
            pv_check = db.table("profile_venues").select("venue_id").eq("profile_id", user.id).eq("venue_id", venue_id).execute()
            if not pv_check.data:
                 raise HTTPException(status_code=403, detail="No tienes acceso a esta sede")

        shift = await get_user_shift_identifier(user.id, venue_id, db)
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")

        # 1. Get all templates for this venue
        templates_res = (
            db.table("checklist_templates")
            .select("*")
            .eq("venue_id", venue_id)
            .execute()
        )
        templates = templates_res.data or []

        if not templates:
            return []

        template_ids = [t["id"] for t in templates]

        # 2. Get question counts per template
        questions_res = (
            db.table("questions")
            .select("id, template_id")
            .in_("template_id", template_ids)
            .execute()
        )
        questions_by_template: dict[str, int] = {}
        for q in (questions_res.data or []):
            tid = q["template_id"]
            questions_by_template[tid] = questions_by_template.get(tid, 0) + 1

        # 3. Get today's submissions OR active submissions for the current venue
        submissions_res = (
            db.table("submissions")
            .select("*")
            .eq("venue_id", venue_id)
            .in_("template_id", template_ids)
            .execute()
        )
        all_venue_submissions = submissions_res.data or []
        all_today_submissions = [s for s in all_venue_submissions if s["created_at"].startswith(today) or s["status"] != "completed"]
        
        # 4. Map submissions to templates
        submissions_map: dict = {}
        for s in all_today_submissions:
            tid = s["template_id"]
            tmpl = next((t for t in templates if t["id"] == tid), None)
            freq = tmpl.get("frequency") if tmpl else "daily"
            
            if freq == "on_demand" and s.get("is_private") and s.get("user_id") != user.id:
                continue
                
            if tid not in submissions_map:
                submissions_map[tid] = []
                
            if freq == "shift":
                if s["shift"] == shift:
                    submissions_map[tid].append(s)
            elif freq == "on_demand":
                if s["status"] != "completed" or s["created_at"].startswith(today):
                    submissions_map[tid].append(s)
            else:
                existing = submissions_map[tid][0] if submissions_map[tid] else None
                if not existing or s["status"] == "completed" or (s["status"] == "in_progress" and existing["status"] == "draft"):
                    submissions_map[tid] = [s]

        # 5. Get answer counts
        submission_ids = []
        for subs in submissions_map.values():
            submission_ids.extend([s["id"] for s in subs])
            
        answers_counts: dict = {}
        if submission_ids:
            answers_res = (
                db.table("answers")
                .select("submission_id")
                .in_("submission_id", submission_ids)
                .execute()
            )
            for a in (answers_res.data or []):
                sid = a["submission_id"]
                answers_counts[sid] = answers_counts.get(sid, 0) + 1

        # Build a set of completed template IDs (for prerequisite logic)
        completed_ids = {
            tid for tid, subs in submissions_map.items()
            if any(sub.get("status") == "completed" for sub in subs)
        }

        # 6. Build response
        day_of_week = (datetime.now(CARACAS_TZ).weekday() + 1) % 7
        result: list[dict] = []
        
        for t in templates:
            tid = t["id"]
            freq = t.get("frequency")
            
            # If on_demand and no active submissions, it only lives in the library
            if freq == "on_demand" and not submissions_map.get(tid):
                continue
                
            tmpl_due_date = t.get("due_date")
            if tmpl_due_date and tmpl_due_date != today:
                continue
                
            sched = t.get("schedule") or []
            if freq == "weekly" and sched and day_of_week not in sched:
                continue
            elif freq == "custom" and sched and day_of_week not in sched:
                continue

            total_q = questions_by_template.get(tid, 0)
            subs = submissions_map.get(tid, [])
            
            tmpl_available_time = t.get("available_from_time")
            is_time_locked = False
            if tmpl_available_time:
                now_str = datetime.now(CARACAS_TZ).strftime("%H:%M:%S")
                if str(now_str) < str(tmpl_available_time):
                    is_time_locked = True
                    
            prereq = t.get("prerequisite_template_id")
            
            if not subs:
                status_val = "pending"
                if prereq and prereq not in completed_ids:
                    status_val = "locked"
                elif is_time_locked:
                    status_val = "locked"
                    
                result.append({
                    "id": tid,
                    "title": t["title"],
                    "description": t.get("description"),
                    "frequency": freq,
                    "due_date": tmpl_due_date,
                    "due_time": t.get("due_time"),
                    "available_from_time": tmpl_available_time,
                    "prerequisite_template_id": prereq,
                    "status": status_val,
                    "total_questions": total_q,
                    "answered_questions": 0,
                    "submission_id": None,
                    "custom_title": None,
                    "is_private": False
                })
            else:
                for sub in subs:
                    status_val = "pending"
                    answered = 0
                    
                    if sub["status"] == "completed":
                        status_val = "completed"
                        answered = total_q
                    else:
                        status_val = "in_progress"
                        answered = answers_counts.get(sub["id"], 0)
                        
                        # Apply locks only if not started
                        if answered == 0 and sub["status"] == "draft":
                            if prereq and prereq not in completed_ids:
                                status_val = "locked"
                            elif is_time_locked:
                                status_val = "locked"
                                
                    result.append({
                        "id": tid,
                        "title": t["title"],
                        "description": t.get("description"),
                        "frequency": freq,
                        "due_date": tmpl_due_date,
                        "due_time": t.get("due_time"),
                        "available_from_time": tmpl_available_time,
                        "prerequisite_template_id": prereq,
                        "status": status_val,
                        "total_questions": total_q,
                        "answered_questions": answered,
                        "submission_id": sub["id"],
                        "custom_title": sub.get("custom_title"),
                        "is_private": sub.get("is_private", False)
                    })

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Staff History ────────────────────────────────────────

@router.get("/submissions/history", response_model=list[HistoryItem])
async def get_submission_history(user=Depends(require_permission("checklists.view"))):
    """
    Returns the current user's completed submissions, ordered by most recent.
    Only shows submissions belonging to the authenticated user.
    """
    try:
        db = get_db()
        # Get completed submissions for this user only
        subs_res = (
            db.table("submissions")
            .select("id, template_id, venue_id, shift, status, started_at, completed_at")
            .eq("user_id", user.id)
            .eq("status", "completed")
            .order("completed_at", desc=True)
            .limit(50)
            .execute()
        )
        submissions = subs_res.data or []

        if not submissions:
            return []

        # Collect unique template_ids and venue_ids
        template_ids = list(set(s["template_id"] for s in submissions))
        venue_ids = list(set(s["venue_id"] for s in submissions if s.get("venue_id")))

        # Fetch template titles
        tmpl_res = (
            db.table("checklist_templates")
            .select("id, title")
            .in_("id", template_ids)
            .execute()
        )
        tmpl_map = {t["id"]: t["title"] for t in (tmpl_res.data or [])}

        # Fetch question counts per template
        q_res = (
            db.table("questions")
            .select("id, template_id")
            .in_("template_id", template_ids)
            .execute()
        )
        q_counts: dict[str, int] = {}
        for q in (q_res.data or []):
            tid = q["template_id"]
            q_counts[tid] = q_counts.get(tid, 0) + 1

        # Fetch venue names
        venue_map: dict[str, str] = {}
        if venue_ids:
            v_res = (
                db.table("venues")
                .select("id, name")
                .in_("id", venue_ids)
                .execute()
            )
            venue_map = {v["id"]: v["name"] for v in (v_res.data or [])}

        # Fetch shift names
        shift_ids = list(set(s["shift"] for s in submissions if len(s["shift"]) > 10)) # Simple UUID check
        shift_map: dict[str, str] = {}
        if shift_ids:
            s_res = (
                db.table("shifts")
                .select("id, name")
                .in_("id", shift_ids)
                .execute()
            )
            shift_map = {sh["id"]: sh["name"] for sh in (s_res.data or [])}

        # Build result
        result = []
        for s in submissions:
            result.append({
                "id": s["id"],
                "template_title": tmpl_map.get(s["template_id"], "Untitled"),
                "shift": shift_map.get(s["shift"], s["shift"]),
                "completed_at": s.get("completed_at", s.get("created_at", "")),
                "total_questions": q_counts.get(s["template_id"], 0),
                "venue_name": venue_map.get(s.get("venue_id", ""), None),
                "started_at": s.get("started_at"),
            })

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submissions")
async def create_submission(body: CreateSubmissionRequest, user=Depends(require_permission("checklists.execute"))):
    """
    Creates a draft submission when opening a checklist.
    Idempotent: returns existing submission (draft or completed) if one
    already exists for the same user/template/shift/today.
    """
    try:
        db = get_db()
        
        # Security: Verify user belongs to this venue
        pv_check = db.table("profile_venues").select("venue_id").eq("profile_id", user.id).eq("venue_id", body.venue_id).execute()
        if not pv_check.data:
             raise HTTPException(status_code=403, detail="No tienes acceso a esta sede")

        shift = await get_user_shift_identifier(user.id, body.venue_id, db)
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")

        # Get template frequency
        tmpl_res = db.table("checklist_templates").select("frequency").eq("id", body.template_id).single().execute()
        freq = tmpl_res.data.get("frequency", "daily") if tmpl_res.data else "daily"

        # Check for ANY existing submission today (completed or draft)
        query = (
            db.table("submissions")
            .select("*")
            .eq("template_id", body.template_id)
            .eq("venue_id", body.venue_id)
            .gte("created_at", f"{today}T00:00:00-04:00")
        )
        
        if freq == "shift":
            query = query.eq("shift", shift)
            
        # Bypass idempotency for on_demand to allow multiple instances
        if freq != "on_demand":
            existing = query.order("created_at", desc=True).limit(1).execute()
            if existing.data and len(existing.data) > 0:
                return existing.data[0]

        # Create new draft only if no submission exists
        new_sub = {
            "template_id": body.template_id,
            "user_id": user.id,
            "venue_id": body.venue_id,
            "shift": shift,
            "status": "draft",
            "custom_title": body.custom_title,
            "is_private": body.is_private
        }
        result = db.table("submissions").insert(new_sub).execute()
        return result.data[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submissions/{submission_id}", response_model=SubmissionDetail)
async def get_submission(submission_id: str, user=Depends(get_current_user)):
    """
    Returns a submission with its questions and any existing answers.
    Security: Only owner or users with 'checklists.view_all' can see the submission.
    """
    try:
        db = get_db()
        # Get submission
        sub_res = (
            db.table("submissions")
            .select("*")
            .eq("id", submission_id)
            .execute()
        )
        if not sub_res.data or len(sub_res.data) == 0:
            raise HTTPException(status_code=404, detail="Submission not found")

        sub = sub_res.data[0]

        # --- PERMISSION CHECK ---
        is_owner = sub["user_id"] == user.id
        can_access = is_owner

        if not is_owner:
            # Check if user has view_all
            can_view_all = await resolve_permission(user.id, "checklists.view_all", db)
            if can_view_all:
                can_access = True
            else:
                # COLLABORATIVE CHECKLIVES: allow if same venue, same shift (or same day if not shift-based), and it's a draft
                # Check if user is assigned to the venue of this submission
                pv_check = db.table("profile_venues").select("venue_id").eq("profile_id", user.id).eq("venue_id", sub["venue_id"]).execute()
                is_assigned_to_venue = bool(pv_check.data)
                
                # Get template frequency to check if we should enforce shift match
                t_res = db.table("checklist_templates").select("frequency").eq("id", sub["template_id"]).single().execute()
                t_freq = t_res.data.get("frequency", "daily") if t_res.data else "daily"

                is_valid_window = True
                if t_freq == "shift":
                    user_shift = await get_user_shift_identifier(user.id, sub["venue_id"], db)
                    is_valid_window = sub["shift"] == user_shift
                
                if sub["status"] == "draft" and is_assigned_to_venue and is_valid_window:
                    # User must at least have checklists.view
                    can_view = await resolve_permission(user.id, "checklists.view", db)
                    if can_view:
                        can_access = True

        if not can_access:
            raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to access this submission")

        # Get template info
        tmpl_res = (
            db.table("checklist_templates")
            .select("title")
            .eq("id", sub["template_id"])
            .execute()
        )
        template_title = tmpl_res.data[0]["title"] if tmpl_res.data else "Checklist"

        # Get questions ordered by sort_order
        questions_res = (
            db.table("questions")
            .select("*")
            .eq("template_id", sub["template_id"])
            .order("sort_order")
            .execute()
        )
        questions = questions_res.data or []

        # Get existing answers
        answers_res = (
            db.table("answers")
            .select("question_id, value, answered_at")
            .eq("submission_id", submission_id)
            .execute()
        )
        answers_map = {a["question_id"]: {"value": a["value"], "answered_at": a["answered_at"]} for a in (answers_res.data or [])}

        # Merge questions with answers
        merged = []
        for q in questions:
            ans_data = answers_map.get(q["id"], {})
            merged.append({
                "id": q["id"],
                "label": q["label"],
                "type": q["type"],
                "is_required": q.get("is_required", True),
                "config": q.get("config"),
                "sort_order": q.get("sort_order", 0),
                "answer": ans_data.get("value"),
                "answered_at": ans_data.get("answered_at"),
            })

        return {
            "id": sub["id"],
            "template_id": sub["template_id"],
            "template_title": template_title,
            "status": sub["status"],
            "shift": sub["shift"],
            "questions": merged,
            "auditor_notes": sub.get("auditor_notes"),
            "auditor_confirmed": sub.get("auditor_confirmed", False),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/submissions/{submission_id}")
async def patch_submission(
    submission_id: str,
    body: PatchSubmissionRequest,
    user=Depends(require_permission("checklists.execute")),
):
    """
    Updates submission fields: status, auditor_notes, auditor_confirmed, answers.
    When status='completed', sets completed_at.
    """
    try:
        db = get_db()
        # Save answers if provided
        if body.answers:
            now_iso = datetime.now(timezone.utc).isoformat()
            for ans in body.answers:
                db.table("answers").upsert(
                    {
                        "submission_id": submission_id,
                        "question_id": ans["question_id"],
                        "value": ans.get("value", ""),
                        "answered_at": now_iso
                    },
                    on_conflict="submission_id,question_id",
                ).execute()

        # Build update payload
        update: dict = {}
        if body.auditor_notes is not None:
            update["auditor_notes"] = body.auditor_notes
        if body.auditor_confirmed is not None:
            update["auditor_confirmed"] = body.auditor_confirmed
        if body.status is not None:
            update["status"] = body.status
            if body.status == "completed":
                update["completed_at"] = datetime.now(timezone.utc).isoformat()

        if update:
            db.table("submissions").update(update).eq("id", submission_id).execute()

        return {"ok": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/submissions/{submission_id}/answers")
async def bulk_save_answers(
    submission_id: str,
    body: BulkAnswersRequest,
    user=Depends(require_permission("checklists.execute")),
):
    """
    Bulk upsert answers for auto-save. Updates last_saved_at.
    Sets started_at on first save.
    """
    try:
        db = get_db()
        # Upsert all answers
        for ans in body.answers:
            upsert_data = {
                "submission_id": submission_id,
                "question_id": ans["question_id"],
                "value": ans.get("value", ""),
            }
            if "answered_at" in ans:
                upsert_data["answered_at"] = ans["answered_at"]

            db.table("answers").upsert(
                upsert_data,
                on_conflict="submission_id,question_id",
            ).execute()

        # Update last_saved_at + set started_at if first save
        now_iso = datetime.now(timezone.utc).isoformat()

        sub_res = (
            db.table("submissions")
            .select("started_at")
            .eq("id", submission_id)
            .execute()
        )
        update_payload: dict = {"last_saved_at": now_iso}
        if sub_res.data and sub_res.data[0].get("started_at") is None:
            update_payload["started_at"] = now_iso

        db.table("submissions").update(update_payload).eq("id", submission_id).execute()

        return {"ok": True, "saved": len(body.answers)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Public: Shifts for a venue (staff) ──────────────────

@router.get("/venues/{venue_id}/shifts")
async def get_venue_shifts(venue_id: str, user=Depends(require_permission("checklists.view"))):
    db = get_db()
    res = db.table("shifts").select("*").eq("venue_id", venue_id).order("sort_order").execute()
    return res.data or []


@router.get("/admin/venues/{venue_id}/templates")
async def list_templates(venue_id: str, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    res = (
        db.table("checklist_templates")
        .select("*")
        .eq("venue_id", venue_id)
        .execute()
    )
    return res.data or []


@router.post("/admin/templates")
async def create_template(body: CreateTemplateRequest, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    payload = {
        "venue_id": body.venue_id,
        "title": body.title,
    }
    if body.description:
        payload["description"] = body.description
    if body.frequency:
        payload["frequency"] = body.frequency
    if body.due_date:
        payload["due_date"] = body.due_date
    if body.due_time:
        payload["due_time"] = body.due_time
    if body.available_from_time:
        payload["available_from_time"] = body.available_from_time
    if body.schedule:
        payload["schedule"] = body.schedule
    if body.prerequisite_template_id:
        payload["prerequisite_template_id"] = body.prerequisite_template_id

    res = db.table("checklist_templates").insert(payload).execute()
    return res.data[0]


@router.put("/admin/templates/{template_id}")
async def update_template(template_id: str, body: CreateTemplateRequest, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    payload = {
        "venue_id": body.venue_id,
        "title": body.title,
    }
    if body.description is not None:
        payload["description"] = body.description
    if body.frequency is not None:
        payload["frequency"] = body.frequency
    if body.due_date is not None:
        payload["due_date"] = body.due_date
    if body.due_time is not None:
        payload["due_time"] = body.due_time
    if body.available_from_time is not None:
        payload["available_from_time"] = body.available_from_time
    if body.schedule is not None:
        payload["schedule"] = body.schedule
    if body.prerequisite_template_id is not None:
        payload["prerequisite_template_id"] = body.prerequisite_template_id

    res = db.table("checklist_templates").update(payload).eq("id", template_id).execute()
    return res.data[0] if res.data else {"ok": True}


@router.delete("/admin/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    db.table("checklist_templates").delete().eq("id", template_id).execute()
    return {"ok": True}


@router.get("/admin/templates/{template_id}/questions")
async def list_questions(template_id: str, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    res = (
        db.table("questions")
        .select("*")
        .eq("template_id", template_id)
        .order("sort_order")
        .execute()
    )
    return res.data or []


@router.post("/admin/questions")
async def create_question(body: CreateQuestionRequest, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    payload = {
        "template_id": body.template_id,
        "label": body.label,
        "type": body.type,
        "is_required": body.is_required,
        "sort_order": body.sort_order,
    }
    if body.config:
        payload["config"] = body.config
    res = db.table("questions").insert(payload).execute()
    return res.data[0]


@router.put("/admin/questions/{question_id}")
async def update_question(question_id: str, body: CreateQuestionRequest, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    payload = {
        "label": body.label,
        "type": body.type,
        "is_required": body.is_required,
        "sort_order": body.sort_order,
    }
    if body.config is not None:
        payload["config"] = body.config
    res = db.table("questions").update(payload).eq("id", question_id).execute()
    return res.data[0] if res.data else {"ok": True}


@router.put("/admin/templates/{template_id}/questions/reorder")
async def reorder_questions(template_id: str, body: ReorderQuestionsRequest, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    for item in body.questions:
        db.table("questions").update({"sort_order": item.sort_order}).eq("id", item.id).execute()
    return {"ok": True}


@router.delete("/admin/questions/{question_id}")
async def delete_question(question_id: str, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    db.table("questions").delete().eq("id", question_id).execute()
    return {"ok": True}
