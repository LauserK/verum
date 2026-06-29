from pydantic import BaseModel
from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime
from decimal import Decimal

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
