from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
import pytz
from datetime import datetime, timezone, timedelta
import io
import csv
from pydantic import BaseModel
from typing import Optional, List

CARACAS_TZ = pytz.timezone("America/Caracas")

from database import supabase, get_db
from config import settings

app = FastAPI(title="VERUM API")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001","https://verum-eta.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# ── Helpers ──────────────────────────────────────────────

def get_current_shift() -> str:
    """Returns the current shift based on local hour."""
    hour = datetime.now(CARACAS_TZ).hour
    if 6 <= hour < 14:
        return "morning"
    elif 14 <= hour < 20:
        return "mid"
    else:
        return "closing"


async def get_user_shift_identifier(user_id: str, db) -> str:
    """
    Retorna el shift_id del usuario si existe.
    De lo contrario lanza un error 403.
    """
    res = db.table("profiles").select("shift_id").eq("id", user_id).single().execute()
    shift_id = res.data.get("shift_id")
    if not shift_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="no_shift_assigned"
        )
    return str(shift_id)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        res = supabase.auth.get_user(token)
        if res and res.user:
            return res.user
        else:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


from permissions import resolve_permission


from permissions import resolve_permission, check_restriction
from attendance_utils import is_clocked_in

def require_permission(permission_key: str):
    async def _check(current_user=Depends(get_current_user), db=Depends(get_db)):
        # profile_id is current_user.id in Supabase Auth
        profile_id = current_user.id
        
        # 1. Check if user is forced to clock-in before other actions
        # Exclude attendance and admin modules to prevent circular block or blocking admins
        is_attendance_action = permission_key.startswith("attendance.")
        is_admin_action = permission_key.startswith("admin.")
        
        if not is_attendance_action and not is_admin_action:
            # We use check_restriction to ignore the admin bypass here
            # because force_clock_in is a restriction, not a capability.
            force_check = await check_restriction(profile_id, "attendance.force_clock_in", db)
            if force_check:
                clocked_in = await is_clocked_in(profile_id, db)
                if not clocked_in:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={"detail": "CLOCK_IN_REQUIRED", "required": "attendance.mark"}
                    )

        # 2. Standard permission check
        has_perm = await resolve_permission(profile_id, permission_key, db)
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "missing_permission", "required": permission_key},
            )
        return current_user

    return _check


# ── Models ───────────────────────────────────────────────

class SyncResponse(BaseModel):
    id: str
    role: str


class VenueInfo(BaseModel):
    id: str
    name: str


class ProfileResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    role: str
    organization_id: Optional[str] = None
    venues: list[VenueInfo] = []
    venue_id: Optional[str] = None
    shift_id: Optional[str] = None
    shift_name: Optional[str] = None


class ChecklistItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    frequency: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    available_from_time: Optional[str] = None
    prerequisite_template_id: Optional[str] = None
    status: str  # completed | in_progress | pending | locked
    total_questions: int
    answered_questions: int
    submission_id: Optional[str] = None


class CreateSubmissionRequest(BaseModel):
    template_id: str
    venue_id: str


class SubmissionQuestion(BaseModel):
    id: str
    label: str
    type: str
    is_required: bool
    config: Optional[dict] = None
    sort_order: int
    answer: Optional[str] = None
    answered_at: Optional[str] = None


class SubmissionDetail(BaseModel):
    id: str
    template_id: str
    template_title: str
    status: str
    shift: str
    questions: list[SubmissionQuestion]
    auditor_notes: Optional[str] = None
    auditor_confirmed: bool = False


class PatchSubmissionRequest(BaseModel):
    status: Optional[str] = None
    auditor_notes: Optional[str] = None
    auditor_confirmed: Optional[bool] = None
    answers: Optional[list[dict]] = None  # [{question_id, value}]


# ── Routes ───────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"message": "VERUM API is running"}


@app.post("/auth/sync", response_model=SyncResponse)
async def sync_user(user=Depends(get_current_user)):
    """Syncs the Supabase Auth user into public.profiles with default staff role."""
    try:
        db = get_db()
        existing = db.table("profiles").select("*").eq("id", user.id).execute()

        if existing.data and len(existing.data) > 0:
            return {"id": user.id, "role": existing.data[0].get("role")}

        new_profile = {
            "id": user.id,
            "role": "staff",
            "full_name": user.user_metadata.get("full_name", user.email) if user else "",
        }
        db.table("profiles").insert(new_profile).execute()

        return {"id": user.id, "role": "staff"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/me", response_model=ProfileResponse)
async def get_profile(user=Depends(get_current_user)):
    """Returns the authenticated user's profile with their venues."""
    try:
        db = get_db()
        result = db.table("profiles").select("*").eq("id", user.id).execute()
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        profile = result.data[0]
        org_id = profile.get("organization_id")

        # Fetch venues for the user's organization
        venues = []
        if org_id:
            venues_res = (
                db.table("venues")
                .select("id, name")
                .eq("org_id", org_id)
                .execute()
            )
            venues = venues_res.data or []

        # Fetch shift name if shift_id is present
        shift_name = None
        shift_id = profile.get("shift_id")
        if shift_id:
            shift_res = db.table("shifts").select("name").eq("id", shift_id).execute()
            if shift_res.data and len(shift_res.data) > 0:
                shift_name = shift_res.data[0].get("name")

        return {
            "id": profile["id"],
            "full_name": profile.get("full_name"),
            "role": profile.get("role", "staff"),
            "organization_id": org_id,
            "venues": venues,
            "venue_id": profile.get("venue_id"),
            "shift_id": shift_id,
            "shift_name": shift_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/checklists/{venue_id}", response_model=list[ChecklistItem])
async def get_checklists(venue_id: str, user=Depends(require_permission("checklists.view"))):
    """
    Returns checklist templates for a venue with their computed status
    for the current shift. Handles prerequisite locking.
    """
    try:
        db = get_db()
        shift = await get_user_shift_identifier(user.id, db)
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

        # 3. Get today's submissions for the current venue (all shifts, all users)
        submissions_res = (
            db.table("submissions")
            .select("*")
            .eq("venue_id", venue_id)
            .gte("created_at", f"{today}T00:00:00-04:00")
            .in_("template_id", template_ids)
            .execute()
        )
        all_today_submissions = submissions_res.data or []
        
        # 4. Map submissions to templates based on frequency
        # For 'shift' frequency, we only care about the current shift.
        # For others (daily, weekly, etc.), any submission today counts.
        submissions_map: dict = {}
        for s in all_today_submissions:
            tid = s["template_id"]
            # If we already have a 'completed' one for this template, keep it
            if submissions_map.get(tid, {}).get("status") == "completed":
                continue
            
            # Find the template to check its frequency
            tmpl = next((t for t in templates if t["id"] == tid), None)
            freq = tmpl.get("frequency") if tmpl else "daily"
            
            if freq == "shift":
                # Only map if it's the current shift
                if s["shift"] == shift:
                    submissions_map[tid] = s
            else:
                # For non-shift checklists, any submission today counts.
                # Prioritize completed or in_progress over draft if multiple exist.
                existing = submissions_map.get(tid)
                if not existing or s["status"] == "completed" or (s["status"] == "in_progress" and existing["status"] == "draft"):
                    submissions_map[tid] = s

        # 5. Get answer counts for these matched submissions
        submission_ids = [s["id"] for s in submissions_map.values()]
        answers_counts: dict[str, int] = {}
        
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

        # 5. Build a set of completed template IDs (for prerequisite logic)
        completed_ids = {
            tid for tid, sub in submissions_map.items()
            if sub.get("status") == "completed"
        }

        # 6. Build response with status calculation
        # Database 0=Sun, 1=Mon, ..., 6=Sat. Python weekday() is 0=Mon, 6=Sun.
        day_of_week = (datetime.now(CARACAS_TZ).weekday() + 1) % 7
        
        result: list[dict] = []
        for t in templates:
            # If due_date is set, only show the checklist on that specific date
            tmpl_due_date = t.get("due_date")
            if tmpl_due_date and tmpl_due_date != today:
                continue
            
            # If frequency is weekly/monthly/custom, check the schedule
            freq = t.get("frequency")
            sched = t.get("schedule") or []
            if freq == "weekly" and sched:
                if day_of_week not in sched:
                    continue
            elif freq == "custom" and sched:
                if day_of_week not in sched:
                    continue
            # Note: monthly logic is a bit more complex, for now we skip filtering here 
            # to avoid accidental hiding, as get_compliance handles it for reports.

            tid = t["id"]
            total_q = questions_by_template.get(tid, 0)
            sub = submissions_map.get(tid)

            # Check available_from_time logic
            tmpl_available_time = t.get("available_from_time")
            is_time_locked = False
            if tmpl_available_time:
                # Get current time in same format (assuming local HH:MM, but typically server is UTC. 
                # Be careful: Verum frontend/backend might expect local time or UTC. Currently dashboard uses `get_current_shift()` logic.
                # Let's use UTC HH:MM for now as that's what we have)
                now_str = datetime.now(CARACAS_TZ).strftime("%H:%M:%S")
                # Ensure tmpl_available_time is string
                if str(now_str) < str(tmpl_available_time):
                    is_time_locked = True

            # Determine status
            prereq = t.get("prerequisite_template_id")
            if prereq and prereq not in completed_ids:
                status_val = "locked"
                answered = 0
                sub_id = None
            elif is_time_locked and not sub:
                status_val = "locked"
                answered = 0
                sub_id = None
            elif sub:
                if sub["status"] == "completed":
                    status_val = "completed"
                    answered = total_q
                else:
                    status_val = "in_progress"
                    answered = answers_counts.get(sub["id"], 0)
                sub_id = sub["id"]
            else:
                status_val = "pending"
                answered = 0
                sub_id = None

            result.append({
                "id": tid,
                "title": t["title"],
                "description": t.get("description"),
                "frequency": t.get("frequency"),
                "due_date": tmpl_due_date,
                "due_time": t.get("due_time"),
                "available_from_time": t.get("available_from_time"),
                "prerequisite_template_id": prereq,
                "status": status_val,
                "total_questions": total_q,
                "answered_questions": answered,
                "submission_id": sub_id,
            })

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Staff History ────────────────────────────────────────

class HistoryItem(BaseModel):
    id: str
    template_title: str
    shift: str
    completed_at: str
    total_questions: int
    venue_name: Optional[str] = None
    started_at: Optional[str] = None


@app.get("/submissions/history", response_model=list[HistoryItem])
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


@app.post("/submissions")
async def create_submission(body: CreateSubmissionRequest, user=Depends(require_permission("checklists.execute"))):
    """
    Creates a draft submission when opening a checklist.
    Idempotent: returns existing submission (draft or completed) if one
    already exists for the same user/template/shift/today.
    """
    try:
        db = get_db()
        shift = await get_user_shift_identifier(user.id, db)
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
        }
        result = db.table("submissions").insert(new_sub).execute()
        return result.data[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/submissions/{submission_id}", response_model=SubmissionDetail)
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
                # First get current user's venue
                prof_res = db.table("profiles").select("venue_id").eq("id", user.id).single().execute()
                user_venue_id = prof_res.data.get("venue_id") if prof_res.data else None
                
                # Get template frequency to check if we should enforce shift match
                t_res = db.table("checklist_templates").select("frequency").eq("id", sub["template_id"]).single().execute()
                t_freq = t_res.data.get("frequency", "daily") if t_res.data else "daily"

                is_same_venue = str(sub["venue_id"]) == str(user_venue_id)
                is_valid_window = True
                if t_freq == "shift":
                    user_shift = await get_user_shift_identifier(user.id, db)
                    is_valid_window = sub["shift"] == user_shift
                
                if sub["status"] == "draft" and is_same_venue and is_valid_window:
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


@app.patch("/submissions/{submission_id}")
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


class BulkAnswersRequest(BaseModel):
    answers: list[dict]  # [{question_id, value, answered_at}]


@app.put("/submissions/{submission_id}/answers")
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



# ── Admin Models ─────────────────────────────────────────

class CreateOrgRequest(BaseModel):
    name: str


class CreateVenueRequest(BaseModel):
    org_id: str
    name: str
    address: Optional[str] = None


class CreateTemplateRequest(BaseModel):
    venue_id: str
    title: str
    description: Optional[str] = None
    frequency: Optional[str] = None
    due_date: Optional[str] = None  # "YYYY-MM-DD" format
    due_time: Optional[str] = None  # "HH:MM" format
    available_from_time: Optional[str] = None # "HH:MM" format
    schedule: Optional[list[int]] = None  # [0=Sun..6=Sat]
    prerequisite_template_id: Optional[str] = None


class CreateQuestionRequest(BaseModel):
    template_id: str
    label: str
    type: str
    is_required: bool = True
    config: Optional[dict] = None
    sort_order: int = 0


class ReorderItem(BaseModel):
    id: str
    sort_order: int


class ReorderQuestionsRequest(BaseModel):
    questions: list[ReorderItem]


class CreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "staff"  # 'admin' or 'staff'
    organization_id: str
    venue_id: Optional[str] = None
    shift_id: Optional[str] = None


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    venue_id: Optional[str] = None
    shift_id: Optional[str] = None


class UpdateVenueRequest(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None


class CreateShiftRequest(BaseModel):
    venue_id: str
    name: str
    start_time: str  # "HH:MM"
    end_time: str    # "HH:MM"
    sort_order: int = 0


class UpdateShiftRequest(BaseModel):
    name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    sort_order: Optional[int] = None


# ── Admin CRUD Routes ───────────────────────────────────

@app.get("/admin/organizations")
async def list_organizations(user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    res = db.table("organizations").select("*").execute()
    return res.data or []


@app.post("/admin/organizations")
async def create_organization(body: CreateOrgRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    res = db.table("organizations").insert({"name": body.name}).execute()
    return res.data[0]


@app.get("/admin/organizations/{org_id}/venues")
async def list_venues(org_id: str, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    res = db.table("venues").select("*").eq("org_id", org_id).execute()
    return res.data or []


@app.post("/admin/venues")
async def create_venue(body: CreateVenueRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    payload = {"org_id": body.org_id, "name": body.name}
    if body.address:
        payload["address"] = body.address
    res = db.table("venues").insert(payload).execute()
    return res.data[0]


@app.put("/admin/venues/{venue_id}")
async def update_venue(venue_id: str, body: UpdateVenueRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    payload = {}
    if body.name is not None:
        payload["name"] = body.name
    if body.address is not None:
        payload["address"] = body.address
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("venues").update(payload).eq("id", venue_id).execute()
    return res.data[0] if res.data else {}


@app.delete("/admin/venues/{venue_id}")
async def delete_venue(venue_id: str, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    db.table("venues").delete().eq("id", venue_id).execute()
    return {"ok": True}


# ── Admin Users CRUD ────────────────────────────────────

@app.get("/admin/users")
async def list_users(user=Depends(require_permission("admin.manage_users"))):
    """List all profiles in the admin's organization."""
    db = get_db()
    admin_profile = db.table("profiles").select("organization_id").eq("id", user.id).single().execute()
    org_id = admin_profile.data.get("organization_id")
    if not org_id:
        return []
    res = db.table("profiles").select("id, full_name, role, organization_id, venue_id, shift_id").eq("organization_id", org_id).execute()
    # Get emails from auth users
    profiles = res.data or []
    for p in profiles:
        try:
            auth_user = db.auth.admin.get_user_by_id(p["id"])
            p["email"] = auth_user.user.email if auth_user.user else None
        except Exception:
            p["email"] = None
    return profiles


@app.post("/admin/users")
async def create_user(body: CreateUserRequest, user=Depends(require_permission("admin.manage_users"))):
    """Create a new user via Supabase Auth admin API + profile."""
    try:
        db = get_db()
        auth_res = db.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
        new_user = auth_res.user
        if not new_user:
            raise HTTPException(500, "Failed to create auth user")

        # Insert profile
        profile_data = {
            "id": new_user.id,
            "full_name": body.full_name,
            "role": body.role,
            "organization_id": body.organization_id,
        }
        if body.venue_id:
            profile_data["venue_id"] = body.venue_id
        if body.shift_id:
            profile_data["shift_id"] = body.shift_id
        db.table("profiles").upsert(profile_data).execute()

        # Handle custom role assignment
        if body.role not in ["staff", "admin"]:
            # Find the role by name in custom_roles
            role_res = db.table("custom_roles").select("id").eq("name", body.role).eq("org_id", body.organization_id).execute()
            if role_res.data:
                role_id = role_res.data[0]["id"]
                db.table("profile_roles").upsert({
                    "profile_id": new_user.id,
                    "role_id": role_id
                }).execute()

        return {"id": new_user.id, "email": body.email, "full_name": body.full_name, "role": body.role, "venue_id": body.venue_id, "shift_id": body.shift_id, "organization_id": body.organization_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@app.put("/admin/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserRequest, user=Depends(require_permission("admin.manage_users"))):
    db = get_db()
    payload = {}
    if body.full_name is not None:
        payload["full_name"] = body.full_name
    if body.role is not None:
        payload["role"] = body.role
    if body.venue_id is not None:
        payload["venue_id"] = body.venue_id
    if body.shift_id is not None:
        payload["shift_id"] = body.shift_id
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("profiles").update(payload).eq("id", user_id).execute()
    return res.data[0] if res.data else {}


@app.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, user=Depends(require_permission("admin.manage_users"))):
    """Delete auth user (cascades to profile)."""
    try:
        db = get_db()
        db.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@app.patch("/admin/users/{user_id}/password")
async def change_user_password(user_id: str, body: dict, user=Depends(require_permission("admin.manage_users"))):
    """Change a user's password via Supabase Auth admin API."""
    db = get_db()
    new_password = body.get("password")
    if not new_password or len(new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    try:
        db.auth.admin.update_user_by_id(user_id, {"password": new_password})
    except Exception as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


# ── Admin Shifts CRUD ───────────────────────────────────

@app.get("/admin/venues/{venue_id}/shifts")
async def list_shifts(venue_id: str, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    res = db.table("shifts").select("*").eq("venue_id", venue_id).order("sort_order").execute()
    return res.data or []


@app.post("/admin/shifts")
async def create_shift(body: CreateShiftRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    payload = {
        "venue_id": body.venue_id,
        "name": body.name,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "sort_order": body.sort_order,
    }
    res = db.table("shifts").insert(payload).execute()
    return res.data[0]


@app.put("/admin/shifts/{shift_id}")
async def update_shift(shift_id: str, body: UpdateShiftRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    payload = {}
    if body.name is not None:
        payload["name"] = body.name
    if body.start_time is not None:
        payload["start_time"] = body.start_time
    if body.end_time is not None:
        payload["end_time"] = body.end_time
    if body.sort_order is not None:
        payload["sort_order"] = body.sort_order
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("shifts").update(payload).eq("id", shift_id).execute()
    return res.data[0] if res.data else {}


@app.delete("/admin/shifts/{shift_id}")
async def delete_shift(shift_id: str, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    db.table("shifts").delete().eq("id", shift_id).execute()
    return {"ok": True}


# ── Public: Shifts for a venue (staff) ──────────────────

@app.get("/venues/{venue_id}/shifts")
async def get_venue_shifts(venue_id: str, user=Depends(require_permission("checklists.view"))):
    db = get_db()
    res = db.table("shifts").select("*").eq("venue_id", venue_id).order("sort_order").execute()
    return res.data or []


@app.get("/admin/venues/{venue_id}/templates")
async def list_templates(venue_id: str, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    res = (
        db.table("checklist_templates")
        .select("*")
        .eq("venue_id", venue_id)
        .execute()
    )
    return res.data or []


@app.post("/admin/templates")
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


@app.put("/admin/templates/{template_id}")
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


@app.delete("/admin/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    db.table("checklist_templates").delete().eq("id", template_id).execute()
    return {"ok": True}


@app.get("/admin/templates/{template_id}/questions")
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


@app.post("/admin/questions")
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


@app.put("/admin/questions/{question_id}")
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


@app.put("/admin/templates/{template_id}/questions/reorder")
async def reorder_questions(template_id: str, body: ReorderQuestionsRequest, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    for item in body.questions:
        db.table("questions").update({"sort_order": item.sort_order}).eq("id", item.id).execute()
    return {"ok": True}


@app.delete("/admin/questions/{question_id}")
async def delete_question(question_id: str, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    db.table("questions").delete().eq("id", question_id).execute()
    return {"ok": True}


# ── Admin Submissions List ──────────────────────────────

@app.get("/admin/submissions")
async def list_submissions(
    venue_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_permission("admin.view_reports")),
):
    """Lists submissions with optional filters."""
    db = get_db()
    query = db.table("submissions").select(
        "*, profiles(full_name), checklist_templates(title), shifts(name), venues(name)"
    )
    if venue_id:
        query = query.eq("venue_id", venue_id)
    if status:
        query = query.eq("status", status)
    if date_from:
        query = query.gte("created_at", f"{date_from}T00:00:00-04:00")
    if date_to:
        query = query.lte("created_at", f"{date_to}T23:59:59-04:00")

    query = query.order("created_at", desc=True).limit(100)
    res = query.execute()
    return res.data or []


# ── Admin Compliance Report ─────────────────────────────

@app.get("/admin/reports/compliance")
async def get_compliance_report(
    venue_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_permission("admin.view_reports")),
):
    """
    Returns compliance metrics:
    - total_expected: templates × days in range
    - completed_on_time, completed_late, missing
    - critical_issues, non_critical_issues
    - avg_execution_minutes
    """
    try:
        db = get_db()
        # Get organization of current admin
        profile_res = db.table("profiles").select("organization_id").eq("id", user.id).single().execute()
        if not profile_res.data:
            raise HTTPException(404, "Profile not found")
        org_id = profile_res.data["organization_id"]

        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
        d_from = date_from or today
        d_to = date_to or today

        # 1. Get all venue IDs for this organization to ensure strict data isolation
        venues_res = db.table("venues").select("id").eq("org_id", org_id).execute()
        org_venue_ids = [v["id"] for v in (venues_res.data or [])]
        
        if not org_venue_ids:
            return {
                "total_expected": 0, "completed_on_time": 0,
                "completed_late": 0, "completed_total": 0,
                "missing": 0, "compliance_pct": 0,
                "critical_issues": 0, "non_critical_issues": 0,
                "avg_execution_minutes": 0,
            }

        # 2. Get templates for this organization (and optionally a specific venue)
        tmpl_query = db.table("checklist_templates").select("id, venue_id, due_time, due_date, frequency, schedule")
        
        if venue_id:
            # Security check: ensure the requested venue belongs to the admin's organization
            if venue_id not in org_venue_ids:
                raise HTTPException(status_code=403, detail="Venue does not belong to your organization")
            tmpl_query = tmpl_query.eq("venue_id", venue_id)
        else:
            tmpl_query = tmpl_query.in_("venue_id", org_venue_ids)
        
        templates = (tmpl_query.execute()).data or []

        if not templates:
            return {
                "total_expected": 0, "completed_on_time": 0,
                "completed_late": 0, "completed_total": 0,
                "missing": 0, "compliance_pct": 0,
                "critical_issues": 0, "non_critical_issues": 0,
                "avg_execution_minutes": 0,
            }

        template_ids = [t["id"] for t in templates]

        # Get submissions in date range
        # Filter by venue_id if provided to be more specific, otherwise by template_ids
        sub_query = (
            db.table("submissions")
            .select("id, template_id, status, started_at, completed_at, created_at, shift")
            .in_("template_id", template_ids)
            .gte("created_at", f"{d_from}T00:00:00-04:00")
            .lte("created_at", f"{d_to}T23:59:59-04:00")
        )
        if venue_id:
            sub_query = sub_query.eq("venue_id", venue_id)
            
        submissions = (sub_query.execute()).data or []

        # Count completed
        completed = [s for s in submissions if s["status"] == "completed"]
        completed_on_time = 0
        completed_late = 0
        total_exec_minutes = 0
        exec_count = 0

        for s in completed:
            # Calculate execution time if started_at exists
            if s.get("started_at") and s.get("completed_at"):
                try:
                    started = datetime.fromisoformat(s["started_at"].replace("Z", "+00:00"))
                    finished = datetime.fromisoformat(s["completed_at"].replace("Z", "+00:00"))
                    diff = (finished - started).total_seconds() / 60
                    total_exec_minutes += diff
                    exec_count += 1
                except (ValueError, TypeError):
                    pass

            # Check if on time based on due_time
            tmpl = next((t for t in templates if t["id"] == s["template_id"]), None)
            if tmpl and tmpl.get("due_time") and s.get("completed_at"):
                try:
                    completed_dt = datetime.fromisoformat(s["completed_at"].replace("Z", "+00:00"))
                    due_parts = tmpl["due_time"].split(":")
                    due_hour, due_min = int(due_parts[0]), int(due_parts[1])
                    if completed_dt.hour < due_hour or (completed_dt.hour == due_hour and completed_dt.minute <= due_min):
                        completed_on_time += 1
                    else:
                        completed_late += 1
                except (ValueError, IndexError):
                    completed_on_time += 1  # default to on-time if can't parse
            else:
                completed_on_time += 1  # no due_time = always on time

        # Get template venues
        venue_ids = list(set([t["venue_id"] for t in templates if t.get("venue_id")]))
        
        # Get shift counts per venue
        shifts_per_venue = {}
        if venue_ids:
            shifts_res = db.table("shifts").select("venue_id").in_("venue_id", venue_ids).execute()
            for s in (shifts_res.data or []):
                vid = s["venue_id"]
                shifts_per_venue[vid] = shifts_per_venue.get(vid, 0) + 1

        # Accurate count based on template frequency and schedule
        from datetime import timedelta
        start_date = datetime.strptime(d_from, "%Y-%m-%d")
        end_date = datetime.strptime(d_to, "%Y-%m-%d")
        num_days = max(1, (end_date - start_date).days + 1)
        
        total_expected = 0
        import calendar
        
        for i in range(num_days):
            curr_date = start_date + timedelta(days=i)
            # Database 0=Sun, 1=Mon, ..., 6=Sat. Python weekday() is 0=Mon, 6=Sun.
            day_of_week = (curr_date.weekday() + 1) % 7
            day_of_month = curr_date.day
            
            for t in templates:
                freq = t.get("frequency")
                sched = t.get("schedule") or []
                due_date_str = t.get("due_date")

                # If template has a specific due date, it only counts on that day
                if due_date_str:
                    if curr_date.strftime("%Y-%m-%d") == due_date_str:
                        total_expected += 1
                    continue # Ignore recurring frequencies if a specific date is set

                # Default to daily if not specified, but 'none' means it's ignored unless it had a due_date
                if not freq:
                    freq = "daily"

                if freq == "none":
                    continue
                elif freq == "daily":
                    total_expected += 1
                elif freq == "shift":
                    vid = t.get("venue_id")
                    num_shifts = shifts_per_venue.get(vid, 3) # default to 3 if none defined
                    total_expected += num_shifts
                elif freq == "weekly" and sched:
                    if day_of_week in sched:
                        total_expected += 1
                elif freq == "monthly" and sched:
                    target_day = sched[0]
                    _, last_day = calendar.monthrange(curr_date.year, curr_date.month)
                    actual_target = min(target_day, last_day)
                    if day_of_month == actual_target:
                        total_expected += 1
                elif freq == "custom" and sched:
                    if day_of_week in sched:
                        total_expected += 1

        missing = total_expected - len(completed)

        # Get issue counts from answers
        sub_ids = [s["id"] for s in completed]
        critical_count = 0
        non_critical_count = 0

        if sub_ids:
            issues_res = (
                db.table("answers")
                .select("is_critical_failure, is_non_critical_issue")
                .in_("submission_id", sub_ids)
                .execute()
            )
            for a in (issues_res.data or []):
                if a.get("is_critical_failure"):
                    critical_count += 1
                if a.get("is_non_critical_issue"):
                    non_critical_count += 1

        avg_exec = round(total_exec_minutes / exec_count, 1) if exec_count > 0 else 0

        return {
            "total_expected": total_expected,
            "completed_on_time": completed_on_time,
            "completed_late": completed_late,
            "completed_total": len(completed),
            "missing": max(0, missing),
            "compliance_pct": round(len(completed) / total_expected * 100, 1) if total_expected > 0 else 0,
            "critical_issues": critical_count,
            "non_critical_issues": non_critical_count,
            "avg_execution_minutes": avg_exec,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Permissions & Roles Endpoints ─────────────────────────

@app.get("/permissions")
async def list_permissions(db=Depends(get_db), _=Depends(require_permission("admin.manage_users"))):
    res = db.table("permissions").select("*").execute()
    return res.data


class RoleCreate(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None
    is_admin: bool = False


@app.get("/roles")
async def list_roles(org_id: str, db=Depends(get_db), _=Depends(require_permission("admin.manage_users"))):
    res = db.table("custom_roles").select("*").eq("org_id", org_id).execute()
    return res.data


@app.post("/roles")
async def create_role(
    role: RoleCreate,
    db=Depends(get_db),
    _=Depends(require_permission("admin.manage_roles")),
):
    res = db.table("custom_roles").insert(role.dict()).execute()
    return res.data[0]


@app.post("/roles/{role_id}/permissions")
async def assign_role_permissions(
    role_id: str,
    permission_ids: List[str],
    db=Depends(get_db),
    _=Depends(require_permission("admin.manage_roles")),
):
    # delete old permissions
    db.table("role_permissions").delete().eq("role_id", role_id).execute()
    # insert new
    inserts = [{"role_id": role_id, "permission_id": pid} for pid in permission_ids]
    if inserts:
        db.table("role_permissions").insert(inserts).execute()
    return {"status": "success"}


class OverrideCreate(BaseModel):
    permission_key: str
    granted: bool
    reason: Optional[str] = None


@app.post("/profiles/{profile_id}/overrides")
async def create_override(
    profile_id: str,
    override: OverrideCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("admin.manage_users")),
):
    # Fetch perm id
    perm_res = (
        db.table("permissions").select("id").eq("key", override.permission_key).execute()
    )
    if not perm_res.data:
        raise HTTPException(404, "Permission not found")
    perm_id = perm_res.data[0]["id"]

    data = {
        "profile_id": profile_id,
        "permission_id": perm_id,
        "granted": override.granted,
        "reason": override.reason,
        "created_by": current_user.id,
    }
    res = db.table("profile_permission_overrides").upsert(data).execute()
    return res.data


@app.get("/profiles/{profile_id}/permissions")
async def get_effective_permissions(profile_id: str, db=Depends(get_db)):
    # Simple logic to return all effective permissions to frontend
    perms = db.table("permissions").select("*").execute().data
    effective = []
    for p in perms:
        has_perm = await resolve_permission(profile_id, p["key"], db)
        if has_perm:
            effective.append(p["key"])
    return {"permissions": effective}


# ── Inventory: Assets Models ─────────────────────────────

class CreateAssetCategoryRequest(BaseModel):
    org_id: str
    name: str
    icon: Optional[str] = None
    review_interval_days: int = 30

class UpdateAssetCategoryRequest(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    review_interval_days: Optional[int] = None

class CreateAssetRequest(BaseModel):
    org_id: str
    venue_id: str
    category_id: str
    name: str
    serial: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[str] = None
    location_note: Optional[str] = None
    photo_url: Optional[str] = None

class UpdateAssetRequest(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    venue_id: Optional[str] = None
    serial: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[str] = None
    status: Optional[str] = None
    location_note: Optional[str] = None
    photo_url: Optional[str] = None

class AssetReviewRequest(BaseModel):
    notes: Optional[str] = None
    photo_url: Optional[str] = None

# ── Inventory: Assets Endpoints (M8) ─────────────────────

@app.get("/asset-categories")
async def list_asset_categories(org_id: str, db=Depends(get_db)):
    res = db.table("asset_categories").select("*").eq("org_id", org_id).execute()
    return res.data or []

@app.post("/asset-categories")
async def create_asset_category(body: CreateAssetCategoryRequest, db=Depends(get_db), _=Depends(require_permission("inventory_assets.manage_categories" if False else "inventory_assets.create"))): # Using create as generic admin fallback for now
    res = db.table("asset_categories").insert(body.dict(exclude_none=True)).execute()
    return res.data[0]

@app.patch("/asset-categories/{category_id}")
async def update_asset_category(category_id: str, body: UpdateAssetCategoryRequest, db=Depends(get_db), _=Depends(require_permission("inventory_assets.edit"))):
    payload = body.dict(exclude_none=True)
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("asset_categories").update(payload).eq("id", category_id).execute()
    return res.data[0] if res.data else {}

@app.get("/assets")
async def list_assets(venue_id: Optional[str] = None, status: Optional[str] = None, category_id: Optional[str] = None, include_archived: bool = False, db=Depends(get_db), _=Depends(require_permission("inventory_assets.view"))):
    query = db.table("assets").select("*, asset_categories(name)")
    if venue_id:
        query = query.eq("venue_id", venue_id)
    if status:
        query = query.eq("status", status)
    elif not include_archived:
        query = query.neq("status", "baja")
    if category_id:
        query = query.eq("category_id", category_id)
        
    res = query.execute()
    return res.data or []

@app.post("/assets")
async def create_asset(body: CreateAssetRequest, db=Depends(get_db), _=Depends(require_permission("inventory_assets.create"))):
    import uuid
    payload = body.dict(exclude_none=True)
    payload["qr_code"] = str(uuid.uuid4())
    res = db.table("assets").insert(payload).execute()
    return res.data[0]

@app.get("/assets/{asset_id}")
async def get_asset(asset_id: str, db=Depends(get_db), _=Depends(require_permission("inventory_assets.view"))):
    res = db.table("assets").select("*, asset_categories(name)").eq("id", asset_id).execute()
    if not res.data:
        raise HTTPException(404, "Asset not found")
    return res.data[0]

@app.patch("/assets/{asset_id}")
async def update_asset(asset_id: str, body: UpdateAssetRequest, db=Depends(get_db), _=Depends(require_permission("inventory_assets.edit"))):
    payload = body.dict(exclude_none=True)
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("assets").update(payload).eq("id", asset_id).execute()
    return res.data[0] if res.data else {}

@app.get("/assets/qr/{qr_code}")
async def resolve_asset_by_qr(qr_code: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    # Any authenticated user can scan a QR to get the asset summary
    res = db.table("assets").select("*, asset_categories(name, icon, review_interval_days)").eq("qr_code", qr_code).execute()
    if not res.data:
        raise HTTPException(404, "Asset not found for this QR")
    return res.data[0]

@app.post("/assets/{asset_id}/review")
async def review_asset(asset_id: str, body: AssetReviewRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("inventory_assets.review"))):
    from datetime import datetime, timezone
    
    now_iso = datetime.now(timezone.utc).isoformat()

    # Insert review log
    review_data = {
        "asset_id": asset_id,
        "reviewed_by": current_user.id,
        "notes": body.notes,
        "photo_url": body.photo_url
    }
    db.table("asset_reviews").insert(review_data).execute()
    
    # Update asset last_reviewed_at
    res = db.table("assets").update({"last_reviewed_at": now_iso}).eq("id", asset_id).execute()
    
    # Auto-create closed ticket for the review history
    ticket_data = {
        "asset_id": asset_id,
        "opened_by": current_user.id,
        "title": "Revisión Preventiva",
        "priority": "baja",
        "status": "resuelto",
        "closed_at": now_iso,
        "closed_by": current_user.id
    }
    ticket_res = db.table("repair_tickets").insert(ticket_data).execute()
    
    if ticket_res.data:
        ticket = ticket_res.data[0]
        entry_data = {
            "ticket_id": ticket["id"],
            "created_by": current_user.id,
            "type": "nota",
            "description": body.notes or "Revisión preventiva completada sin novedades.",
            "status_after": "resuelto"
        }
        db.table("repair_ticket_entries").insert(entry_data).execute()
    
    return {"ok": True, "asset": res.data[0] if res.data else None}


# ── Inventory: Utensils Models (M10) ──────────────────────

class CreateUtensilCategoryRequest(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None

class UpdateUtensilCategoryRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class CreateUtensilRequest(BaseModel):
    org_id: str
    category_id: Optional[str] = None
    name: str
    unit: str = 'unidades'
    min_stock: int = 0
    is_active: bool = True

class UpdateUtensilRequest(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    unit: Optional[str] = None
    min_stock: Optional[int] = None
    is_active: Optional[bool] = None

# ── Inventory: Utensils Endpoints (M10) ───────────────────

@app.get("/utensil-categories")
async def list_utensil_categories(org_id: str, db=Depends(get_db)):
    res = db.table("utensil_categories").select("*").eq("org_id", org_id).execute()
    return res.data or []

@app.post("/utensil-categories")
async def create_utensil_category(body: CreateUtensilCategoryRequest, db=Depends(get_db), _=Depends(require_permission("inventory_utensils.manage_items" if False else "inventory_utensils.create"))): # Using create as generic admin fallback for now
    res = db.table("utensil_categories").insert(body.dict(exclude_none=True)).execute()
    return res.data[0]

@app.patch("/utensil-categories/{category_id}")
async def update_utensil_category(category_id: str, body: UpdateUtensilCategoryRequest, db=Depends(get_db), _=Depends(require_permission("inventory_utensils.manage_items" if False else "inventory_utensils.edit"))):
    payload = body.dict(exclude_none=True)
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("utensil_categories").update(payload).eq("id", category_id).execute()
    return res.data[0] if res.data else {}

@app.get("/utensils")
async def list_utensils(org_id: Optional[str] = None, category_id: Optional[str] = None, include_archived: bool = False, db=Depends(get_db)):
    query = db.table("utensils").select("*, utensil_categories(name)")
    if org_id:
        query = query.eq("org_id", org_id)
    if not include_archived:
        query = query.eq("is_active", True)
    if category_id:
        query = query.eq("category_id", category_id)
        
    res = query.execute()
    return res.data or []

@app.post("/utensils")
async def create_utensil(body: CreateUtensilRequest, db=Depends(get_db), _=Depends(require_permission("inventory_utensils.manage_items" if False else "inventory_utensils.create"))):
    payload = body.dict(exclude_none=True)
    res = db.table("utensils").insert(payload).execute()
    return res.data[0]

@app.patch("/utensils/{utensil_id}")
async def update_utensil(utensil_id: str, body: UpdateUtensilRequest, db=Depends(get_db), _=Depends(require_permission("inventory_utensils.manage_items" if False else "inventory_utensils.edit"))):
    payload = body.dict(exclude_none=True)
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("utensils").update(payload).eq("id", utensil_id).execute()
    return res.data[0] if res.data else {}

# ── Inventory: Repair Tickets Models (M9) ─────────────────

class CreateTicketRequest(BaseModel):
    title: str
    priority: str = "media"  # baja, media, alta, critica
    description: str
    photo_url: Optional[str] = None


class CreateTicketEntryRequest(BaseModel):
    type: str  # visita, presupuesto, compra, nota
    description: str
    technician: Optional[str] = None
    cost: Optional[float] = None
    attachments: Optional[list[str]] = None  # Array of URLs
    next_action: Optional[str] = None
    status_after: Optional[str] = None  # abierto, en_progreso, esperando, resuelto


class CloseTicketRequest(BaseModel):
    description: str = "Reparación completada y verificada."
    cost: Optional[float] = None
    attachments: Optional[list[str]] = None


# ── Inventory: Repair Tickets Endpoints (M9) ─────────────

@app.post("/assets/{asset_id}/tickets")
async def open_repair_ticket(
    asset_id: str,
    body: CreateTicketRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.report_fault")),
):
    """Opens a new repair ticket for an asset. Sets asset status to 'en_reparacion'."""
    try:
        # Check asset exists
        asset_res = db.table("assets").select("id, status").eq("id", asset_id).execute()
        if not asset_res.data:
            raise HTTPException(404, "Asset not found")

        # Check no open ticket already exists
        existing = (
            db.table("repair_tickets")
            .select("id")
            .eq("asset_id", asset_id)
            .neq("status", "resuelto")
            .execute()
        )
        if existing.data and len(existing.data) > 0:
            raise HTTPException(400, "This asset already has an open ticket")

        # Create ticket
        ticket_data = {
            "asset_id": asset_id,
            "opened_by": current_user.id,
            "title": body.title,
            "priority": body.priority,
        }
        ticket_res = db.table("repair_tickets").insert(ticket_data).execute()
        ticket = ticket_res.data[0]

        # Create initial entry (apertura)
        entry_data = {
            "ticket_id": ticket["id"],
            "created_by": current_user.id,
            "type": "nota",
            "description": body.description,
            "attachments": [body.photo_url] if body.photo_url else None,
            "status_after": "abierto",
        }
        db.table("repair_ticket_entries").insert(entry_data).execute()

        # Update asset status
        db.table("assets").update({"status": "en_reparacion"}).eq("id", asset_id).execute()

        return ticket

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/assets/{asset_id}/tickets")
async def list_asset_tickets(
    asset_id: str,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.view")),
):
    """Returns all tickets for an asset (active and closed), with cost summary."""
    try:
        res = (
            db.table("repair_tickets")
            .select("*, profiles!repair_tickets_opened_by_fkey(full_name)")
            .eq("asset_id", asset_id)
            .order("opened_at", desc=True)
            .execute()
        )
        tickets = res.data or []

        # Enrich with cost data from entries
        ticket_ids = [t["id"] for t in tickets]
        if ticket_ids:
            entries_res = (
                db.table("repair_ticket_entries")
                .select("ticket_id, cost, type")
                .in_("ticket_id", ticket_ids)
                .execute()
            )
            # Aggregate costs per ticket
            cost_map: dict = {}
            entry_count_map: dict = {}
            for e in (entries_res.data or []):
                tid = e["ticket_id"]
                if tid not in cost_map:
                    cost_map[tid] = 0
                    entry_count_map[tid] = 0
                if e.get("cost"):
                    cost_map[tid] += float(e["cost"])
                entry_count_map[tid] += 1

            for t in tickets:
                t["total_cost"] = cost_map.get(t["id"], 0)
                t["entry_count"] = entry_count_map.get(t["id"], 0)

        return tickets

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: str,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.view")),
):
    """Returns a ticket with all its entries ordered chronologically."""
    try:
        # Get ticket
        ticket_res = (
            db.table("repair_tickets")
            .select("*, assets(id, name, qr_code, venue_id, status), profiles!repair_tickets_opened_by_fkey(full_name)")
            .eq("id", ticket_id)
            .execute()
        )
        if not ticket_res.data:
            raise HTTPException(404, "Ticket not found")

        ticket = ticket_res.data[0]

        # Get entries
        entries_res = (
            db.table("repair_ticket_entries")
            .select("*, profiles!repair_ticket_entries_created_by_fkey(full_name)")
            .eq("ticket_id", ticket_id)
            .order("created_at")
            .execute()
        )
        ticket["entries"] = entries_res.data or []

        # Calculate total cost
        total_cost = sum(
            float(e["cost"]) for e in ticket["entries"] if e.get("cost")
        )
        ticket["total_cost"] = total_cost

        return ticket

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tickets/{ticket_id}/entries")
async def add_ticket_entry(
    ticket_id: str,
    body: CreateTicketEntryRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.add_ticket_entry")),
):
    """
    Adds an entry to a ticket. Updates ticket status per status_after.
    Does NOT update asset.last_reviewed_at (only closing does that).
    If user selects status_after='resuelto' but lacks close_ticket permission,
    entry is saved with status_after='en_progreso' instead.
    """
    try:
        # Check ticket exists and is not closed
        ticket_res = (
            db.table("repair_tickets")
            .select("id, asset_id, status")
            .eq("id", ticket_id)
            .execute()
        )
        if not ticket_res.data:
            raise HTTPException(404, "Ticket not found")

        ticket = ticket_res.data[0]
        if ticket["status"] == "resuelto":
            raise HTTPException(400, "Cannot add entries to a closed ticket")

        # Check if user is trying to close via entry
        effective_status = body.status_after
        if body.status_after == "resuelto":
            has_close = await resolve_permission(
                current_user.id, "inventory_assets.close_ticket", db
            )
            if not has_close:
                # Downgrade to en_progreso, don't block the entry
                effective_status = "en_progreso"

        # Create entry
        entry_data = {
            "ticket_id": ticket_id,
            "created_by": current_user.id,
            "type": body.type,
            "description": body.description,
            "technician": body.technician,
            "cost": body.cost,
            "attachments": body.attachments,
            "next_action": body.next_action,
            "status_after": effective_status,
        }
        entry_res = db.table("repair_ticket_entries").insert(entry_data).execute()

        # Update ticket status if status_after provided
        if effective_status:
            update_data: dict = {"status": effective_status}
            if effective_status == "resuelto":
                now_iso = datetime.now(timezone.utc).isoformat()
                update_data["closed_at"] = now_iso
                update_data["closed_by"] = current_user.id
                # Also update asset
                db.table("assets").update({
                    "status": "operativo",
                    "last_reviewed_at": now_iso,
                }).eq("id", ticket["asset_id"]).execute()

            db.table("repair_tickets").update(update_data).eq("id", ticket_id).execute()

        return entry_res.data[0] if entry_res.data else {"ok": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/tickets/{ticket_id}/close")
async def close_ticket(
    ticket_id: str,
    body: CloseTicketRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.close_ticket")),
):
    """
    Closes a repair ticket. Creates a 'cierre' entry, sets ticket to 'resuelto',
    updates asset status to 'operativo' and asset.last_reviewed_at.
    """
    try:
        # Get ticket
        ticket_res = (
            db.table("repair_tickets")
            .select("id, asset_id, status")
            .eq("id", ticket_id)
            .execute()
        )
        if not ticket_res.data:
            raise HTTPException(404, "Ticket not found")

        ticket = ticket_res.data[0]
        if ticket["status"] == "resuelto":
            raise HTTPException(400, "Ticket is already closed")

        now_iso = datetime.now(timezone.utc).isoformat()

        # Create cierre entry
        entry_data = {
            "ticket_id": ticket_id,
            "created_by": current_user.id,
            "type": "cierre",
            "description": body.description,
            "cost": body.cost,
            "attachments": body.attachments,
            "status_after": "resuelto",
        }
        db.table("repair_ticket_entries").insert(entry_data).execute()

        # Close ticket
        db.table("repair_tickets").update({
            "status": "resuelto",
            "closed_at": now_iso,
            "closed_by": current_user.id,
        }).eq("id", ticket_id).execute()

        # Update asset: back to operativo + update last_reviewed_at
        db.table("assets").update({
            "status": "operativo",
            "last_reviewed_at": now_iso,
        }).eq("id", ticket["asset_id"]).execute()

        return {"ok": True, "closed_at": now_iso}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Inventory: Utensil Movements & Counts Models (M11) ────

class UtensilMovementRequest(BaseModel):
    utensil_id: str
    from_venue_id: Optional[str] = None
    to_venue_id: Optional[str] = None
    quantity: int
    type: str  # entry, exit, transfer, adjustment
    notes: Optional[str] = None


class UtensilCountItemSchema(BaseModel):
    utensil_id: str
    count: int


class CreateUtensilCountRequest(BaseModel):
    venue_id: str
    items: list[UtensilCountItemSchema]
    schedule_id: Optional[str] = None


class ConfirmCountItemSchema(BaseModel):
    utensil_id: str
    confirmed_count: int


class ConfirmCountRequest(BaseModel):
    items: list[ConfirmCountItemSchema]


# ── Inventory: Utensil Movements & Counts Endpoints (M11) ──

@app.post("/utensil-movements")
async def record_utensil_movement(
    body: UtensilMovementRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.manage_items")),
):
    """
    Records an inventory movement (entry, exit, transfer).
    """
    try:
        # Get org_id from utensil
        ut_res = db.table("utensils").select("org_id").eq("id", body.utensil_id).single().execute()
        if not ut_res.data:
            raise HTTPException(404, "Utensil not found")
        org_id = ut_res.data["org_id"]

        movement_data = {
            "org_id": org_id,
            "utensil_id": body.utensil_id,
            "from_venue_id": body.from_venue_id,
            "to_venue_id": body.to_venue_id,
            "quantity": body.quantity,
            "type": body.type,
            "created_by": current_user.id,
            "notes": body.notes,
        }
        res = db.table("utensil_movements").insert(movement_data).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/utensil-counts")
async def create_utensil_count(
    body: CreateUtensilCountRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.count")),
):
    """
    Staff submits a physical count for a venue.
    """
    try:
        # 1. Create count header
        count_data = {
            "venue_id": body.venue_id,
            "created_by": current_user.id,
            "status": "pending",
            "schedule_id": body.schedule_id,
        }
        count_res = db.table("utensil_counts").insert(count_data).execute()
        count_id = count_res.data[0]["id"]

        # 2. Create count items
        items_data = [
            {
                "count_id": count_id,
                "utensil_id": item.utensil_id,
                "initial_count": item.count,
            }
            for item in body.items
        ]
        db.table("utensil_count_items").insert(items_data).execute()

        # 3. Update schedule if exists
        if body.schedule_id:
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # Fetch schedule to get frequency
            sched_res = db.table("count_schedules").select("frequency, next_due").eq("id", body.schedule_id).single().execute()
            if sched_res.data:
                freq = sched_res.data["frequency"]
                
                updates = {"last_completed_at": now_iso}
                
                if freq == "one_time":
                    updates["is_active"] = False
                else:
                    from datetime import timedelta
                    current_due = datetime.fromisoformat(sched_res.data["next_due"]) if "T" in sched_res.data["next_due"] else datetime.strptime(sched_res.data["next_due"], "%Y-%m-%d")
                    # simple calculation, could be more complex depending on timezone
                    if freq == "daily":
                        next_due = current_due + timedelta(days=1)
                    elif freq == "weekly":
                        next_due = current_due + timedelta(days=7)
                    elif freq == "biweekly":
                        next_due = current_due + timedelta(days=14)
                    elif freq == "monthly":
                        next_due = current_due + timedelta(days=30) # approx
                    else:
                        next_due = current_due
                        
                    updates["next_due"] = next_due.strftime("%Y-%m-%d")

                db.table("count_schedules").update(updates).eq("id", body.schedule_id).execute()

        return {"id": count_id, "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/utensil-counts")
async def list_utensil_counts(
    venue_id: Optional[str] = None,
    status: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.view")),
):
    """
    Lists utensil counts with optional filters.
    """
    query = db.table("utensil_counts").select("*, profiles!utensil_counts_created_by_fkey(full_name)")
    if venue_id:
        query = query.eq("venue_id", venue_id)
    if status:
        query = query.eq("status", status)
    
    res = query.order("created_at", desc=True).execute()
    return res.data


@app.get("/utensil-counts/{count_id}")
async def get_utensil_count_detail(
    count_id: str,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.view")),
):
    """
    Returns full detail of a specific count.
    """
    # Header
    count_res = db.table("utensil_counts").select("*, profiles!utensil_counts_created_by_fkey(full_name), venues(name)").eq("id", count_id).single().execute()
    if not count_res.data:
        raise HTTPException(404, "Count not found")
    
    result = count_res.data

    if result.get("confirmed_by"):
        conf_res = db.table("profiles").select("full_name").eq("id", result["confirmed_by"]).single().execute()
        if conf_res.data:
            result["confirmed_by_user"] = conf_res.data["full_name"]

    # Items
    items_res = db.table("utensil_count_items").select("*, utensils(name, unit)").eq("count_id", count_id).execute()
    
    result["items"] = items_res.data
    return result


@app.patch("/utensil-counts/{count_id}/confirm")
async def confirm_utensil_count(
    count_id: str,
    body: ConfirmCountRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.confirm_count")),
):
    """
    Supervisor confirms/adjusts a count.
    """
    try:
        # 1. Update items with confirmed quantities
        for item in body.items:
            db.table("utensil_count_items").update({
                "confirmed_count": item.confirmed_count
            }).eq("count_id", count_id).eq("utensil_id", item.utensil_id).execute()

        # 2. Update header status
        now_iso = datetime.now(timezone.utc).isoformat()
        db.table("utensil_counts").update({
            "status": "confirmed",
            "confirmed_at": now_iso,
            "confirmed_by": current_user.id
        }).eq("id", count_id).execute()

        return {"ok": True, "confirmed_at": now_iso}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Inventory: Count Schedules Models & Endpoints (M11.2) ──

class CreateCountScheduleRequest(BaseModel):
    venue_id: str
    assigned_to: Optional[str] = None
    name: str
    frequency: str
    scope: str
    category_id: Optional[str] = None
    next_due: str  # YYYY-MM-DD
    item_ids: Optional[list[str]] = None

class UpdateCountScheduleRequest(BaseModel):
    venue_id: Optional[str] = None
    assigned_to: Optional[str] = None
    name: Optional[str] = None
    frequency: Optional[str] = None
    scope: Optional[str] = None
    category_id: Optional[str] = None
    next_due: Optional[str] = None
    is_active: Optional[bool] = None
    item_ids: Optional[list[str]] = None


@app.post("/count-schedules")
async def create_count_schedule(
    body: CreateCountScheduleRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.manage_items"))
):
    try:
        # Get org_id from venue
        venue_res = db.table("venues").select("org_id").eq("id", body.venue_id).single().execute()
        if not venue_res.data:
            raise HTTPException(404, "Venue not found")
            
        schedule_data = {
            "org_id": venue_res.data["org_id"],
            "venue_id": body.venue_id,
            "assigned_to": body.assigned_to,
            "name": body.name,
            "frequency": body.frequency,
            "scope": body.scope,
            "category_id": body.category_id,
            "next_due": body.next_due,
            "created_by": current_user.id
        }
        
        res = db.table("count_schedules").insert(schedule_data).execute()
        schedule_id = res.data[0]["id"]
        
        # Insert specific items if scope is custom
        if body.scope == "custom" and body.item_ids:
            items_data = [{"schedule_id": schedule_id, "item_id": item_id} for item_id in body.item_ids]
            db.table("count_schedule_items").insert(items_data).execute()
            
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/count-schedules")
async def list_count_schedules(
    venue_id: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.view"))
):
    query = db.table("count_schedules").select("*, profiles!count_schedules_assigned_to_fkey(full_name), venues(name)").order("created_at", desc=True)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    
    res = query.execute()
    schedules = res.data or []
    
    # Attach items if it's a custom scope
    for s in schedules:
        if s["scope"] == "custom":
            items_res = db.table("count_schedule_items").select("item_id").eq("schedule_id", s["id"]).execute()
            s["item_ids"] = [i["item_id"] for i in (items_res.data or [])]
            
    return schedules

@app.patch("/count-schedules/{schedule_id}")
async def update_count_schedule(
    schedule_id: str,
    body: UpdateCountScheduleRequest,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.manage_items"))
):
    try:
        payload = body.dict(exclude_none=True, exclude={"item_ids"})
        
        if payload:
            res = db.table("count_schedules").update(payload).eq("id", schedule_id).execute()
            if not res.data:
                raise HTTPException(404, "Schedule not found")

        # Update specific items if scope changed to custom or custom items changed
        if body.scope == "custom" and body.item_ids is not None:
            # Delete old items
            db.table("count_schedule_items").delete().eq("schedule_id", schedule_id).execute()
            # Insert new items
            if body.item_ids:
                items_data = [{"schedule_id": schedule_id, "item_id": item_id} for item_id in body.item_ids]
                db.table("count_schedule_items").insert(items_data).execute()
        elif body.scope in ["all", "category"]:
             # Ensure no items exist if scope is no longer custom
             db.table("count_schedule_items").delete().eq("schedule_id", schedule_id).execute()

        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/count-schedules/due")
async def get_due_schedules(
    venue_id: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Returns schedules that are due for the current user's venue.
    Filters by next_due <= today and is_active = true.
    """
    try:
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
        
        # We need to find schedules that are active, due on or before today, 
        # for the specific venue, and either unassigned or assigned to this user.
        res = db.table("count_schedules").select("*") \
            .eq("venue_id", venue_id) \
            .eq("is_active", True) \
            .lte("next_due", today) \
            .execute()
            
        schedules = res.data or []
        
        # Filter assigned_to in python (easier than complex OR in postgrest sometimes)
        valid_schedules = [s for s in schedules if not s.get("assigned_to") or s.get("assigned_to") == current_user.id]
        
        # Attach items if it's a custom scope
        for s in valid_schedules:
            if s["scope"] == "custom":
                items_res = db.table("count_schedule_items").select("item_id").eq("schedule_id", s["id"]).execute()
                s["item_ids"] = [i["item_id"] for i in (items_res.data or [])]
                
        return valid_schedules
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Admin: General Summary (M13/M14 Dashboard) ──

@app.get("/admin/summary")
async def get_admin_summary(
    venue_id: Optional[str] = None,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission("admin.view_dashboard"))
):
    try:
        # Get organization
        profile_res = db.table("profiles").select("organization_id").eq("id", current_user.id).single().execute()
        if not profile_res.data:
            raise HTTPException(404, "Profile not found")
        org_id = profile_res.data["organization_id"]

        # 1. Active Staff Count
        today_str = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
        
        # Get venues for this org to filter attendance
        venues_res = db.table("venues").select("id").eq("org_id", org_id).execute()
        org_venue_ids = [v["id"] for v in (venues_res.data or [])]
        
        active_staff = 0
        if org_venue_ids:
            live_query = db.table("attendance_logs").select("profile_id, event_type").gte("marked_at", f"{today_str}T00:00:00-04:00")
            if venue_id:
                if venue_id in org_venue_ids:
                    live_query = live_query.eq("venue_id", venue_id)
                else:
                    return {"active_staff": 0, "pending_tickets": 0, "critical_failures": 0, "today": today_str}
            else:
                live_query = live_query.in_("venue_id", org_venue_ids)
            
            live_res = live_query.execute()
            logs = live_res.data or []
            staff_status = {}
            for l in logs:
                staff_status[l["profile_id"]] = l["event_type"]
            active_staff = sum(1 for status in staff_status.values() if status != 'clock_out')

        # 2. Pending Repair Tickets
        pending_tickets = 0
        if org_venue_ids:
            # First get assets for the org/venue
            asset_query = db.table("assets").select("id").in_("venue_id", org_venue_ids)
            if venue_id:
                asset_query = asset_query.eq("venue_id", venue_id)
            
            asset_ids = [a["id"] for a in (asset_query.execute().data or [])]
            
            if asset_ids:
                tickets_res = db.table("repair_tickets").select("id", count="exact").neq("status", "resuelto").in_("asset_id", asset_ids).execute()
                pending_tickets = tickets_res.count if tickets_res.count is not None else 0

        # 3. Critical Checklist Failures (Today)
        # We only count failures for templates that belong to this organization
        critical_failures = 0
        if org_venue_ids:
            tmpl_query = db.table("checklist_templates").select("id").in_("venue_id", org_venue_ids)
            if venue_id:
                tmpl_query = tmpl_query.eq("venue_id", venue_id)
            
            template_ids = [t["id"] for t in (tmpl_query.execute().data or [])]
            
            if template_ids:
                # Find submissions for these templates today
                sub_query = db.table("submissions").select("id").in_("template_id", template_ids).gte("created_at", f"{today_str}T00:00:00-04:00")
                sub_ids = [s["id"] for s in (sub_query.execute().data or [])]
                
                if sub_ids:
                    critical_res = db.table("answers").select("id", count="exact").eq("is_critical_failure", True).in_("submission_id", sub_ids).execute()
                    critical_failures = critical_res.count if critical_res.count is not None else 0

        return {
            "active_staff": active_staff,
            "pending_tickets": pending_tickets,
            "critical_failures": critical_failures,
            "today": today_str
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Inventory: Dashboard (M10 & M12) ──

@app.get("/inventory/dashboard/summary")
async def get_inventory_dashboard_summary(
    venue_id: Optional[str] = None,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission("inventory_assets.view"))
):
    try:
        # We need the org_id to filter correctly if venue_id is not provided
        profile_res = db.table("profiles").select("organization_id").eq("id", current_user.id).single().execute()
        if not profile_res.data:
            raise HTTPException(404, "Profile not found")
            
        org_id = profile_res.data["organization_id"]

        # 1. Asset Status Scorecards
        assets_query = db.table("assets").select("id, status").eq("org_id", org_id)
        if venue_id:
            assets_query = assets_query.eq("venue_id", venue_id)
        assets_res = assets_query.execute()
        assets = assets_res.data or []
        
        asset_stats = {
            "total": len(assets),
            "operativo": sum(1 for a in assets if a["status"] == "operativo"),
            "en_reparacion": sum(1 for a in assets if a["status"] == "en_reparacion"),
            "baja": sum(1 for a in assets if a["status"] == "baja")
        }

        # 2. Active Tickets
        # Repair tickets belong to assets, so we filter by the asset's org_id
        tickets_query = db.table("repair_tickets").select("*, assets!inner(name, org_id)").eq("assets.org_id", org_id).neq("status", "resuelto").order("opened_at", desc=True).limit(5)
        if venue_id:
            # We don't have venue_id on repair_tickets, it's on assets
            tickets_query = tickets_query.eq("assets.venue_id", venue_id)
        active_tickets = tickets_query.execute().data or []

        # 3. Pending Utensil Counts
        counts_query = db.table("utensil_counts").select("*, profiles!utensil_counts_created_by_fkey(full_name), venues(name)").eq("status", "pending").order("created_at", desc=True).limit(5)
        if venue_id:
            counts_query = counts_query.eq("venue_id", venue_id)
        pending_counts = counts_query.execute().data or []

        # 4. Due Schedules (Utensils)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        sched_query = db.table("count_schedules").select("*, venues(name)").eq("org_id", org_id).eq("is_active", True).lte("next_due", today)
        if venue_id:
            sched_query = sched_query.eq("venue_id", venue_id)
        due_schedules = sched_query.execute().data or []

        return {
            "asset_stats": asset_stats,
            "active_tickets": active_tickets,
            "pending_counts": pending_counts,
            "due_schedules": due_schedules
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Attendance: Shifts Models & Endpoints (M13) ──

class EmployeeShiftRequest(BaseModel):
    profile_id: str
    venue_id: str
    modality: str
    weekdays: Optional[list[int]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_active: bool = True

class ShiftDayRequest(BaseModel):
    weekday: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    day_off: bool = False

@app.get("/employee-shifts")
async def list_employee_shifts(profile_id: Optional[str] = None, venue_id: Optional[str] = None, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    query = db.table("employee_shifts").select("*, shift_days(*)")
    if profile_id:
        query = query.eq("profile_id", profile_id)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    res = query.execute()
    return res.data

@app.post("/employee-shifts")
async def create_employee_shift(body: EmployeeShiftRequest, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    res = db.table("employee_shifts").insert(body.dict(exclude_none=True)).execute()
    return res.data[0]

@app.patch("/employee-shifts/{shift_id}")
async def update_employee_shift(shift_id: str, body: EmployeeShiftRequest, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    res = db.table("employee_shifts").update(body.dict(exclude_none=True)).eq("id", shift_id).execute()
    return res.data[0]

@app.post("/employee-shifts/{shift_id}/days")
async def update_shift_day(shift_id: str, body: ShiftDayRequest, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    data = body.dict()
    data["employee_shift_id"] = shift_id
    res = db.table("shift_days").upsert(data, on_conflict="employee_shift_id,weekday").execute()
    return res.data[0]

# ── Attendance: Marking Models & Endpoints (M13) ──

class MarkAttendanceRequest(BaseModel):
    event_type: str # clock_in, clock_out, break_start, break_end
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    gps_accuracy_m: Optional[int] = None

def get_active_shift_for_today(profile_id: str, venue_id: str, db) -> dict:
    today_dt = datetime.now(CARACAS_TZ)
    iso_weekday = today_dt.isoweekday() # 1=Mon, 7=Sun
    
    # Get active shift
    shift_res = db.table("employee_shifts").select("*").eq("profile_id", profile_id).eq("venue_id", venue_id).eq("is_active", True).execute()
    if not shift_res.data:
        return None
    
    shift = shift_res.data[0]
    
    if shift["modality"] == "flexible":
        return {"id": shift["id"], "expected_start": None, "expected_end": None}
        
    elif shift["modality"] == "fixed":
        if shift["weekdays"] and iso_weekday in shift["weekdays"]:
            return {"id": shift["id"], "expected_start": shift.get("start_time"), "expected_end": shift.get("end_time")}
        return None
        
    elif shift["modality"] == "rotating":
        days_res = db.table("shift_days").select("*").eq("employee_shift_id", shift["id"]).eq("weekday", iso_weekday).execute()
        if days_res.data and not days_res.data[0].get("day_off"):
            return {"id": shift["id"], "expected_start": days_res.data[0].get("start_time"), "expected_end": days_res.data[0].get("end_time")}
        return None
        
    return None

def calculate_late_minutes(real_time_str: str, expected_time_str: str) -> int:
    if not expected_time_str: return 0
    rt = datetime.strptime(real_time_str, "%H:%M:%S").time()
    et = datetime.strptime(expected_time_str, "%H:%M:%S").time()
    diff = (rt.hour * 60 + rt.minute) - (et.hour * 60 + et.minute)
    return max(0, diff)

def calculate_overtime(real_time_str: str, expected_time_str: str, is_entry: bool) -> int:
    if not expected_time_str: return 0
    rt = datetime.strptime(real_time_str, "%H:%M:%S").time()
    et = datetime.strptime(expected_time_str, "%H:%M:%S").time()
    rm = rt.hour * 60 + rt.minute
    em = et.hour * 60 + et.minute
    
    diff = (em - rm) if is_entry else (rm - em)
    if diff <= 0: return 0
    return diff // 60 # Floor hours

@app.get("/attendance/today/status")
async def get_attendance_status(current_user=Depends(get_current_user), db=Depends(get_db)):
    profile_res = db.table("profiles").select("venue_id").eq("id", current_user.id).single().execute()
    venue_id = profile_res.data.get("venue_id")
    if not venue_id:
        raise HTTPException(400, "No venue assigned")

    today_str = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
    logs_res = db.table("attendance_logs").select("*").eq("profile_id", current_user.id).eq("venue_id", venue_id).gte("marked_at", f"{today_str}T00:00:00-04:00").order("marked_at", desc=True).limit(1).execute()
    
    last_event = logs_res.data[0]["event_type"] if logs_res.data else None
    
    # State Machine
    available_actions = []
    if not last_event: available_actions = ["clock_in"]
    elif last_event == "clock_in": available_actions = ["break_start", "clock_out"]
    elif last_event == "break_start": available_actions = ["break_end"]
    elif last_event == "break_end": available_actions = ["clock_out"]
    
    # Check if user has an assigned active shift
    shift_check = db.table("employee_shifts").select("id").eq("profile_id", current_user.id).eq("venue_id", venue_id).eq("is_active", True).limit(1).execute()
    has_active_shift = bool(shift_check.data and len(shift_check.data) > 0)
    
    return {
        "last_event": last_event,
        "last_marked_at": logs_res.data[0]["marked_at"] if logs_res.data else None,
        "available_actions": available_actions,
        "has_active_shift": has_active_shift
    }

@app.post("/attendance/mark")
async def mark_attendance(body: MarkAttendanceRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.mark"))):
    profile_res = db.table("profiles").select("venue_id").eq("id", current_user.id).single().execute()
    venue_id = profile_res.data.get("venue_id")
    if not venue_id:
        raise HTTPException(400, "No venue assigned")
        
    status_res = await get_attendance_status(current_user, db)
    if body.event_type not in status_res["available_actions"]:
        raise HTTPException(400, f"Invalid state. Allowed: {status_res['available_actions']}")
        
    now_dt = datetime.now(CARACAS_TZ)
    now_time_str = now_dt.strftime("%H:%M:%S")
    
    active_shift = get_active_shift_for_today(current_user.id, venue_id, db)
    
    log_data = {
        "profile_id": current_user.id,
        "venue_id": venue_id,
        "event_type": body.event_type,
        "gps_lat": body.gps_lat,
        "gps_lng": body.gps_lng,
        "gps_accuracy_m": body.gps_accuracy_m,
    }
    
    if active_shift:
        log_data["employee_shift_id"] = active_shift["id"]
        log_data["expected_start"] = active_shift["expected_start"]
        log_data["expected_end"] = active_shift["expected_end"]
        
        if body.event_type == "clock_in":
            log_data["minutes_late"] = calculate_late_minutes(now_time_str, active_shift["expected_start"])
            log_data["overtime_hours"] = calculate_overtime(now_time_str, active_shift["expected_start"], is_entry=True)
        elif body.event_type == "clock_out":
            log_data["overtime_hours"] = calculate_overtime(now_time_str, active_shift["expected_end"], is_entry=False)
            
    res = db.table("attendance_logs").insert(log_data).execute()
    return res.data[0]

# ── Attendance: Absences & Admin Views (M13) ──

@app.get("/attendance/live")
async def get_live_attendance(venue_id: str, db=Depends(get_db), _=Depends(require_permission("attendance.view_team"))):
    today_str = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
    # Fetch all logs for today in this venue
    logs_res = db.table("attendance_logs").select("*, profiles!attendance_logs_profile_id_fkey(full_name)").eq("venue_id", venue_id).gte("marked_at", f"{today_str}T00:00:00-04:00").order("marked_at", desc=True).execute()
    
    # Group by profile to find latest state
    staff_status = {}
    for log in logs_res.data or []:
        pid = log["profile_id"]
        if pid not in staff_status:
            staff_status[pid] = log
            
    return list(staff_status.values())

class AbsenceRequest(BaseModel):
    profile_id: str
    venue_id: str
    date: str
    type: str
    reason: Optional[str] = None

@app.post("/attendance/absences")
async def create_absence(body: AbsenceRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    data = body.dict()
    data["approved_by"] = current_user.id
    res = db.table("absences").upsert(data, on_conflict="profile_id,date").execute()
    return res.data[0] if res.data else {"ok": True}

@app.post("/internal/attendance/check-absences")
async def cron_check_absences(db=Depends(get_db)):
    """Called daily at 11:50 PM"""
    today_dt = datetime.now(CARACAS_TZ)
    today_str = today_dt.strftime("%Y-%m-%d")
    iso_weekday = today_dt.isoweekday()
    
    # Find all users who were SUPPOSED to work today
    shifts_res = db.table("employee_shifts").select("*").eq("is_active", True).execute()
    expected_profiles = []
    
    for shift in shifts_res.data or []:
        if shift["modality"] == "fixed" and shift["weekdays"] and iso_weekday in shift["weekdays"]:
            expected_profiles.append(shift)
        elif shift["modality"] == "rotating":
            d_res = db.table("shift_days").select("day_off").eq("employee_shift_id", shift["id"]).eq("weekday", iso_weekday).execute()
            if d_res.data and not d_res.data[0].get("day_off"):
                expected_profiles.append(shift)
                
    # Check if they have ANY log today
    for s in expected_profiles:
        pid = s["profile_id"]
        log_check = db.table("attendance_logs").select("id").eq("profile_id", pid).gte("marked_at", f"{today_str}T00:00:00-04:00").limit(1).execute()
        
        if not log_check.data:
            # Check if they already have an absence (e.g., leave/sick)
            abs_check = db.table("absences").select("id").eq("profile_id", pid).eq("date", today_str).execute()
            if not abs_check.data:
                db.table("absences").insert({
                    "profile_id": pid,
                    "venue_id": s["venue_id"],
                    "date": today_str,
                    "type": "unexcused"
                }).execute()
                
    return {"ok": True, "checked": len(expected_profiles)}

# ── Attendance: History & Reports (M14) ──

@app.get("/attendance/me")
async def get_my_attendance_history(days: int = 30, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.view_own"))):
    """Returns the staff member's attendance history for the calendar view."""
    today = datetime.now(CARACAS_TZ)
    start_date = (today - timedelta(days=days)).strftime("%Y-%m-%d")
    
    res = db.table("v_daily_attendance").select("*").eq("profile_id", current_user.id).gte("work_date", start_date).order("work_date", desc=True).execute()
    return res.data or []

@app.get("/attendance/alerts")
async def get_attendance_alerts(venue_id: str, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    """Returns late arrivals and unexcused absences for the admin."""
    today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
    
    # Absences
    absences_res = db.table("absences").select("*, profiles!absences_profile_id_fkey(full_name)").eq("venue_id", venue_id).eq("date", today).eq("type", "unexcused").execute()
    
    # Lates today
    lates_res = db.table("attendance_logs").select("*, profiles!attendance_logs_profile_id_fkey(full_name)").eq("venue_id", venue_id).gte("marked_at", f"{today}T00:00:00-04:00").gt("minutes_late", 0).order("marked_at", desc=True).execute()
    
    return {
        "absences": absences_res.data or [],
        "lates": lates_res.data or []
    }

@app.get("/attendance/report")
async def get_attendance_report(venue_id: str, date_from: str, date_to: str, profile_id: Optional[str] = None, db=Depends(get_db), _=Depends(require_permission("attendance.view_reports"))):
    """JSON endpoint for the frontend table preview."""
    query = db.table("v_daily_attendance").select("*").eq("venue_id", venue_id).gte("work_date", date_from).lte("work_date", date_to)
    if profile_id:
        query = query.eq("profile_id", profile_id)
        
    res = query.order("work_date", desc=False).execute()
    return res.data or []

@app.get("/attendance/export")
async def export_attendance_csv(venue_id: str, report_type: str, date_from: str, date_to: str, profile_id: Optional[str] = None, db=Depends(get_db), _=Depends(require_permission("attendance.view_reports"))):
    """Exports attendance data as a CSV file."""
    # Fetch base data
    query = db.table("v_daily_attendance").select("*").eq("venue_id", venue_id).gte("work_date", date_from).lte("work_date", date_to)
    if profile_id:
        query = query.eq("profile_id", profile_id)
    data = query.order("work_date", desc=False).execute().data or []

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "daily":
        writer.writerow(["name", "date", "clock_in", "clock_out", "net_hours", "overtime_hours", "late_minutes", "absence"])
        for row in data:
            writer.writerow([
                row.get("full_name"), row.get("work_date"), 
                row.get("clock_in", "")[11:16] if row.get("clock_in") else "",
                row.get("clock_out", "")[11:16] if row.get("clock_out") else "",
                row.get("net_hours", 0), row.get("overtime_hours", 0),
                row.get("minutes_late", 0), row.get("absence_type", "")
            ])
    
    elif report_type in ["weekly", "custom"]:
        # Group by employee
        employees = {}
        for row in data:
            pid = row["profile_id"]
            if pid not in employees:
                employees[pid] = {"name": row["full_name"], "days": {}, "total_net": 0, "total_ot": 0}
            
            d_str = row["work_date"]
            
            date_col_key = d_str # Use actual date as key to support any length
            employees[pid]["days"][date_col_key] = row
            employees[pid]["total_net"] += float(row.get("net_hours") or 0)
            employees[pid]["total_ot"] += int(row.get("overtime_hours") or 0)

        # Generate headers based on date range
        start_dt = datetime.strptime(date_from, "%Y-%m-%d")
        end_dt = datetime.strptime(date_to, "%Y-%m-%d")
        delta = (end_dt - start_dt).days
        
        headers = ["name"]
        dates_in_range = []
        for i in range(delta + 1):
            curr = (start_dt + timedelta(days=i)).strftime("%Y-%m-%d")
            dates_in_range.append(curr)
            day_prefix = datetime.strptime(curr, "%Y-%m-%d").strftime("%a").lower()[:3]
            headers.extend([f"{curr}_{day_prefix}_net", f"{curr}_{day_prefix}_ot", f"{curr}_{day_prefix}_late", f"{curr}_{day_prefix}_absence"])
        
        headers.extend(["total_net", "total_ot"])
        writer.writerow(headers)

        for pid, emp in employees.items():
            row_data = [emp["name"]]
            for d in dates_in_range:
                day_data = emp["days"].get(d, {})
                row_data.extend([
                    day_data.get("net_hours", 0),
                    day_data.get("overtime_hours", 0),
                    day_data.get("minutes_late", 0),
                    day_data.get("absence_type", "")
                ])
            row_data.extend([round(emp["total_net"], 2), emp["total_ot"]])
            writer.writerow(row_data)

    output.seek(0)
    filename = f"attendance_{report_type}_{date_from}_to_{date_to}.csv"
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


