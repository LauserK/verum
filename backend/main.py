from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from database import supabase
from config import settings

app = FastAPI(title="VERUM API")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# ── Helpers ──────────────────────────────────────────────

def get_current_shift() -> str:
    """Returns the current shift based on local hour."""
    hour = datetime.now().hour
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


class ChecklistItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    frequency: Optional[str] = None
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
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

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
            .gte("created_at", f"{today}T00:00:00Z")
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
            tid = t["id"]
            total_q = questions_by_template.get(tid, 0)
            sub = submissions_map.get(tid)

            # Determine status
            prereq = t.get("prerequisite_template_id")
            if prereq and prereq not in completed_ids:
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
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Check for ANY existing submission today (completed or draft)
        existing = (
            supabase.table("submissions")
            .select("*")
            .eq("template_id", body.template_id)
            .eq("user_id", user.id)
            .eq("shift", shift)
            .gte("created_at", f"{today}T00:00:00Z")
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
            for ans in body.answers:
                supabase.table("answers").upsert(
                    {
                        "submission_id": submission_id,
                        "question_id": ans["question_id"],
                        "value": ans.get("value", ""),
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

        # Update last_saved_at
        supabase.table("submissions").update(
            {"last_saved_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", submission_id).execute()

        return {"ok": True, "saved": len(body.answers)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
