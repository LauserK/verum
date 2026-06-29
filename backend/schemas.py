"""
schemas.py — Legacy compatibility shim
---------------------------------------
All Pydantic models have been migrated to their respective domain packages:
  app/auth/schemas.py
  app/checklists/schemas.py
  app/admin/schemas.py
  app/inventory/schemas.py
  app/attendance/schemas.py
  app/superadmin/schemas.py
  app/production/schemas.py
  app/catering/schemas.py
  app/transfers/schemas.py

This file re-exports everything so code that still imports from `schemas`
continues to work without changes.
"""

# ── Auth Models ──────────────────────────────────────────
from app.auth.schemas import (
    SyncResponse, VenueInfo, OrgInfo, ProfileResponse
)

# ── Checklist Models ─────────────────────────────────────
from app.checklists.schemas import (
    ChecklistItem, CreateSubmissionRequest, SubmissionQuestion,
    SubmissionDetail, PatchSubmissionRequest, HistoryItem, BulkAnswersRequest
)

# ── Admin Models ─────────────────────────────────────────
from app.admin.schemas import (
    CreateOrgRequest, CreateVenueRequest, CreateTemplateRequest,
    CreateQuestionRequest, ReorderItem, ReorderQuestionsRequest,
    CreateUserRequest, UpdateUserRequest, UpdateVenueRequest,
    CreateShiftRequest, UpdateShiftRequest, RoleCreate, OverrideCreate
)

# ── Inventory Models ──────────────────────────────────────
from app.inventory.schemas import (
    CreateAssetCategoryRequest, UpdateAssetCategoryRequest,
    CreateAssetRequest, UpdateAssetRequest, AssetReviewRequest,
    CreateUtensilCategoryRequest, UpdateUtensilCategoryRequest,
    CreateUtensilRequest, UpdateUtensilRequest,
    CreateTicketRequest, CreateTicketEntryRequest, CloseTicketRequest,
    UtensilMovementRequest, UtensilCountItemSchema, CreateUtensilCountRequest,
    ConfirmCountItemSchema, ConfirmCountRequest,
    CreateCountScheduleRequest, UpdateCountScheduleRequest
)

# ── Attendance Models ─────────────────────────────────────
from app.attendance.schemas import (
    EmployeeShiftRequest, ShiftDayRequest, MarkAttendanceRequest,
    AbsenceRequest, LeaveRequest, AbsenceApprovalRequest,
    ManualAttendanceRequest, EditAttendanceDayRequest
)

# ── Superadmin Models ─────────────────────────────────────
from app.superadmin.schemas import (
    SuperAdminUserOrgUpdate, SuperAdminUserOrgAdd, UserOrgDetail,
    SuperAdminUserDetail, SuperAdminUserInOrg, SuperAdminOrgDetail
)

# ── Production & Inventory Models (M16) ──────────────────
from app.production.schemas import (
    UOMBase, UOMPresentationCreate, UOMPresentationResponse,
    ItemCategoryCreate, ItemCategoryResponse,
    ItemCreate, ItemResponse, ItemUpdate,
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    StockMovementResponse, PurchaseReceiptLineCreate, PurchaseReceiptCreate,
    PurchaseReceiptResponse, IssueDocumentLineCreate, IssueDocumentCreate,
    IssueDocumentResponse, PhysicalInventoryLineCreate, PhysicalInventoryCreate,
    PhysicalInventoryLineResponse, PhysicalInventoryResponse,
    PhysicalInventoryBriefResponse, StockSnapshotItem, StockSnapshotResponse,
    StockValuationLotDetail, StockValuationItem, StockValuationResponse,
    StockAdjustItem, BulkStockAdjustRequest, StockAdjustResult,
    BulkStockAdjustResponse, LowStockAlertItem
)

# ── Catering & Recipes Models ─────────────────────────────
from app.catering.schemas import (
    RecipeIngredientBase, RecipeStepBase, RecipeCreate, RecipeResponse,
    RecipeBriefResponse, CalculateProductionNeedsRequest, IngredientDeficit,
    ProductionNeedsResponse, ProductionOrderCreate, ProductionOrderResponse,
    OrderStatusUpdate, OrderConsumptionUpdate, OrderCompleteRequest,
    ProductionOrderDetailResponse, CateringRequestLineBase,
    CateringRequestCreate, CateringRequestResponse, MRPPlanRequest,
    MRPProductionPlan, MRPPurchaseList, MRPResultResponse, GenerateOrdersRequest
)

# ── Transfers Models ──────────────────────────────────────
from app.transfers.schemas import (
    TransferLineCreate, TransferCreate, TransferLineConfirm,
    TransferConfirm, TransferResponse
)
