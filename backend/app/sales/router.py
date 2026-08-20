from fastapi import APIRouter, Depends
from typing import List, Optional
from database import get_db
from auth_deps import get_current_user
from app.deps import get_active_org_id, require_permission
import app.sales.service as sales_svc
from app.sales.schemas import (
    TenantBillingConfigUpdate, TenantBillingConfigOut,
    PaymentMethodCreate, PaymentMethodOut,
    WorkstationCreate, WorkstationOut,
    SaleItemCreate, SaleItemOut,
    CustomerCreate, CustomerUpdate, CustomerOut,
    DocumentSequenceCreate, DocumentSequenceOut,
    InvoiceCreate, InvoiceOut, InvoiceVoid,
    PaymentCreate, PaymentOut
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
    return await sales_svc.get_billing_config(org_id, db)

@router.patch("/config", response_model=TenantBillingConfigOut)
async def update_config(
    payload: TenantBillingConfigUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.update_billing_config(org_id, payload, db)

@router.post("/payment-methods", response_model=PaymentMethodOut)
async def create_payment_method(
    payload: PaymentMethodCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_payment_methods"))
):
    return await sales_svc.create_payment_method(org_id, payload, db)

@router.get("/payment-methods", response_model=List[PaymentMethodOut])
async def list_payment_methods(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_payment_methods"))
):
    return await sales_svc.get_payment_methods(org_id, db)

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



