from pydantic import BaseModel
from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime
from decimal import Decimal

# ── Models ───────────────────────────────────────────────

class SyncResponse(BaseModel):
    id: str
    role: str
    is_superadmin: bool = False
    organization_is_active: bool = True

class VenueInfo(BaseModel):
    id: str
    name: str

class OrgInfo(BaseModel):
    id: str
    name: str
    venues: List[VenueInfo]
    is_active: bool = True

class ProfileResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    role: str
    is_superadmin: bool = False
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

class EditAttendanceDayRequest(BaseModel):
    profile_id: str
    venue_id: str
    work_date: str  # YYYY-MM-DD
    clock_in: Optional[str] = None  # ISO Format: YYYY-MM-DDTHH:MM:SS or similar
    clock_out: Optional[str] = None # ISO Format: YYYY-MM-DDTHH:MM:SS or similar
    reason: str

# ── Super Admin Models ──────────────────────────────────

class SuperAdminUserOrgUpdate(BaseModel):
    role_id: Optional[str] = None
    role_name: Optional[str] = None # 'admin', 'staff', or custom role name
    venue_ids: Optional[List[str]] = None

class SuperAdminUserOrgAdd(BaseModel):
    organization_id: str
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    venue_ids: Optional[List[str]] = None

class UserOrgDetail(BaseModel):
    id: str
    name: str
    role_id: Optional[str] = None
    role_name: str
    venues: List[VenueInfo]

class SuperAdminUserDetail(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    is_superadmin: bool
    organizations: List[UserOrgDetail]

class SuperAdminUserInOrg(BaseModel):
    id: str
    full_name: Optional[str] = None
    role_name: str

class SuperAdminOrgDetail(BaseModel):
    id: str
    name: str
    is_active: bool
    venues: List[VenueInfo]
    users: List[SuperAdminUserInOrg]

# ── Production & Inventory Models (M16) ──────────────────

class UOMBase(BaseModel):
    id: UUID
    code: str
    name: str

class UOMPresentationCreate(BaseModel):
    name: str
    base_uom_id: UUID
    conversion_factor: float
    is_default: bool = False
    is_global: bool = False

class UOMPresentationResponse(UOMPresentationCreate):
    id: UUID
    org_id: Optional[UUID] = None # Global ones might not have org_id

class ItemCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ItemCategoryResponse(ItemCategoryCreate):
    id: UUID
    org_id: UUID
    is_active: bool

class ItemCreate(BaseModel):
    code: Optional[str] = None
    name: str
    type: str
    category_id: Optional[UUID] = None
    base_uom_id: UUID
    yield_alert_enabled: bool = False
    yield_alert_threshold_pct: Optional[float] = None
    shelf_life_days: Optional[int] = None
    last_purchase_cost: Optional[float] = None
    presentations: List[UOMPresentationCreate] = []

class ItemResponse(BaseModel):
    id: UUID
    org_id: UUID
    code: Optional[str]
    name: str
    type: str
    category_id: Optional[UUID] = None
    base_uom_id: UUID
    uom_name: Optional[str] = None
    last_purchase_cost: Optional[float] = None
    last_purchase_cost_updated_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime

class ItemUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    category_id: Optional[UUID] = None
    base_uom_id: Optional[UUID] = None
    yield_alert_enabled: Optional[bool] = None
    yield_alert_threshold_pct: Optional[float] = None
    shelf_life_days: Optional[int] = None
    last_purchase_cost: Optional[float] = None

class WarehouseCreate(BaseModel):
    name: str
    venue_id: Optional[UUID] = None
    type: str

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    venue_id: Optional[UUID] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None

class WarehouseResponse(WarehouseCreate):
    id: UUID
    org_id: UUID
    is_active: bool

# ── Production & Inventory Models (M17) ──────────────────

class StockMovementResponse(BaseModel):
    id: UUID
    movement_type: str
    warehouse_id: UUID
    item_id: UUID
    qty_base: float
    unit_cost_base: Optional[float]
    total_cost: Optional[float]
    reference_id: Optional[UUID] = None
    reference_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    items: Optional[Dict] = None
    warehouses: Optional[Dict] = None

class PurchaseReceiptLineCreate(BaseModel):
    item_id: UUID
    qty_presentation: float
    presentation_id: Optional[UUID] = None
    unit_cost_presentation: float # Cost per presentation unit
    expiry_date: Optional[str] = None
    lot_number: Optional[str] = None

class PurchaseReceiptCreate(BaseModel):
    warehouse_id: UUID
    supplier: Optional[str] = None
    receipt_number: Optional[str] = None
    date: Optional[str] = None
    lines: List[PurchaseReceiptLineCreate]

class PurchaseReceiptResponse(BaseModel):
    id: UUID
    status: str
    warehouse_id: UUID
    created_at: datetime

class IssueDocumentLineCreate(BaseModel):
    item_id: UUID
    qty_presentation: float
    presentation_id: Optional[UUID] = None

class IssueDocumentCreate(BaseModel):
    warehouse_id: UUID
    reason: str
    notes: Optional[str] = None
    lines: List[IssueDocumentLineCreate]

class IssueDocumentResponse(BaseModel):
    id: UUID
    status: str
    warehouse_id: UUID
    created_at: datetime

# Traslados entre Almacenes (M18)
class TransferLineCreate(BaseModel):
    item_id: UUID
    presentation_id: Optional[UUID] = None
    qty_sent_presentation: float

class TransferCreate(BaseModel):
    origin_warehouse_id: UUID
    destination_warehouse_id: UUID
    notes: Optional[str] = None
    auto_confirm: bool = False
    lines: List[TransferLineCreate]

class TransferLineConfirm(BaseModel):
    id: UUID # ID of the transfer_document_line
    qty_received_presentation: float

class TransferConfirm(BaseModel):
    notes: Optional[str] = None
    lines: List[TransferLineConfirm]

class TransferResponse(BaseModel):
    id: UUID
    status: str
    origin_warehouse_id: UUID
    destination_warehouse_id: UUID
    created_at: datetime

# ── Recipes & Production (M19) ───────────────────────────

class RecipeIngredientBase(BaseModel):
    item_id: UUID
    qty_base: Decimal
    presentation_id: Optional[UUID] = None
    order_index: int
    notes: Optional[str] = None

class RecipeStepBase(BaseModel):
    order_index: int
    description: str
    estimated_time_minutes: int = 0

class RecipeCreate(BaseModel):
    item_id: UUID
    yield_qty_base: Decimal
    yield_presentation_id: Optional[UUID] = None
    ingredients: List[RecipeIngredientBase]
    steps: List[RecipeStepBase]

class RecipeResponse(BaseModel):
    id: UUID
    item_id: UUID
    yield_qty_base: Decimal
    yield_presentation_id: Optional[UUID] = None
    yield_presentation: Optional[Dict] = None # Added for scaling info
    ingredients: List[Dict]
    steps: List[Dict]
    is_active: bool
    created_at: datetime

class RecipeBriefResponse(BaseModel):
    id: UUID
    item_id: UUID
    item_name: str
    item_code: Optional[str] = None
    item_type: str
    yield_qty_base: Decimal
    created_at: datetime

class CalculateProductionNeedsRequest(BaseModel):
    item_id: UUID
    target_qty: Decimal
    target_uom_id: Optional[UUID] = None
    warehouse_id: UUID

class IngredientDeficit(BaseModel):
    item_id: UUID
    item_name: str
    needed_base_qty: Decimal
    available_base_qty: Decimal
    deficit_base_qty: Decimal

class ProductionNeedsResponse(BaseModel):
    status: str # "OK" or "DEFICIT"
    ingredients: List[Dict] # Scaled ingredients
    deficits: List[IngredientDeficit]

class ProductionOrderCreate(BaseModel):
    item_id: UUID
    warehouse_id: UUID
    qty_ordered_base: Decimal
    presentation_id: Optional[UUID] = None
    scheduled_date: str # YYYY-MM-DD
    priority: str = "normal"

class ProductionOrderResponse(BaseModel):
    id: UUID
    order_number: str
    item_id: UUID
    recipe_id: UUID
    warehouse_id: UUID
    qty_ordered_base: Decimal
    qty_produced_base: Optional[Decimal] = None
    presentation_id: Optional[UUID] = None
    uom_presentations: Optional[Dict] = None
    status: str
    priority: str
    scheduled_date: Optional[str]
    created_at: Optional[datetime]
    items: Optional[Dict] = None
    warehouses: Optional[Dict] = None
    assigned_to_profile: Optional[Dict] = None

class OrderStatusUpdate(BaseModel):
    status: str # pending, in_progress, paused, cancelled

class OrderConsumptionUpdate(BaseModel):
    item_id: UUID
    qty_actual_base: Decimal

class OrderCompleteRequest(BaseModel):
    qty_produced_base: Decimal
    ignore_variance: bool = False
    consumptions: Optional[List[OrderConsumptionUpdate]] = None

class ProductionOrderDetailResponse(ProductionOrderResponse):
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    yield_alert_triggered: bool = False
    yield_variance_pct: Optional[float] = None
    notes: Optional[str] = None
    created_by_profile: Optional[Dict] = None
    assigned_to_profile: Optional[Dict] = None
    origin_warehouse: Optional[Dict] = None
    target_warehouse: Optional[Dict] = None
    consumptions: List[Dict] = []
    produced_lots: List[Dict] = []

# ── Catering & MRP (M22) ─────────────────────────────────

class CateringRequestLineBase(BaseModel):
    item_id: UUID
    qty_base: Decimal
    presentation_id: Optional[UUID] = None
    qty_presentation: Optional[Decimal] = None

class CateringRequestCreate(BaseModel):
    name: str
    event_date: Optional[str] = None
    notes: Optional[str] = None
    tentative_production_date: Optional[str] = None
    buffer_percentage: Optional[float] = 0.0
    lines: List[CateringRequestLineBase]

class CateringRequestResponse(BaseModel):
    id: UUID
    name: str
    event_date: Optional[str] = None
    notes: Optional[str] = None
    status: str
    tentative_production_date: Optional[str] = None
    buffer_percentage: Optional[float] = 0.0
    created_at: datetime

class MRPPlanRequest(BaseModel):
    warehouse_id: UUID

class MRPProductionPlan(BaseModel):
    item_id: str
    item_name: str
    uom_name: str
    qty_to_produce: float
    recipe_id: str

class MRPPurchaseList(BaseModel):
    item_id: str
    item_name: str
    uom_name: str
    qty_needed: float
    qty_available: float
    qty_deficit: float
    
class MRPResultResponse(BaseModel):
    production_plan: List[MRPProductionPlan]
    purchase_list: List[MRPPurchaseList]

class GenerateOrdersRequest(BaseModel):
    warehouse_id: UUID
    target_warehouse_id: UUID
    scheduled_date: str


# M39: Physical Inventory Count Schemas
class PhysicalInventoryLineCreate(BaseModel):
    item_id: UUID
    qty_counted_base: Decimal
    presentation_id: Optional[UUID] = None
    qty_presentation: Optional[Decimal] = None
    notes: Optional[str] = None


class PhysicalInventoryCreate(BaseModel):
    warehouse_id: UUID
    notes: Optional[str] = None
    lines: List[PhysicalInventoryLineCreate]


class PhysicalInventoryLineResponse(BaseModel):
    id: UUID
    item_id: UUID
    item_name: Optional[str] = None
    qty_expected_base: Decimal
    qty_counted_base: Decimal
    presentation_id: Optional[UUID] = None
    presentation_name: Optional[str] = None
    qty_presentation: Optional[Decimal] = None
    notes: Optional[str] = None


class PhysicalInventoryResponse(BaseModel):
    id: UUID
    org_id: UUID
    warehouse_id: UUID
    warehouse_name: Optional[str] = None
    document_number: str
    status: str
    notes: Optional[str] = None
    created_by: UUID
    creator_name: Optional[str] = None
    processed_by: Optional[UUID] = None
    processor_name: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
    lines: List[PhysicalInventoryLineResponse]


class PhysicalInventoryBriefResponse(BaseModel):
    id: UUID
    warehouse_id: UUID
    warehouse_name: Optional[str] = None
    document_number: str
    status: str
    notes: Optional[str] = None
    creator_name: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime


# M23: Stock Snapshot and Valuation Schemas
class StockSnapshotItem(BaseModel):
    item_id: UUID
    item_name: str
    item_code: Optional[str] = None
    uom_name: Optional[str] = None
    warehouse_id: UUID
    warehouse_name: str
    qty_on_hand: float
    valuation: float

class StockSnapshotResponse(BaseModel):
    date: str
    items: List[StockSnapshotItem]
    total_valuation: float

class StockValuationLotDetail(BaseModel):
    lot_id: UUID
    lot_number: Optional[str] = None
    qty_base: float
    unit_cost_base: float
    valuation: float
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    received_at: str

class StockValuationItem(BaseModel):
    item_id: UUID
    item_name: str
    item_code: Optional[str] = None
    uom_name: Optional[str] = None
    warehouse_id: UUID
    warehouse_name: str
    qty_on_hand: float
    valuation: float
    lots_detail: List[StockValuationLotDetail]

class StockValuationResponse(BaseModel):
    items: List[StockValuationItem]
    total_valuation: float


