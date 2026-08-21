from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException
from app.integrations.outbox import enqueue_event
from app.sales.schemas import (
    TenantBillingConfigUpdate, PaymentMethodCreate, WorkstationCreate,
    SaleItemCreate, SaleItemVariantCreate, SaleItemComponentCreate,
    CustomerCreate, CustomerUpdate, DocumentSequenceCreate
)

# --- Config Service ---

async def get_billing_config(org_id: str, db):
    res = db.table("tenant_billing_config").select("*").eq("org_id", org_id).execute()
    if not res.data:
        # Auto-create if not exists
        inserted = db.table("tenant_billing_config").insert({"org_id": org_id}).execute()
        return inserted.data[0]
    return res.data[0]

async def update_billing_config(org_id: str, payload: TenantBillingConfigUpdate, db):
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return await get_billing_config(org_id, db)
    if "cash_rounding_multiple" in update_data and update_data["cash_rounding_multiple"] is not None:
        update_data["cash_rounding_multiple"] = float(update_data["cash_rounding_multiple"])
    res = db.table("tenant_billing_config").update(update_data).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Billing config not found")
    return res.data[0]

async def create_payment_method(org_id: str, payload: PaymentMethodCreate, db):
    data = payload.model_dump()
    data["org_id"] = org_id
    res = db.table("payment_methods").insert(data).execute()
    return res.data[0]

async def get_payment_methods(org_id: str, db):
    res = db.table("payment_methods").select("*").eq("org_id", org_id).order("position").execute()
    return res.data

async def create_workstation(org_id: str, payload: WorkstationCreate, db):
    data = payload.model_dump()
    data["org_id"] = org_id
    res = db.table("workstations").insert(data).execute()
    return res.data[0]

async def get_workstations(org_id: str, venue_id: Optional[str], db):
    query = db.table("workstations").select("*").eq("org_id", org_id)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    res = query.execute()
    return res.data

# --- Catalog Service ---

async def _create_components(sale_item_id: str, variant_id: Optional[str], components: List[SaleItemComponentCreate], db):
    if not components:
        return
    data = []
    for comp in components:
        comp_data = comp.model_dump()
        comp_data["sale_item_id"] = sale_item_id
        comp_data["variant_id"] = variant_id
        # Convert Decimals to float for supabase insertion
        comp_data["quantity"] = float(comp_data["quantity"])
        comp_data["item_id"] = str(comp_data["item_id"])
        data.append(comp_data)
    db.table("sale_item_components").insert(data).execute()

async def _create_variants(sale_item_id: str, variants: List[SaleItemVariantCreate], db):
    for var in variants:
        var_data = var.model_dump(exclude={"components"})
        var_data["sale_item_id"] = sale_item_id
        var_data["price"] = float(var_data["price"])
        var_data["food_cost"] = float(var_data["food_cost"])
        res = db.table("sale_item_variants").insert(var_data).execute()
        var_id = res.data[0]["id"]
        if var.components:
            await _create_components(sale_item_id, var_id, var.components, db)

async def _link_modifiers(sale_item_id: str, modifier_group_ids: List[UUID], db):
    if not modifier_group_ids:
        return
    data = [{"sale_item_id": sale_item_id, "group_id": str(gid)} for gid in modifier_group_ids]
    db.table("sale_item_modifier_groups").insert(data).execute()

async def create_sale_item(org_id: str, payload: SaleItemCreate, db):
    data = payload.model_dump(exclude={"components", "variants", "modifier_group_ids"})
    data["org_id"] = org_id
    if data.get("sale_price") is not None:
        data["sale_price"] = float(data["sale_price"])
    data["food_cost"] = float(data["food_cost"])
    if data.get("category_id"):
        data["category_id"] = str(data["category_id"])
    if data.get("tax_id"):
        data["tax_id"] = str(data["tax_id"])

    res = db.table("sale_items").insert(data).execute()
    item_id = res.data[0]["id"]

    if payload.has_variants and payload.variants:
        await _create_variants(item_id, payload.variants, db)
    elif payload.components:
        await _create_components(item_id, None, payload.components, db)
        
    if payload.modifier_group_ids:
        await _link_modifiers(item_id, payload.modifier_group_ids, db)

    item_out = await get_sale_item(item_id, org_id, db)
    
    enqueue_event(
        org_id=org_id,
        event_type="product.created",
        payload=item_out,
        db=db
    )

    return item_out

async def get_sale_item(item_id: str, org_id: str, db):
    # This is a simplified fetch, ideally it would join variants, components, etc.
    res = db.table("sale_items").select("*, sale_item_variants(*), sale_item_components(*)").eq("id", item_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Sale item not found")
    return res.data[0]

# --- Customers Service ---

async def create_customer(org_id: str, payload: CustomerCreate, db):
    data = payload.model_dump()
    data["org_id"] = org_id
    data["credit_limit"] = float(data["credit_limit"])
    data["withholding_rate"] = float(data["withholding_rate"])
    res = db.table("customers").insert(data).execute()
    return res.data[0]

async def update_customer(org_id: str, customer_id: str, payload: CustomerUpdate, db):
    data = payload.model_dump(exclude_unset=True)
    if "credit_limit" in data and data["credit_limit"] is not None:
        data["credit_limit"] = float(data["credit_limit"])
    if "withholding_rate" in data and data["withholding_rate"] is not None:
        data["withholding_rate"] = float(data["withholding_rate"])
    res = db.table("customers").update(data).eq("id", customer_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Customer not found")
    return res.data[0]

async def delete_customer(org_id: str, customer_id: str, db):
    res = db.table("customers").delete().eq("id", customer_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Customer not found")
    return {"status": "deleted"}

async def get_customer(org_id: str, customer_id: str, db):
    res = db.table("customers").select("*").eq("id", customer_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Customer not found")
    return res.data[0]

async def list_customers(org_id: str, db):
    res = db.table("customers").select("*").eq("org_id", org_id).order("name").execute()
    return res.data

# --- Document Sequences Service ---

async def create_sequence(org_id: str, payload: DocumentSequenceCreate, db):
    data = payload.model_dump()
    data["org_id"] = org_id
    res = db.table("document_sequences").insert(data).execute()
    return res.data[0]

async def list_sequences(org_id: str, db):
    res = db.table("document_sequences").select("*").eq("org_id", org_id).execute()
    return res.data


# --- Currencies & Exchange Rates ---

async def create_currency(org_id: str, payload, db):
    data = payload.model_dump(exclude_unset=True)
    data["org_id"] = org_id
    res = db.table("currencies").insert(data).execute()
    return res.data[0]

async def list_currencies(org_id: str, db):
    res = db.table("currencies").select("*").eq("org_id", org_id).order("code").execute()
    return res.data

async def update_currency(org_id: str, currency_id: str, payload, db):
    data = payload.model_dump(exclude_unset=True)
    res = db.table("currencies").update(data).eq("id", currency_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Currency not found")
    return res.data[0]

async def create_exchange_rate(org_id: str, payload, user_id: str, db):
    data = payload.model_dump(exclude_unset=True)
    data["org_id"] = org_id
    data["created_by"] = user_id
    if "rate" in data:
        data["rate"] = float(data["rate"])
    if not data.get("effective_date"):
        data.pop("effective_date", None)
    res = db.table("exchange_rates").insert(data).execute()
    return res.data[0]

async def list_latest_exchange_rates(org_id: str, db):
    res = db.table("exchange_rates").select("*").eq("org_id", org_id).order("effective_date", desc=True).limit(50).execute()
    return res.data

# --- Taxes ---

async def list_taxes(org_id: str, db, active_only: bool = False):
    query = db.table("taxes").select("*").or_(f"org_id.is.null,org_id.eq.{org_id}").order("name")
    if active_only:
        query = query.eq("is_active", True)
    res = query.execute()
    return res.data or []

async def create_tax(org_id: str, payload, db):
    data = payload.model_dump(exclude_unset=True)
    data["org_id"] = org_id
    if "rate" in data:
        val = float(data["rate"])
        # If passed as integer/percentage (e.g. 16 for 16%), normalize to decimal (0.16)
        if val > 1.0:
            val = val / 100.0
        data["rate"] = val
    res = db.table("taxes").insert(data).execute()
    return res.data[0]

async def update_tax(org_id: str, tax_id: str, payload, db):
    data = payload.model_dump(exclude_unset=True)
    if "rate" in data and data["rate"] is not None:
        val = float(data["rate"])
        if val > 1.0:
            val = val / 100.0
        data["rate"] = val
    # Only allow updating organization-specific taxes (not global system taxes)
    res = db.table("taxes").update(data).eq("id", tax_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Tax not found or not authorized to modify (system taxes cannot be edited)")
    return res.data[0]

async def delete_tax(org_id: str, tax_id: str, db):
    # Soft delete / deactivate org tax
    res = db.table("taxes").update({"is_active": False}).eq("id", tax_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Tax not found or not authorized to modify (system taxes cannot be deleted)")
    return {"message": "Tax deactivated successfully"}


