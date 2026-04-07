from pydantic import BaseModel
from typing import Optional, List

# ── Models ───────────────────────────────────────────────

class SyncResponse(BaseModel):
    id: str
    role: str

class VenueInfo(BaseModel):
    id: str
    name: str

class OrgInfo(BaseModel):
    id: str
    name: str
    venues: List[VenueInfo]

class ProfileResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    role: str
    organizations: List[OrgInfo] = []
    organization_id: Optional[str] = None
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
    questions: List[SubmissionQuestion]
    auditor_notes: Optional[str] = None
    auditor_confirmed: bool = False

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

class BulkAnswersRequest(BaseModel):
    answers: List[dict]  # [{question_id, value, answered_at}]

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
    attachments: Optional[List[str]] = None  # Array of URLs
    next_action: Optional[str] = None
    status_after: Optional[str] = None  # abierto, en_progreso, esperando, resuelto

class CloseTicketRequest(BaseModel):
    description: str = "Reparación completada y verificada."
    cost: Optional[float] = None
    attachments: Optional[List[str]] = None

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
    items: List[UtensilCountItemSchema]
    schedule_id: Optional[str] = None

class ConfirmCountItemSchema(BaseModel):
    utensil_id: str
    confirmed_count: int

class ConfirmCountRequest(BaseModel):
    items: List[ConfirmCountItemSchema]

# ── Inventory: Count Schedules Models (M11.2) ──

class CreateCountScheduleRequest(BaseModel):
    venue_id: str
    assigned_to: Optional[str] = None
    name: str
    frequency: str
    scope: str
    category_id: Optional[str] = None
    next_due: str  # YYYY-MM-DD
    item_ids: Optional[List[str]] = None

class UpdateCountScheduleRequest(BaseModel):
    venue_id: Optional[str] = None
    assigned_to: Optional[str] = None
    name: Optional[str] = None
    frequency: Optional[str] = None
    scope: Optional[str] = None
    category_id: Optional[str] = None
    next_due: Optional[str] = None
    is_active: Optional[bool] = None
    item_ids: Optional[List[str]] = None

# ── Attendance: Shifts Models (M13) ──

class EmployeeShiftRequest(BaseModel):
    profile_id: str
    venue_id: str
    modality: str
    weekdays: Optional[List[int]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_active: bool = True

class ShiftDayRequest(BaseModel):
    weekday: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    day_off: bool = False

# ── Attendance: Marking Models (M13) ──

class MarkAttendanceRequest(BaseModel):
    event_type: str # clock_in, clock_out, break_start, break_end
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    gps_accuracy_m: Optional[int] = None
    venue_id: str

class AbsenceRequest(BaseModel):
    profile_id: str
    venue_id: str
    date: str
    type: str
    reason: Optional[str] = None

class LeaveRequest(BaseModel):
    date: str  # YYYY-MM-DD
    type: str  # 'leave', 'sick', 'holiday'
    reason: Optional[str] = None
    venue_id: str

class AbsenceApprovalRequest(BaseModel):
    status: str  # 'approved', 'rejected'
    admin_comment: Optional[str] = None

class ManualAttendanceRequest(BaseModel):
    profile_id: str
    venue_id: str
    clock_in: str  # ISO Format: YYYY-MM-DDTHH:MM:SS
    clock_out: str # ISO Format: YYYY-MM-DDTHH:MM:SS
    reason: str
