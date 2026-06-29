from pydantic import BaseModel
from typing import Optional, List

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
    schedule: Optional[List[int]] = None  # [0=Sun..6=Sat]
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
    questions: List[ReorderItem]

class CreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "staff"  # 'admin' or 'staff'
    organization_id: str
    venue_ids: Optional[List[str]] = None
    venue_id: Optional[str] = None
    shift_id: Optional[str] = None

class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    venue_ids: Optional[List[str]] = None
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

class RoleCreate(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None
    is_admin: bool = False

class OverrideCreate(BaseModel):
    permission_key: str
    granted: bool
    reason: Optional[str] = None
