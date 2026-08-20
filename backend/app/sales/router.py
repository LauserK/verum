from fastapi import APIRouter, Depends
from typing import List, Optional
from database import get_db
from auth_deps import get_current_user
from app.deps import get_active_org_id, require_permission
from app.cache import cache, invalidate_sales_config, invalidate_sales_catalog
import app.sales.service as sales_svc
from app.sales.schemas import (
    TenantBillingConfigUpdate, TenantBillingConfigOut,
    PaymentMethodCreate, PaymentMethodOut,
    WorkstationCreate, WorkstationOut,
    SaleItemCreate, SaleItemOut,
    CustomerCreate, CustomerUpdate, CustomerOut,
    DocumentSequenceCreate, DocumentSequenceOut,
    InvoiceCreate, InvoiceOut, InvoiceVoid,
    PaymentCreate, PaymentOut,
    CurrencyCreate, CurrencyUpdate, CurrencyOut,
    ExchangeRateCreate, ExchangeRateOut,
    TaxCreate, TaxUpdate, TaxOut
)
import app.sales.invoice_service as invoice_svc
import app.sales.payment_service as payment_svc

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
    cached = await cache.get(f"sales:payment_methods:{org_id}")
    if cached:
        return cached
    res = await sales_svc.get_payment_methods(org_id, db)
    await cache.set(f"sales:payment_methods:{org_id}", res, ttl=300)
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

# --- Catalog ---

@router.post("/items", response_model=SaleItemOut)
async def create_sale_item(
    payload: SaleItemCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_catalog"))
):
    # In a real scenario we need more complex mapping for output
    res = await sales_svc.create_sale_item(org_id, payload, db)
    # Mapping raw DB response to SaleItemOut schema manually if needed
    # For now, FastAPI will try to parse it
    # We must ensure components and variants exist in dict
    res["variants"] = res.get("sale_item_variants", [])
    res["components"] = res.get("sale_item_components", [])
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

@router.post("/invoices", response_model=InvoiceOut)
async def create_invoice(
    payload: InvoiceCreate,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.create_invoice"))
):
    return await invoice_svc.create_invoice(org_id, payload, user.id, db)

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




