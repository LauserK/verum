from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
import pytz
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

CARACAS_TZ = pytz.timezone("America/Caracas")

from database import supabase
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
        existing = supabase.table("profiles").select("*").eq("id", user.id).execute()

        if existing.data and len(existing.data) > 0:
            return {"id": user.id, "role": existing.data[0].get("role")}

        new_profile = {
            "id": user.id,
            "role": "staff",
            "full_name": user.user_metadata.get("full_name", user.email) if user else "",
        }
        supabase.table("profiles").insert(new_profile).execute()

        return {"id": user.id, "role": "staff"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/me", response_model=ProfileResponse)
async def get_profile(user=Depends(get_current_user)):
    """Returns the authenticated user's profile with their venues."""
    try:
        result = supabase.table("profiles").select("*").eq("id", user.id).execute()
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        profile = result.data[0]
        org_id = profile.get("organization_id")

        # Fetch venues for the user's organization
        venues = []
        if org_id:
            venues_res = (
                supabase.table("venues")
                .select("id, name")
                .eq("org_id", org_id)
                .execute()
            )
            venues = venues_res.data or []

        return {
            "id": profile["id"],
            "full_name": profile.get("full_name"),
            "role": profile.get("role", "staff"),
            "organization_id": org_id,
            "venues": venues,
            "venue_id": profile.get("venue_id"),
            "shift_id": profile.get("shift_id"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/checklists/{venue_id}", response_model=list[ChecklistItem])
async def get_checklists(venue_id: str, user=Depends(get_current_user)):
    """
    Returns checklist templates for a venue with their computed status
    for the current shift. Handles prerequisite locking.
    """
    try:
        shift = get_current_shift()
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")

        # 1. Get all templates for this venue
        templates_res = (
            supabase.table("checklist_templates")
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
            supabase.table("questions")
            .select("id, template_id")
            .in_("template_id", template_ids)
            .execute()
        )
        questions_by_template: dict[str, int] = {}
        for q in (questions_res.data or []):
            tid = q["template_id"]
            questions_by_template[tid] = questions_by_template.get(tid, 0) + 1

        # 3. Get today's submissions for the current shift and user
        submissions_res = (
            supabase.table("submissions")
            .select("*")
            .eq("venue_id", venue_id)
            .eq("user_id", user.id)
            .eq("shift", shift)
            .gte("created_at", f"{today}T00:00:00-04:00")
            .in_("template_id", template_ids)
            .execute()
        )
        submissions_map: dict = {}
        for s in (submissions_res.data or []):
            submissions_map[s["template_id"]] = s

        # 4. Get answer counts for these submissions
        submission_ids = [s["id"] for s in submissions_map.values()]
        answers_counts: dict[str, int] = {}
        
        if submission_ids:
            answers_res = (
                supabase.table("answers")
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
        result: list[dict] = []
        for t in templates:
            # If due_date is set, only show the checklist on that specific date
            tmpl_due_date = t.get("due_date")
            if tmpl_due_date and tmpl_due_date != today:
                continue

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


@app.post("/submissions")
async def create_submission(body: CreateSubmissionRequest, user=Depends(get_current_user)):
    """
    Creates a draft submission when opening a checklist.
    Idempotent: returns existing submission (draft or completed) if one
    already exists for the same user/template/shift/today.
    """
    try:
        shift = get_current_shift()
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")

        # Check for ANY existing submission today (completed or draft)
        existing = (
            supabase.table("submissions")
            .select("*")
            .eq("template_id", body.template_id)
            .eq("user_id", user.id)
            .eq("shift", shift)
            .gte("created_at", f"{today}T00:00:00-04:00")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

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
        result = supabase.table("submissions").insert(new_sub).execute()
        return result.data[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/submissions/{submission_id}", response_model=SubmissionDetail)
async def get_submission(submission_id: str, user=Depends(get_current_user)):
    """
    Returns a submission with its questions and any existing answers.
    """
    try:
        # Get submission
        sub_res = (
            supabase.table("submissions")
            .select("*")
            .eq("id", submission_id)
            .execute()
        )
        if not sub_res.data or len(sub_res.data) == 0:
            raise HTTPException(status_code=404, detail="Submission not found")

        sub = sub_res.data[0]

        # Get template info
        tmpl_res = (
            supabase.table("checklist_templates")
            .select("title")
            .eq("id", sub["template_id"])
            .execute()
        )
        template_title = tmpl_res.data[0]["title"] if tmpl_res.data else "Checklist"

        # Get questions ordered by sort_order
        questions_res = (
            supabase.table("questions")
            .select("*")
            .eq("template_id", sub["template_id"])
            .order("sort_order")
            .execute()
        )
        questions = questions_res.data or []

        # Get existing answers
        answers_res = (
            supabase.table("answers")
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
    user=Depends(get_current_user),
):
    """
    Updates submission fields: status, auditor_notes, auditor_confirmed, answers.
    When status='completed', sets completed_at.
    """
    try:
        # Save answers if provided
        if body.answers:
            now_iso = datetime.now(timezone.utc).isoformat()
            for ans in body.answers:
                supabase.table("answers").upsert(
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
            supabase.table("submissions").update(update).eq("id", submission_id).execute()

        return {"ok": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BulkAnswersRequest(BaseModel):
    answers: list[dict]  # [{question_id, value, answered_at}]


@app.put("/submissions/{submission_id}/answers")
async def bulk_save_answers(
    submission_id: str,
    body: BulkAnswersRequest,
    user=Depends(get_current_user),
):
    """
    Bulk upsert answers for auto-save. Updates last_saved_at.
    Sets started_at on first save.
    """
    try:
        # Upsert all answers
        for ans in body.answers:
            upsert_data = {
                "submission_id": submission_id,
                "question_id": ans["question_id"],
                "value": ans.get("value", ""),
            }
            if "answered_at" in ans:
                upsert_data["answered_at"] = ans["answered_at"]

            supabase.table("answers").upsert(
                upsert_data,
                on_conflict="submission_id,question_id",
            ).execute()

        # Update last_saved_at + set started_at if first save
        now_iso = datetime.now(timezone.utc).isoformat()

        sub_res = (
            supabase.table("submissions")
            .select("started_at")
            .eq("id", submission_id)
            .execute()
        )
        update_payload: dict = {"last_saved_at": now_iso}
        if sub_res.data and sub_res.data[0].get("started_at") is None:
            update_payload["started_at"] = now_iso

        supabase.table("submissions").update(update_payload).eq("id", submission_id).execute()

        return {"ok": True, "saved": len(body.answers)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Admin Helpers ────────────────────────────────────────

async def require_admin(user=Depends(get_current_user)):
    """Dependency that ensures the user has admin role."""
    profile_res = supabase.table("profiles").select("role").eq("id", user.id).execute()
    if not profile_res.data or profile_res.data[0].get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


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
async def list_organizations(user=Depends(require_admin)):
    res = supabase.table("organizations").select("*").execute()
    return res.data or []


@app.post("/admin/organizations")
async def create_organization(body: CreateOrgRequest, user=Depends(require_admin)):
    res = supabase.table("organizations").insert({"name": body.name}).execute()
    return res.data[0]


@app.get("/admin/organizations/{org_id}/venues")
async def list_venues(org_id: str, user=Depends(require_admin)):
    res = supabase.table("venues").select("*").eq("org_id", org_id).execute()
    return res.data or []


@app.post("/admin/venues")
async def create_venue(body: CreateVenueRequest, user=Depends(require_admin)):
    payload = {"org_id": body.org_id, "name": body.name}
    if body.address:
        payload["address"] = body.address
    res = supabase.table("venues").insert(payload).execute()
    return res.data[0]


@app.put("/admin/venues/{venue_id}")
async def update_venue(venue_id: str, body: UpdateVenueRequest, user=Depends(require_admin)):
    payload = {}
    if body.name is not None:
        payload["name"] = body.name
    if body.address is not None:
        payload["address"] = body.address
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = supabase.table("venues").update(payload).eq("id", venue_id).execute()
    return res.data[0] if res.data else {}


@app.delete("/admin/venues/{venue_id}")
async def delete_venue(venue_id: str, user=Depends(require_admin)):
    supabase.table("venues").delete().eq("id", venue_id).execute()
    return {"ok": True}


# ── Admin Users CRUD ────────────────────────────────────

@app.get("/admin/users")
async def list_users(user=Depends(require_admin)):
    """List all profiles in the admin's organization."""
    admin_profile = supabase.table("profiles").select("organization_id").eq("id", user.id).single().execute()
    org_id = admin_profile.data.get("organization_id")
    if not org_id:
        return []
    res = supabase.table("profiles").select("id, full_name, role, organization_id, venue_id, shift_id").eq("organization_id", org_id).execute()
    # Get emails from auth users
    profiles = res.data or []
    for p in profiles:
        try:
            auth_user = supabase.auth.admin.get_user_by_id(p["id"])
            p["email"] = auth_user.user.email if auth_user.user else None
        except Exception:
            p["email"] = None
    return profiles


@app.post("/admin/users")
async def create_user(body: CreateUserRequest, user=Depends(require_admin)):
    """Create a new user via Supabase Auth admin API + profile."""
    try:
        auth_res = supabase.auth.admin.create_user({
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
        supabase.table("profiles").upsert(profile_data).execute()

        return {"id": new_user.id, "email": body.email, "full_name": body.full_name, "role": body.role, "venue_id": body.venue_id, "shift_id": body.shift_id, "organization_id": body.organization_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@app.put("/admin/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserRequest, user=Depends(require_admin)):
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
    res = supabase.table("profiles").update(payload).eq("id", user_id).execute()
    return res.data[0] if res.data else {}


@app.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, user=Depends(require_admin)):
    """Delete auth user (cascades to profile)."""
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@app.patch("/admin/users/{user_id}/password")
async def change_user_password(user_id: str, body: dict, user=Depends(require_admin)):
    """Change a user's password via Supabase Auth admin API."""
    new_password = body.get("password")
    if not new_password or len(new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    try:
        supabase.auth.admin.update_user_by_id(user_id, {"password": new_password})
    except Exception as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


# ── Admin Shifts CRUD ───────────────────────────────────

@app.get("/admin/venues/{venue_id}/shifts")
async def list_shifts(venue_id: str, user=Depends(require_admin)):
    res = supabase.table("shifts").select("*").eq("venue_id", venue_id).order("sort_order").execute()
    return res.data or []


@app.post("/admin/shifts")
async def create_shift(body: CreateShiftRequest, user=Depends(require_admin)):
    payload = {
        "venue_id": body.venue_id,
        "name": body.name,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "sort_order": body.sort_order,
    }
    res = supabase.table("shifts").insert(payload).execute()
    return res.data[0]


@app.put("/admin/shifts/{shift_id}")
async def update_shift(shift_id: str, body: UpdateShiftRequest, user=Depends(require_admin)):
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
    res = supabase.table("shifts").update(payload).eq("id", shift_id).execute()
    return res.data[0] if res.data else {}


@app.delete("/admin/shifts/{shift_id}")
async def delete_shift(shift_id: str, user=Depends(require_admin)):
    supabase.table("shifts").delete().eq("id", shift_id).execute()
    return {"ok": True}


# ── Public: Shifts for a venue (staff) ──────────────────

@app.get("/venues/{venue_id}/shifts")
async def get_venue_shifts(venue_id: str, user=Depends(get_current_user)):
    res = supabase.table("shifts").select("*").eq("venue_id", venue_id).order("sort_order").execute()
    return res.data or []


@app.get("/admin/venues/{venue_id}/templates")
async def list_templates(venue_id: str, user=Depends(require_admin)):
    res = (
        supabase.table("checklist_templates")
        .select("*")
        .eq("venue_id", venue_id)
        .execute()
    )
    return res.data or []


@app.post("/admin/templates")
async def create_template(body: CreateTemplateRequest, user=Depends(require_admin)):
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

    res = supabase.table("checklist_templates").insert(payload).execute()
    return res.data[0]


@app.put("/admin/templates/{template_id}")
async def update_template(template_id: str, body: CreateTemplateRequest, user=Depends(require_admin)):
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

    res = supabase.table("checklist_templates").update(payload).eq("id", template_id).execute()
    return res.data[0] if res.data else {"ok": True}


@app.delete("/admin/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(require_admin)):
    supabase.table("checklist_templates").delete().eq("id", template_id).execute()
    return {"ok": True}


@app.get("/admin/templates/{template_id}/questions")
async def list_questions(template_id: str, user=Depends(require_admin)):
    res = (
        supabase.table("questions")
        .select("*")
        .eq("template_id", template_id)
        .order("sort_order")
        .execute()
    )
    return res.data or []


@app.post("/admin/questions")
async def create_question(body: CreateQuestionRequest, user=Depends(require_admin)):
    payload = {
        "template_id": body.template_id,
        "label": body.label,
        "type": body.type,
        "is_required": body.is_required,
        "sort_order": body.sort_order,
    }
    if body.config:
        payload["config"] = body.config
    res = supabase.table("questions").insert(payload).execute()
    return res.data[0]


@app.put("/admin/questions/{question_id}")
async def update_question(question_id: str, body: CreateQuestionRequest, user=Depends(require_admin)):
    payload = {
        "label": body.label,
        "type": body.type,
        "is_required": body.is_required,
        "sort_order": body.sort_order,
    }
    if body.config is not None:
        payload["config"] = body.config
    res = supabase.table("questions").update(payload).eq("id", question_id).execute()
    return res.data[0] if res.data else {"ok": True}


@app.delete("/admin/questions/{question_id}")
async def delete_question(question_id: str, user=Depends(require_admin)):
    supabase.table("questions").delete().eq("id", question_id).execute()
    return {"ok": True}


# ── Admin Submissions List ──────────────────────────────

@app.get("/admin/submissions")
async def list_submissions(
    venue_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_admin),
):
    """Lists submissions with optional filters."""
    query = supabase.table("submissions").select(
        "*, profiles(full_name), checklist_templates(title)"
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
    user=Depends(require_admin),
):
    """
    Returns compliance metrics:
    - total_expected: templates × days in range
    - completed_on_time, completed_late, missing
    - critical_issues, non_critical_issues
    - avg_execution_minutes
    """
    try:
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
        d_from = date_from or today
        d_to = date_to or today

        # Get templates
        tmpl_query = supabase.table("checklist_templates").select("id, venue_id, due_time, due_date, frequency, schedule")
        if venue_id:
            tmpl_query = tmpl_query.eq("venue_id", venue_id)
        templates = (tmpl_query.execute()).data or []

        if not templates:
            return {
                "total_expected": 0, "completed_on_time": 0,
                "completed_late": 0, "missing": 0,
                "critical_issues": 0, "non_critical_issues": 0,
                "avg_execution_minutes": 0,
            }

        template_ids = [t["id"] for t in templates]

        # Get submissions in date range (using Caracas offset -04:00)
        sub_query = (
            supabase.table("submissions")
            .select("id, template_id, status, started_at, completed_at, created_at, shift")
            .in_("template_id", template_ids)
            .gte("created_at", f"{d_from}T00:00:00-04:00")
            .lte("created_at", f"{d_to}T23:59:59-04:00")
        )
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
            shifts_res = supabase.table("shifts").select("venue_id").in_("venue_id", venue_ids).execute()
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
            day_of_week = curr_date.weekday() # 0 = Monday, 6 = Sunday
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
                supabase.table("answers")
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

