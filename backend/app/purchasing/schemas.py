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
    matching_tolerance_pct: float

class POApprovalConfigUpdate(BaseModel):
    creator_can_approve_own: Optional[bool] = None
    require_approval_above: Optional[float] = None
    matching_tolerance_pct: Optional[float] = None

# --- Purchase Orders ---
class PurchaseOrderLineCreate(BaseModel):
    item_id: UUID
    qty_ordered_base: float
    presentation_id: Optional[UUID] = None
    qty_ordered_presentation: Optional[float] = None
    unit_cost_base: float
    unit_cost_presentation: Optional[float] = None

class PurchaseOrderLineResponse(BaseModel):
    id: UUID
    po_id: UUID
    item_id: UUID
    qty_ordered_base: float
    presentation_id: Optional[UUID] = None
    qty_ordered_presentation: Optional[float] = None
    qty_received_base: float
    qty_pending_base: float
    unit_cost_base: float
    unit_cost_presentation: Optional[float] = None
    line_total: float
    status: str
    item_name: Optional[str] = None
    uom_name: Optional[str] = None
    display_qty: float
    display_unit_cost: float

class PurchaseOrderCreate(BaseModel):
    supplier_id: UUID
    price_list_id: Optional[UUID] = None
    origin_type: str = "manual"
    catering_request_id: Optional[UUID] = None
    requested_date: Optional[date] = None
    promised_date: Optional[date] = None
    currency: str = "USD"
    payment_terms_days: int = 0
    warehouse_id: UUID
    notes: Optional[str] = None
    lines: List[PurchaseOrderLineCreate]

class POApprovalResponse(BaseModel):
    id: UUID
    po_id: UUID
    action: str
    approver_id: Optional[UUID]
    notes: Optional[str]
    created_at: datetime
    approver_name: Optional[str] = None

class PurchaseOrderResponse(BaseModel):
    id: UUID
    org_id: UUID
    po_number: str
    supplier_id: Optional[UUID] = None
    price_list_id: Optional[UUID] = None
    origin_type: Optional[str] = "manual"
    catering_request_id: Optional[UUID] = None
    requested_date: Optional[date] = None
    promised_date: Optional[date] = None
    currency: Optional[str] = "USD"
    subtotal: Optional[float] = 0.0
    tax_amount: Optional[float] = 0.0
    total: Optional[float] = 0.0
    payment_terms_days: Optional[int] = 0
    status: Optional[str] = "draft"
    sent_at: Optional[datetime] = None
    sent_by: Optional[UUID] = None
    sent_to_email: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    notes: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
    lines: List[PurchaseOrderLineResponse] = []
    approvals: List[POApprovalResponse] = []
    supplier_name: Optional[str] = None
    warehouse_name: Optional[str] = None
    created_by_name: Optional[str] = None
    org_name: Optional[str] = None
    org_tax_id: Optional[str] = None
    org_address: Optional[str] = None
    org_phone: Optional[str] = None
    org_email: Optional[str] = None

class PurchaseOrderUpdate(BaseModel):
    requested_date: Optional[date] = None
    promised_date: Optional[date] = None
    payment_terms_days: Optional[int] = None
    notes: Optional[str] = None
    lines: Optional[List[PurchaseOrderLineCreate]] = None

class POApprovalAction(BaseModel):
    notes: Optional[str] = None

# --- Supplier Invoices ---
class SupplierInvoiceLineCreate(BaseModel):
    po_line_id: Optional[UUID] = None
    item_id: UUID
    qty_invoiced_base: float
    unit_cost_base: float
    line_total: float

class SupplierInvoiceLineResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    po_line_id: Optional[UUID] = None
    item_id: UUID
    qty_invoiced_base: float
    unit_cost_base: float
    line_total: float
    diff_vs_po_base: Optional[float] = None
    diff_vs_receipt_base: Optional[float] = None
    item_name: Optional[str] = None

class SupplierInvoiceCreate(BaseModel):
    supplier_id: UUID
    po_id: Optional[UUID] = None
    receipt_id: Optional[UUID] = None
    invoice_number: str
    invoice_date: date
    due_date: Optional[date] = None
    currency: str = "USD"
    subtotal: float
    tax_amount: float = 0.0
    total: float
    pdf_url: Optional[str] = None
    lines: List[SupplierInvoiceLineCreate]

class SupplierInvoiceResponse(BaseModel):
    id: UUID
    org_id: UUID
    supplier_id: UUID
    po_id: Optional[UUID] = None
    receipt_id: Optional[UUID] = None
    invoice_number: str
    invoice_date: date
    due_date: Optional[date] = None
    currency: str
    subtotal: float
    tax_amount: float
    total: float
    matching_status: str
    matching_notes: Optional[str] = None
    payment_status: str
    exported_at: Optional[datetime] = None
    pdf_url: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    lines: List[SupplierInvoiceLineResponse] = []
    supplier_name: Optional[str] = None
    po_number: Optional[str] = None

