from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime

# --- Supplier Contacts ---
class SupplierContactCreate(BaseModel):
    name: str
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool = False

class SupplierContactResponse(SupplierContactCreate):
    id: UUID
    supplier_id: UUID

# --- Suppliers ---
class SupplierCreate(BaseModel):
    name: str
    code: Optional[str] = None
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: int = 0
    credit_limit: Optional[float] = None
    currency: str = "USD"
    status: str = "active"
    notes: Optional[str] = None
    contacts: Optional[List[SupplierContactCreate]] = None

class SupplierResponse(BaseModel):
    id: UUID
    org_id: UUID
    code: Optional[str]
    name: str
    tax_id: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    payment_terms_days: int
    credit_limit: Optional[float]
    currency: str
    status: str
    score: Optional[float]
    notes: Optional[str]
    created_at: datetime
    contacts: List[SupplierContactResponse] = []

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: Optional[int] = None
    credit_limit: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

# --- Supplier Items ---
class SupplierItemCreate(BaseModel):
    item_id: UUID
    supplier_sku: Optional[str] = None
    lead_time_days: Optional[int] = None
    is_preferred: bool = False

class SupplierItemResponse(SupplierItemCreate):
    supplier_id: UUID
    item_name: Optional[str] = None

# --- Supplier Price Lists ---
class SupplierPriceListItemCreate(BaseModel):
    item_id: UUID
    unit_cost_base: float
    presentation_id: Optional[UUID] = None
    unit_cost_presentation: Optional[float] = None
    min_qty_base: Optional[float] = None
    notes: Optional[str] = None

class SupplierPriceListItemResponse(SupplierPriceListItemCreate):
    id: UUID
    price_list_id: UUID

class SupplierPriceListCreate(BaseModel):
    name: str
    valid_from: date
    valid_until: Optional[date] = None
    is_active: bool = True
    items: List[SupplierPriceListItemCreate]

class SupplierPriceListResponse(BaseModel):
    id: UUID
    supplier_id: UUID
    name: str
    valid_from: date
    valid_until: Optional[date] = None
    is_active: bool
    created_at: datetime
    items: List[SupplierPriceListItemResponse] = []

# --- PO Approval Limits & Config ---
class POApprovalLimitCreate(BaseModel):
    role_id: UUID
    max_amount: Optional[float] = None

class POApprovalLimitResponse(POApprovalLimitCreate):
    id: UUID
    org_id: UUID

class POApprovalConfigResponse(BaseModel):
    id: UUID
    org_id: UUID
    creator_can_approve_own: bool
    require_approval_above: float

class POApprovalConfigUpdate(BaseModel):
    creator_can_approve_own: Optional[bool] = None
    require_approval_above: Optional[float] = None
