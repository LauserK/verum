from pydantic import BaseModel
from typing import Optional, List, Dict

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
    custom_title: Optional[str] = None
    is_private: bool = False

class CreateSubmissionRequest(BaseModel):
    template_id: str
    venue_id: str
    custom_title: Optional[str] = None
    is_private: bool = False

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
    questions: List[SubmissionQuestion]
    auditor_notes: Optional[str] = None
    auditor_confirmed: bool = False
    custom_title: Optional[str] = None
    is_private: bool = False

class PatchSubmissionRequest(BaseModel):
    status: Optional[str] = None
    auditor_notes: Optional[str] = None
    auditor_confirmed: Optional[bool] = None
    answers: Optional[List[dict]] = None  # [{question_id, value}]

class HistoryItem(BaseModel):
    id: str
    template_title: str
    shift: str
    completed_at: str
    total_questions: int
    venue_name: Optional[str] = None
    started_at: Optional[str] = None
    custom_title: Optional[str] = None
    is_private: bool = False

class BulkAnswersRequest(BaseModel):
    answers: List[dict]  # [{question_id, value, answered_at}]
