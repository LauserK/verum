from pydantic import BaseModel
from typing import Optional, List

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
