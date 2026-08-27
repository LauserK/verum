from fastapi import APIRouter, Depends
from typing import List, Optional
from database import get_db
from auth_deps import get_current_user
from app.deps import get_active_org_id, require_permission
from app.cache import cache, invalidate_sales_config, invalidate_sales_catalog, invalidate_pos_config
import app.sales.service as sales_svc
from app.sales.schemas import (
    TenantBillingConfigUpdate, TenantBillingConfigOut,
    PaymentMethodCreate, PaymentMethodOut,
    WorkstationCreate, WorkstationUpdate, WorkstationOut,
    SaleCategoryCreate, SaleCategoryUpdate, SaleCategoryOut,
    SaleItemCreate, SaleItemUpdate, SaleItemOut,
    SaleModifierGroupCreate, SaleModifierGroupOut,
    CustomerCreate, CustomerUpdate, CustomerOut,
    DocumentSequenceCreate, DocumentSequenceOut,
    InvoiceCreate, InvoiceOut, InvoiceVoid,
    PaymentCreate, PaymentOut,
    CurrencyCreate, CurrencyUpdate, CurrencyOut,
    ExchangeRateCreate, ExchangeRateOut,
    TaxCreate, TaxUpdate, TaxOut,
    FloorPlanCreate, FloorPlanUpdate, FloorPlanOut,
    TableCreate, TableUpdate, TableOut,
    PosSessionOpen, PosSessionOut,
    SaleModeConfigCreate, SaleModeConfigUpdate, SaleModeConfigOut,
    PosConfigOut, StockReserveRequest, StockAvailabilityItem,
    CheckoutCreate, CheckoutResponse,
    PosTableOrderSync, PosTableOrderOut
)
import app.sales.invoice_service as invoice_svc
import app.sales.payment_service as payment_svc
import app.sales.stock_service as stock_svc
import app.sales.checkout_service as checkout_svc

router = APIRouter(prefix="/sales", tags=["Sales"])

# --- Config ---

@router.get("/config", response_model=TenantBillingConfigOut)
async def get_config(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    cached = await cache.get(f"sales:config:{org_id}")
    if cached:
        return cached
    res = await sales_svc.get_billing_config(org_id, db)
    await cache.set(f"sales:config:{org_id}", res, ttl=300)
    return res

@router.patch("/config", response_model=TenantBillingConfigOut)
async def update_config(
    payload: TenantBillingConfigUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.update_billing_config(org_id, payload, db)
    await invalidate_sales_config(org_id)
    return res

@router.post("/payment-methods", response_model=PaymentMethodOut)
async def create_payment_method(
    payload: PaymentMethodCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_payment_methods"))
):
    res = await sales_svc.create_payment_method(org_id, payload, db)
    await invalidate_sales_config(org_id)
    return res

@router.get("/payment-methods", response_model=List[PaymentMethodOut])
async def list_payment_methods(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_payment_methods"))
):
    return await sales_svc.get_payment_methods(org_id, db)

@router.patch("/payment-methods/{method_id}", response_model=PaymentMethodOut)
async def update_payment_method(
    method_id: str,
    payload: dict,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_payment_methods"))
):
    from app.sales.schemas import PaymentMethodUpdate
    update_schema = PaymentMethodUpdate(**payload)
    res = await sales_svc.update_payment_method(org_id, method_id, update_schema, db)
    await invalidate_sales_config(org_id)
    return res

@router.delete("/payment-methods/{method_id}")
async def delete_payment_method(
    method_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_payment_methods"))
):
    res = await sales_svc.delete_payment_method(org_id, method_id, db)
    await invalidate_sales_config(org_id)
    return res

@router.post("/workstations", response_model=WorkstationOut)
async def create_workstation(
    payload: WorkstationCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_workstations"))
):
    return await sales_svc.create_workstation(org_id, payload, db)

@router.get("/workstations", response_model=List[WorkstationOut])
async def list_workstations(
    venue_id: Optional[str] = None,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_workstations"))
):
    return await sales_svc.get_workstations(org_id, venue_id, db)

@router.patch("/workstations/{workstation_id}", response_model=WorkstationOut)
async def update_workstation(
    workstation_id: str,
    payload: WorkstationUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_workstations"))
):
    return await sales_svc.update_workstation(org_id, workstation_id, payload, db)

@router.delete("/workstations/{workstation_id}")
async def delete_workstation(
    workstation_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_workstations"))
):
    return await sales_svc.delete_workstation(org_id, workstation_id, db)

# --- POS Sessions ---

@router.post("/sessions/open", response_model=PosSessionOut)
async def open_pos_session(
    payload: PosSessionOpen,
    user = Depends(get_current_user),
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    cashier_id = getattr(user, "id", None) or getattr(user, "user_id", None) or (user.get("id") if isinstance(user, dict) else None)
    return await sales_svc.open_pos_session(org_id, cashier_id, payload, db)

@router.get("/sessions/active", response_model=Optional[PosSessionOut])
async def get_active_pos_session(
    workstation_id: Optional[str] = None,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.get_active_pos_session(org_id, workstation_id, db)

# --- Floor Plans & Tables ---

@router.get("/floor-plans", response_model=List[FloorPlanOut])
async def list_floor_plans(
    venue_id: Optional[str] = None,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.list_floor_plans(org_id, venue_id, db)

@router.post("/floor-plans", response_model=FloorPlanOut)
async def create_floor_plan(
    payload: FloorPlanCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.create_floor_plan(org_id, payload, db)

@router.patch("/floor-plans/{plan_id}", response_model=FloorPlanOut)
async def update_floor_plan(
    plan_id: str,
    payload: FloorPlanUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.update_floor_plan(org_id, plan_id, payload, db)

@router.delete("/floor-plans/{plan_id}")
async def delete_floor_plan(
    plan_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.delete_floor_plan(org_id, plan_id, db)

@router.post("/floor-plans/{plan_id}/tables", response_model=TableOut)
async def create_table(
    plan_id: str,
    payload: TableCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.create_table(org_id, plan_id, payload, db)

@router.patch("/tables/{table_id}", response_model=TableOut)
async def update_table(
    table_id: str,
    payload: TableUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.update_table(org_id, table_id, payload, db)

@router.delete("/tables/{table_id}")
async def delete_table(
    table_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.delete_table(org_id, table_id, db)

# --- Table Orders (Multi-terminal real-time sync) ---

@router.get("/table-orders", response_model=List[PosTableOrderOut])
async def list_table_orders(
    venue_id: Optional[str] = None,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.list_active_table_orders(org_id, venue_id, db)

@router.get("/table-orders/{table_id}", response_model=Optional[PosTableOrderOut])
async def get_table_order(
    table_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.get_active_table_order(org_id, table_id, db)

@router.put("/table-orders/{table_id}")
async def sync_table_order(
    table_id: str,
    payload: PosTableOrderSync,
    user = Depends(get_current_user),
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    user_id = getattr(user, "id", None) or getattr(user, "user_id", None) or (user.get("id") if isinstance(user, dict) else None)
    payload.table_id = table_id
    return await sales_svc.sync_table_order(org_id, str(user_id) if user_id else None, payload, db)

@router.delete("/table-orders/{table_id}")
async def delete_table_order(
    table_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.delete_table_order(org_id, table_id, db)


# --- Catalog: Categories ---


@router.get("/categories", response_model=List[SaleCategoryOut])
async def list_categories(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db)
):
    return await sales_svc.list_sale_categories(org_id, db)

@router.post("/categories", response_model=SaleCategoryOut)
async def create_category(
    payload: SaleCategoryCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_catalog"))
):
    res = await sales_svc.create_sale_category(org_id, payload, db)
    await invalidate_sales_catalog(org_id)
    return res

@router.patch("/categories/{category_id}", response_model=SaleCategoryOut)
async def update_category(
    category_id: str,
    payload: SaleCategoryUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_catalog"))
):
    res = await sales_svc.update_sale_category(org_id, category_id, payload, db)
    await invalidate_sales_catalog(org_id)
    return res

# --- Catalog: Items ---

@router.get("/items", response_model=List[SaleItemOut])
async def list_sale_items(
    category_id: Optional[str] = None,
    active_only: bool = False,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db)
):
    return await sales_svc.list_sale_items(org_id, category_id, active_only, db)

@router.get("/items/{item_id}", response_model=SaleItemOut)
async def get_sale_item(
    item_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db)
):
    return await sales_svc.get_sale_item(item_id, org_id, db)

@router.post("/items", response_model=SaleItemOut)
async def create_sale_item(
    payload: SaleItemCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_catalog"))
):
    res = await sales_svc.create_sale_item(org_id, payload, db)
    await invalidate_sales_catalog(org_id)
    return res

@router.patch("/items/{item_id}", response_model=SaleItemOut)
async def update_sale_item(
    item_id: str,
    payload: SaleItemUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_catalog"))
):
    res = await sales_svc.update_sale_item(org_id, item_id, payload, db)
    await invalidate_sales_catalog(org_id)
    return res

@router.delete("/items/{item_id}")
async def delete_sale_item(
    item_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_catalog"))
):
    res = await sales_svc.delete_sale_item(org_id, item_id, db)
    await invalidate_sales_catalog(org_id)
    return res

# --- Catalog: Modifier Groups ---

@router.get("/modifier-groups", response_model=List[SaleModifierGroupOut])
async def list_modifier_groups(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db)
):
    return await sales_svc.list_modifier_groups(org_id, db)

@router.post("/modifier-groups", response_model=SaleModifierGroupOut)
async def create_modifier_group(
    payload: SaleModifierGroupCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_catalog"))
):
    res = await sales_svc.create_modifier_group(org_id, payload, db)
    await invalidate_sales_catalog(org_id)
    return res

@router.patch("/modifier-groups/{group_id}", response_model=SaleModifierGroupOut)
async def update_modifier_group(
    group_id: str,
    payload: SaleModifierGroupCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_catalog"))
):
    res = await sales_svc.update_modifier_group(org_id, group_id, payload, db)
    await invalidate_sales_catalog(org_id)
    return res

@router.delete("/modifier-groups/{group_id}")
async def delete_modifier_group(
    group_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_catalog"))
):
    res = await sales_svc.delete_modifier_group(org_id, group_id, db)
    await invalidate_sales_catalog(org_id)
    return res

# --- Customers ---

@router.post("/customers", response_model=CustomerOut)
async def create_customer(
    payload: CustomerCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_customers"))
):
    return await sales_svc.create_customer(org_id, payload, db)

@router.get("/customers", response_model=List[CustomerOut])
async def list_customers(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.view_customers"))
):
    return await sales_svc.list_customers(org_id, db)

@router.get("/customers/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.view_customers"))
):
    return await sales_svc.get_customer(org_id, customer_id, db)

@router.patch("/customers/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_customers"))
):
    return await sales_svc.update_customer(org_id, customer_id, payload, db)

@router.delete("/customers/{customer_id}")
async def delete_customer(
    customer_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_customers"))
):
    return await sales_svc.delete_customer(org_id, customer_id, db)

# --- Sequences ---

@router.post("/sequences", response_model=DocumentSequenceOut)
async def create_sequence(
    payload: DocumentSequenceCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.create_sequence(org_id, payload, db)

@router.get("/sequences", response_model=List[DocumentSequenceOut])
async def list_sequences(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.list_sequences(org_id, db)

# --- Invoices ---

@router.get("/invoices", response_model=List[InvoiceOut])
async def list_invoices(
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    document_type: Optional[str] = None,
    pos_session_id: Optional[str] = None,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.view_invoices"))
):
    return await invoice_svc.list_invoices(
        org_id=org_id,
        db=db,
        status=status,
        customer_id=customer_id,
        document_type=document_type,
        pos_session_id=pos_session_id
    )

@router.post("/invoices", response_model=InvoiceOut)
async def create_invoice(
    payload: InvoiceCreate,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.create_invoice"))
):
    return await invoice_svc.create_invoice(org_id, payload, user.id, db)

@router.get("/invoices/by-table-order/{table_order_id}")
async def get_invoice_by_table_order(
    table_order_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.view_invoices"))
):
    return await invoice_svc.get_invoice_by_table_order(org_id, table_order_id, db)

@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.view_invoices"))
):
    return await invoice_svc.get_invoice_detail(org_id, invoice_id, db)

@router.post("/invoices/{invoice_id}/confirm", response_model=dict)
async def confirm_invoice(
    invoice_id: str,
    warehouse_id: Optional[str] = None,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.create_invoice"))
):
    return await invoice_svc.confirm_invoice(org_id, invoice_id, warehouse_id, user, db)

@router.post("/invoices/{invoice_id}/void", response_model=dict)
async def void_invoice(
    invoice_id: str,
    payload: InvoiceVoid,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.void_invoice"))
):
    return await invoice_svc.void_invoice(org_id, invoice_id, user.id, payload.reason, db)

# --- Payments ---

@router.post("/invoices/{invoice_id}/payments", response_model=PaymentOut)
async def add_payment(
    invoice_id: str,
    payload: PaymentCreate,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_payments"))
):
    return await payment_svc.add_payment(org_id, invoice_id, payload, user.id, db)


# --- Currencies & Exchange Rates ---

@router.get("/currencies", response_model=List[CurrencyOut])
async def list_currencies(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.list_currencies(org_id, db)

@router.post("/currencies", response_model=CurrencyOut)
async def create_currency(
    payload: CurrencyCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.create_currency(org_id, payload, db)
    await invalidate_sales_config(org_id)
    return res

@router.patch("/currencies/{currency_id}", response_model=CurrencyOut)
async def update_currency(
    currency_id: str,
    payload: CurrencyUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.update_currency(org_id, currency_id, payload, db)
    await invalidate_sales_config(org_id)
    return res

@router.get("/exchange-rates", response_model=List[ExchangeRateOut])
async def list_exchange_rates(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.list_latest_exchange_rates(org_id, db)

@router.post("/exchange-rates", response_model=ExchangeRateOut)
async def create_exchange_rate(
    payload: ExchangeRateCreate,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.create_exchange_rate(org_id, payload, user.id, db)
    await invalidate_sales_config(org_id)
    return res

# --- Taxes / Alícuotas ---

@router.get("/taxes", response_model=List[TaxOut])
async def list_taxes(
    active_only: bool = False,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
):
    return await sales_svc.list_taxes(org_id, db, active_only=active_only)

@router.post("/taxes", response_model=TaxOut)
async def create_tax(
    payload: TaxCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.create_tax(org_id, payload, db)
    await invalidate_sales_config(org_id)
    return res

@router.patch("/taxes/{tax_id}", response_model=TaxOut)
async def update_tax(
    tax_id: str,
    payload: TaxUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.update_tax(org_id, tax_id, payload, db)
    await invalidate_sales_config(org_id)
    return res

@router.delete("/taxes/{tax_id}")
async def delete_tax(
    tax_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.delete_tax(org_id, tax_id, db)
    await invalidate_sales_config(org_id)
    return res

# ── POS Config ──

@router.get("/pos-config", response_model=PosConfigOut)
async def get_pos_config(
    workstation_id: str,
    mode: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.view_config"))
):
    return await sales_svc.resolve_pos_config(org_id, workstation_id, mode, db)

# ── Sale Mode Config CRUD ──

@router.get("/mode-config", response_model=List[SaleModeConfigOut])
async def list_mode_configs(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.list_sale_mode_configs(org_id, db)

@router.post("/mode-config", response_model=SaleModeConfigOut)
async def create_mode_config(
    payload: SaleModeConfigCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.create_sale_mode_config(org_id, payload, db)
    await invalidate_pos_config(org_id)
    return res

@router.patch("/mode-config/{config_id}", response_model=SaleModeConfigOut)
async def update_mode_config(
    config_id: str,
    payload: SaleModeConfigUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.update_sale_mode_config(org_id, config_id, payload, db)
    await invalidate_pos_config(org_id)
    return res

@router.delete("/mode-config/{config_id}")
async def delete_mode_config(
    config_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.delete_sale_mode_config(org_id, config_id, db)
    await invalidate_pos_config(org_id)
    return res

# ── Stock Reservation & Availability ──

@router.post("/stock/reserve")
async def reserve_stock(
    payload: StockReserveRequest,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.create_invoice"))
):
    return await stock_svc.reserve_stock(
        org_id, str(payload.sale_item_id), payload.cart_line_id,
        payload.quantity, str(payload.warehouse_id), payload.session_id, db
    )

@router.delete("/stock/reserve/{cart_line_id}")
async def release_stock(
    cart_line_id: str,
    warehouse_id: str,
    sale_item_id: str,
    session_id: str,
    org_id: str = Depends(get_active_org_id),
    _ = Depends(require_permission("sales.create_invoice"))
):
    return await stock_svc.release_stock(warehouse_id, sale_item_id, session_id, cart_line_id)

@router.get("/stock/availability", response_model=List[StockAvailabilityItem])
async def get_availability(
    warehouse_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.view_catalog"))
):
    return await stock_svc.get_stock_availability(org_id, warehouse_id, db)

# ── Atomic Checkout ──

@router.post("/checkout", response_model=CheckoutResponse)
async def process_checkout(
    payload: CheckoutCreate,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.create_invoice"))
):
    return await checkout_svc.process_checkout(org_id, payload, user.id, db)





