from pydantic import BaseModel
from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime
from decimal import Decimal

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
    min_stock: float = 0.0
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
    min_stock: float = 0.0
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
    min_stock: Optional[float] = None

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

class StockAdjustItem(BaseModel):
    item_code: str
    qty_counted: float

class BulkStockAdjustRequest(BaseModel):
    warehouse_id: UUID
    adjustments: List[StockAdjustItem]

class StockAdjustResult(BaseModel):
    item_code: str
    status: str  # "success" or "error"
    error_message: Optional[str] = None
    qty_expected: Optional[float] = None
    qty_counted: Optional[float] = None
    difference: Optional[float] = None

class BulkStockAdjustResponse(BaseModel):
    results: List[StockAdjustResult]

class LowStockAlertItem(BaseModel):
    item_id: UUID
    item_name: str
    item_code: Optional[str] = None
    uom_code: str
    warehouse_name: str
    qty_base: float
    qty_reserved: float
    qty_available: float
    min_stock: float
