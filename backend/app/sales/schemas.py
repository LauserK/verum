from pydantic import BaseModel
from typing import Optional, List, Literal, Any, Union
from uuid import UUID
from datetime import date as dt_date, datetime as dt_datetime
from decimal import Decimal

# --- Categories ---

class SaleCategoryCreate(BaseModel):
    name: str
    icon: str = 'lunch_dining'
    image_url: Optional[str] = None
    position: int = 0
    is_active: bool = True

class SaleCategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    position: Optional[int] = None
    is_active: Optional[bool] = None

class SaleCategoryOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    icon: str
    image_url: Optional[str] = None
    position: int
    is_active: bool
    created_at: Optional[Union[dt_datetime, str]] = None

# --- Components ---

class SaleItemComponentCreate(BaseModel):
    item_id: UUID
    component_type: Literal['fixed_qty', 'recipe_proportional']
    quantity: Decimal = Decimal('1')
    label: Optional[str] = None
    position: int = 0

class SaleItemComponentOut(BaseModel):
    id: UUID
    item_id: UUID
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    component_type: str
    quantity: Decimal
    label: Optional[str] = None
    position: int = 0
    recipe_yield: Optional[Decimal] = None
    recipe_ingredient_count: Optional[int] = None

# --- Sale Modifier Groups & Options ---

class SaleModifierOptionCreate(BaseModel):
    item_id: Optional[UUID] = None
    name: str
    price: Decimal = Decimal('0')
    food_cost: Decimal = Decimal('0')
    external_code: Optional[str] = None
    deduct_qty: Optional[Decimal] = None
    is_active: bool = True
    position: int = 0

class SaleModifierOptionOut(BaseModel):
    id: UUID
    group_id: UUID
    item_id: Optional[UUID] = None
    name: str
    price: Decimal
    food_cost: Decimal
    external_code: Optional[str] = None
    deduct_qty: Optional[Decimal] = None
    is_active: bool
    position: int

class SaleModifierGroupCreate(BaseModel):
    name: str
    min_selection: int = 0
    max_selection: Optional[int] = 1
    is_active: bool = True
    position: int = 0
    options: List[SaleModifierOptionCreate] = []

class SaleModifierGroupOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    min_selection: int
    max_selection: Optional[int] = None
    is_active: bool
    position: int
    options: List[SaleModifierOptionOut] = []

# --- Sale Items ---

class SaleItemVariantCreate(BaseModel):
    name: str
    price: Decimal
    food_cost: Decimal = Decimal('0')
    external_code: Optional[str] = None
    is_default: bool = False
    position: int = 0
    components: List[SaleItemComponentCreate] = []

class SaleItemVariantOut(BaseModel):
    id: UUID
    sale_item_id: UUID
    name: str
    price: Decimal
    food_cost: Decimal
    external_code: Optional[str] = None
    is_default: bool
    position: int
    is_active: bool
    components: List[SaleItemComponentOut] = []

class SaleItemCreate(BaseModel):
    category_id: Optional[UUID] = None
    code: Optional[str] = None
    name: str
    description: str = ''
    sale_price: Optional[Decimal] = None
    food_cost: Decimal = Decimal('0')
    tax_id: Optional[UUID] = None
    tax_included: bool = True
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    has_variants: bool = False
    variant_label: str = ''
    is_featured: bool = False
    allow_negative_stock: bool = False
    position: int = 0
    components: List[SaleItemComponentCreate] = []
    variants: List[SaleItemVariantCreate] = []
    modifier_group_ids: List[UUID] = []

class SaleItemOut(BaseModel):
    id: UUID
    org_id: UUID
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    code: Optional[str] = None
    name: str
    description: str = ''
    sale_price: Optional[Decimal] = None
    food_cost: Decimal = Decimal('0')
    tax_id: Optional[UUID] = None
    tax_name: Optional[str] = None
    tax_rate: Optional[Decimal] = None
    tax_included: bool = True
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    has_variants: bool = False
    variant_label: str = ''
    is_active: bool = True
    is_featured: bool = False
    allow_negative_stock: bool = False
    position: int = 0
    components: List[SaleItemComponentOut] = []
    variants: List[SaleItemVariantOut] = []
    modifier_groups: List[SaleModifierGroupOut] = []

class SaleItemUpdate(BaseModel):
    category_id: Optional[UUID] = None
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sale_price: Optional[Decimal] = None
    food_cost: Optional[Decimal] = None
    tax_id: Optional[UUID] = None
    tax_included: Optional[bool] = None
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    has_variants: Optional[bool] = None
    variant_label: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    allow_negative_stock: Optional[bool] = None
    position: Optional[int] = None
    components: Optional[List[SaleItemComponentCreate]] = None
    variants: Optional[List[SaleItemVariantCreate]] = None
    modifier_group_ids: Optional[List[UUID]] = None

# --- Config: Workstations & Payment Methods ---

class WorkstationCreate(BaseModel):
    name: str
    venue_id: Optional[UUID] = None
    is_active: bool = True
    printer_type: Literal['none', 'thermal', 'fiscal'] = 'none'
    printer_config: dict = {}
    numbering_source: Literal['verum_sequence', 'fiscal_printer', 'external'] = 'verum_sequence'
    allowed_modes: Optional[List[str]] = ['tables', 'takeout', 'delivery', 'pickup', 'bar']

class WorkstationUpdate(BaseModel):
    name: Optional[str] = None
    venue_id: Optional[UUID] = None
    printer_type: Optional[Literal['none', 'thermal', 'fiscal']] = None
    printer_config: Optional[dict] = None
    numbering_source: Optional[Literal['verum_sequence', 'fiscal_printer', 'external']] = None
    is_active: Optional[bool] = None
    allowed_modes: Optional[List[str]] = None

class WorkstationOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    venue_id: Optional[UUID] = None
    printer_type: Optional[str] = 'none'
    printer_config: Optional[dict] = {}
    numbering_source: Optional[str] = 'verum_sequence'
    is_active: bool = True
    allowed_modes: Optional[List[str]] = None
    created_at: Optional[Union[dt_datetime, str]] = None

# --- POS Sessions ---

class PosSessionOpen(BaseModel):
    venue_id: Optional[UUID] = None
    workstation_id: Optional[UUID] = None
    opening_balance: Decimal = Decimal('0')
    opening_currency: str = 'USD'
    notes: Optional[str] = None

class PosSessionOut(BaseModel):
    id: UUID
    org_id: UUID
    venue_id: Optional[UUID] = None
    workstation_id: Optional[UUID] = None
    cashier_id: Optional[UUID] = None
    status: str = 'open'
    opening_balance: Decimal = Decimal('0')
    opening_currency: str = 'USD'
    notes: Optional[str] = None
    opened_at: Optional[Union[dt_datetime, str]] = None
    closed_at: Optional[Union[dt_datetime, str]] = None

class PaymentMethodCreate(BaseModel):
    name: str
    method_type: Literal['cash', 'card', 'bank_transfer', 'mobile_payment', 'digital_wallet', 'crypto', 'other']
    currency_code: Optional[str] = None
    instructions: str = ''
    is_active: bool = True
    requires_reference: bool = True
    position: int = 0
    sync_to_quick: bool = False

class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    method_type: Optional[Literal['cash', 'card', 'bank_transfer', 'mobile_payment', 'digital_wallet', 'crypto', 'other']] = None
    currency_code: Optional[str] = None
    instructions: Optional[str] = None
    is_active: Optional[bool] = None
    requires_reference: Optional[bool] = None
    position: Optional[int] = None
    sync_to_quick: Optional[bool] = False

class PaymentMethodOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    method_type: str
    currency_code: Optional[str] = None
    instructions: str
    is_active: bool
    requires_reference: bool
    position: int
    created_at: dt_datetime

class TenantBillingConfigUpdate(BaseModel):
    default_tax_id: Optional[UUID] = None
    surcharges: Optional[List[dict]] = None
    withholding_enabled: Optional[bool] = None
    rounding_mode: Optional[Literal['none', 'round_half_up', 'round_up', 'round_down']] = None
    rounding_precision: Optional[int] = None
    cash_rounding_multiple: Optional[Decimal] = None
    cash_rounding_rule: Optional[Literal['nearest', 'up', 'down']] = None
    invoice_footer: Optional[str] = None
    invoice_notes: Optional[str] = None

class TenantBillingConfigOut(BaseModel):
    id: UUID
    org_id: UUID
    default_tax_id: Optional[UUID] = None
    surcharges: List[dict] = []
    withholding_enabled: bool = False
    rounding_mode: str = 'round_half_up'
    rounding_precision: int = 2
    cash_rounding_multiple: Decimal = Decimal('1.0')
    cash_rounding_rule: str = 'nearest'
    invoice_footer: Optional[str] = None
    invoice_notes: Optional[str] = None
    created_at: dt_datetime
    updated_at: dt_datetime

# --- Price Lists ---

class SalePriceListItemCreate(BaseModel):
    sale_item_id: UUID
    variant_id: Optional[UUID] = None
    price: Decimal

class SalePriceListCreate(BaseModel):
    venue_id: Optional[UUID] = None
    name: str
    is_default: bool = False
    is_active: bool = True
    valid_from: Optional[dt_date] = None
    valid_until: Optional[dt_date] = None
    items: List[SalePriceListItemCreate] = []

class SalePriceListOut(BaseModel):
    id: UUID
    org_id: UUID
    venue_id: Optional[UUID] = None
    name: str
    is_default: bool
    is_active: bool
    valid_from: Optional[dt_date] = None
    valid_until: Optional[dt_date] = None
    created_at: dt_datetime
    items: List[dict] = [] # dict para simplificar, en realidad usaríamos un modelo si hiciera falta.

# --- Customers ---

class CustomerCreate(BaseModel):
    name: str
    tax_id: Optional[str] = None
    customer_type: Literal['individual', 'business', 'government', 'foreign'] = 'individual'
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    credit_limit: Decimal = Decimal('0')
    credit_days: int = 0
    is_tax_exempt: bool = False
    is_withholding_agent: bool = False
    withholding_rate: Decimal = Decimal('0')
    is_active: bool = True
    notes: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    tax_id: Optional[str] = None
    customer_type: Optional[Literal['individual', 'business', 'government', 'foreign']] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    credit_days: Optional[int] = None
    is_tax_exempt: Optional[bool] = None
    is_withholding_agent: Optional[bool] = None
    withholding_rate: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class CustomerOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    tax_id: Optional[str] = None
    customer_type: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    credit_limit: Decimal
    credit_days: int
    current_balance: Decimal
    is_tax_exempt: bool
    is_withholding_agent: bool
    withholding_rate: Decimal
    is_active: bool
    notes: Optional[str] = None
    created_at: dt_datetime
    updated_at: dt_datetime

# --- Document Sequences ---

class DocumentSequenceCreate(BaseModel):
    document_type: str
    prefix: str = ''
    next_number: int = 1
    padding: int = 8

class DocumentSequenceOut(BaseModel):
    id: UUID
    org_id: UUID
    document_type: str
    prefix: str
    next_number: int
    padding: int

# --- Invoices & Billing ---

class InvoiceItemCreate(BaseModel):
    sale_item_id: Optional[UUID] = None
    variant_id: Optional[UUID] = None
    description: str
    product_code: Optional[str] = None
    quantity: Decimal
    unit_price: Decimal
    discount_pct: Decimal = Decimal('0')
    tax_id: Optional[UUID] = None
    modifiers: List[dict] = [] # Snapshot modifiers
    notes: Optional[str] = None

class InvoiceItemOut(BaseModel):
    id: UUID
    invoice_id: UUID
    sale_item_id: Optional[UUID] = None
    variant_id: Optional[UUID] = None
    description: str
    product_code: Optional[str] = None
    quantity: Decimal
    unit_price: Decimal
    discount_pct: Decimal
    discount_amount: Decimal
    tax_id: Optional[UUID] = None
    tax_name: Optional[str] = None
    tax_rate: Decimal
    is_exempt: bool
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    unit_food_cost: Decimal
    modifiers: List[dict]
    position: int
    notes: Optional[str] = None

class InvoiceTaxSummaryOut(BaseModel):
    id: UUID
    invoice_id: UUID
    tax_id: Optional[UUID] = None
    tax_name: str
    tax_rate: Decimal
    taxable_base: Decimal
    tax_amount: Decimal

class InvoiceCreate(BaseModel):
    venue_id: Optional[UUID] = None
    workstation_id: Optional[UUID] = None
    document_type: Literal['invoice', 'credit_note', 'debit_note', 'proforma', 'delivery_note'] = 'invoice'
    document_number: Optional[str] = None # Optional if auto-generated via verum_sequence
    numbering_source: Literal['verum_sequence', 'fiscal_printer', 'external'] = 'verum_sequence'
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_tax_id: Optional[str] = None
    customer_address: Optional[str] = None
    date: dt_date = dt_date.today()
    due_date: Optional[dt_date] = None
    currency_code: str
    exchange_rate: Decimal = Decimal('1')
    discount_amount: Decimal = Decimal('0')
    related_invoice_id: Optional[UUID] = None
    pos_session_id: Optional[UUID] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    items: List[InvoiceItemCreate]
    warehouse_id: Optional[UUID] = None # For inventory deduction if immediate deduction is wanted

class InvoiceOut(BaseModel):
    id: UUID
    org_id: UUID
    venue_id: Optional[UUID] = None
    workstation_id: Optional[UUID] = None
    document_type: str
    document_number: str
    fiscal_number: Optional[str] = None
    numbering_source: str
    customer_id: Optional[UUID] = None
    customer_name: str
    customer_tax_id: Optional[str] = None
    customer_address: Optional[str] = None
    date: dt_date
    due_date: Optional[dt_date] = None
    status: str
    currency_code: str
    exchange_rate: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    total_taxable: Decimal
    total_exempt: Decimal
    total_tax: Decimal
    total_surcharges: Decimal
    total: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    related_invoice_id: Optional[UUID] = None
    pos_session_id: Optional[UUID] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    created_by: Optional[UUID] = None
    voided_by: Optional[UUID] = None
    voided_at: Optional[dt_datetime] = None
    void_reason: Optional[str] = None
    created_at: dt_datetime
    updated_at: dt_datetime
    items: List[InvoiceItemOut] = []
    tax_summary: List[InvoiceTaxSummaryOut] = []

class InvoiceVoid(BaseModel):
    reason: str

# --- Payments ---

class PaymentCreate(BaseModel):
    payment_method_id: UUID
    amount: Decimal
    currency_code: str
    exchange_rate: Decimal = Decimal('1')
    reference: Optional[str] = None
    cash_tendered: Optional[Decimal] = None
    cash_change: Optional[Decimal] = None
    notes: Optional[str] = None

class PaymentOut(BaseModel):
    id: UUID
    invoice_id: UUID
    payment_method_id: Optional[UUID] = None
    method_name: str
    method_type: str
    amount: Decimal
    currency_code: str
    exchange_rate: Decimal
    amount_in_invoice_currency: Decimal
    surcharges_applied: List[dict] = []
    total_surcharges: Decimal
    reference: Optional[str] = None
    cash_tendered: Optional[Decimal] = None
    cash_change: Optional[Decimal] = None
    status: str
    notes: Optional[str] = None
    recorded_by: Optional[UUID] = None
    created_at: dt_datetime


class CurrencyCreate(BaseModel):
    code: str
    name: str
    symbol: str
    is_base: bool = False
    is_active: bool = True

class CurrencyUpdate(BaseModel):
    name: Optional[str] = None
    symbol: Optional[str] = None
    is_base: Optional[bool] = None
    is_active: Optional[bool] = None

class CurrencyOut(BaseModel):
    id: UUID
    org_id: UUID
    code: str
    name: str
    symbol: str
    is_base: bool
    is_active: bool
    created_at: Optional[Union[dt_datetime, str]] = None
    updated_at: Optional[Union[dt_datetime, str]] = None

class ExchangeRateCreate(BaseModel):
    from_currency: str
    to_currency: str
    rate: Decimal
    effective_date: Optional[Union[dt_datetime, dt_date, str]] = None

class ExchangeRateOut(BaseModel):
    id: UUID
    org_id: UUID
    from_currency: str
    to_currency: str
    rate: Decimal
    effective_date: Optional[Union[dt_datetime, str]] = None
    created_at: Optional[Union[dt_datetime, str]] = None
    created_by: Optional[UUID] = None

class TaxCreate(BaseModel):
    name: str
    rate: Decimal
    is_active: bool = True

class TaxUpdate(BaseModel):
    name: Optional[str] = None
    rate: Optional[Decimal] = None
    is_active: Optional[bool] = None

class TaxOut(BaseModel):
    id: UUID
    org_id: Optional[UUID] = None
    name: str
    rate: Decimal
    is_active: bool
    created_at: Optional[Union[dt_datetime, str]] = None


# --- Floor Plans & Tables ---

class TableBase(BaseModel):
    name: str
    shape: Literal['rectangle', 'circle'] = 'rectangle'
    x: int = 0
    y: int = 0
    width: int = 60
    height: int = 60
    capacity: int = 2
    is_active: bool = True

class TableCreate(TableBase):
    pass

class TableUpdate(BaseModel):
    name: Optional[str] = None
    shape: Optional[Literal['rectangle', 'circle']] = None
    x: Optional[int] = None
    y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None

class TableOut(TableBase):
    id: UUID
    floor_plan_id: UUID
    created_at: Optional[Union[dt_datetime, str]] = None

class FloorPlanBase(BaseModel):
    venue_id: UUID
    name: str
    width: int = 800
    height: int = 600

class FloorPlanCreate(FloorPlanBase):
    pass

class FloorPlanUpdate(BaseModel):
    venue_id: Optional[UUID] = None
    name: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None

class FloorPlanOut(FloorPlanBase):
    id: UUID
    org_id: UUID
    tables: List[TableOut] = []
    created_at: Optional[Union[dt_datetime, str]] = None
    updated_at: Optional[Union[dt_datetime, str]] = None

# ── Sale Mode Config ──

class SaleModeConfigCreate(BaseModel):
    mode: Literal['tables', 'takeout', 'delivery', 'pickup', 'bar']
    customer_requirement: Literal['required', 'optional', 'disabled']

class SaleModeConfigUpdate(BaseModel):
    customer_requirement: Optional[Literal['required', 'optional', 'disabled']] = None

class SaleModeConfigOut(BaseModel):
    id: UUID
    org_id: UUID
    mode: str
    customer_requirement: Optional[str] = None
    created_at: Optional[Union[dt_datetime, str]] = None
    updated_at: Optional[Union[dt_datetime, str]] = None

# ── POS Config (resolved) ──

class PosConfigOut(BaseModel):
    customer_requirement: str
    warehouse_id: Optional[UUID] = None
    resolved_from: str

# ── Stock Reservation ──

class StockReserveRequest(BaseModel):
    sale_item_id: UUID
    cart_line_id: str
    quantity: float
    warehouse_id: UUID
    session_id: str

class StockAvailabilityItem(BaseModel):
    sale_item_id: UUID
    available_stock: float
    allow_negative_stock: bool

# ── Checkout ──

class CheckoutItemCreate(BaseModel):
    sale_item_id: UUID
    variant_id: Optional[UUID] = None
    quantity: float
    unit_price: float
    discount_pct: float = 0
    tax_id: Optional[UUID] = None
    modifiers: list = []
    notes: Optional[str] = None

class CheckoutPaymentCreate(BaseModel):
    payment_method_id: UUID
    amount: float
    currency_code: str
    exchange_rate: float = 1.0
    reference: Optional[str] = None
    cash_tendered: Optional[float] = None

class CheckoutChangeCreate(BaseModel):
    amount: float
    currency_code: str
    method: str

class CheckoutCreate(BaseModel):
    workstation_id: UUID
    pos_session_id: UUID
    venue_id: Optional[UUID] = None
    mode: Literal['tables', 'takeout', 'delivery', 'pickup', 'bar']
    table_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_tax_id: Optional[str] = None
    items: List[CheckoutItemCreate]
    payments: List[CheckoutPaymentCreate] = []
    change: Optional[CheckoutChangeCreate] = None
    document_type: str = "invoice"
    discount_amount: float = 0
    notes: Optional[str] = None

class CheckoutResponse(BaseModel):
    invoice: dict






