from typing import List, Optional, Any, Dict
from uuid import UUID
from fastapi import HTTPException
from app.integrations.outbox import enqueue_event
from app.sales.schemas import (
    TenantBillingConfigUpdate, PaymentMethodCreate, WorkstationCreate, WorkstationUpdate,
    SaleItemCreate, SaleItemUpdate, SaleItemVariantCreate, SaleItemComponentCreate,
    SaleCategoryCreate, SaleCategoryUpdate, SaleModifierGroupCreate,
    CustomerCreate, CustomerUpdate, DocumentSequenceCreate,
    FloorPlanCreate, FloorPlanUpdate, TableCreate, TableUpdate,
    PosSessionOpen, PosSessionOut
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
    sync_to_quick = getattr(payload, "sync_to_quick", False)
    data = payload.model_dump(exclude={"sync_to_quick"})
    data["org_id"] = org_id
    res = db.table("payment_methods").insert(data).execute()
    created = res.data[0]

    if sync_to_quick:
        try:
            from app.integrations.outbox import enqueue_event
            enqueue_event(
                org_id=org_id,
                event_type="payment_method.created",
                payload=created,
                db=db
            )
        except Exception as e:
            print("[OUTBOX PAYMENT METHOD CREATE ERROR]:", e)

    return created

async def update_payment_method(org_id: str, method_id: str, payload: Any, db):
    sync_to_quick = getattr(payload, "sync_to_quick", False) if hasattr(payload, "sync_to_quick") else (payload.get("sync_to_quick") if isinstance(payload, dict) else False)
    data = payload.model_dump(exclude_unset=True, exclude={"sync_to_quick"}) if hasattr(payload, "model_dump") else {k: v for k, v in payload.items() if k != "sync_to_quick"}
    if not data:
        res = db.table("payment_methods").select("*").eq("id", method_id).eq("org_id", org_id).execute()
        return res.data[0] if res.data else None
    res = db.table("payment_methods").update(data).eq("id", method_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Payment method not found")
    updated = res.data[0]

    if sync_to_quick:
        try:
            from app.integrations.outbox import enqueue_event
            enqueue_event(
                org_id=org_id,
                event_type="payment_method.updated",
                payload=updated,
                db=db
            )
        except Exception as e:
            print("[OUTBOX PAYMENT METHOD UPDATE ERROR]:", e)

    return updated

async def delete_payment_method(org_id: str, method_id: str, db):
    res = db.table("payment_methods").delete().eq("id", method_id).eq("org_id", org_id).execute()
    return {"status": "deleted"}

async def get_payment_methods(org_id: str, db):
    res = db.table("payment_methods").select("*").eq("org_id", org_id).order("position").execute()
    return res.data or []

async def create_workstation(org_id: str, payload: WorkstationCreate, db):
    data = payload.model_dump(mode="json")
    data["org_id"] = org_id
    res = db.table("workstations").insert(data).execute()
    return res.data[0]

async def update_workstation(org_id: str, workstation_id: str, payload: WorkstationUpdate, db):
    update_data = payload.model_dump(mode="json", exclude_unset=True)
    if not update_data:
        res = db.table("workstations").select("*").eq("id", workstation_id).eq("org_id", org_id).execute()
        if not res.data:
            raise HTTPException(404, "Workstation not found")
        return res.data[0]
    res = db.table("workstations").update(update_data).eq("id", workstation_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Workstation not found")
    return res.data[0]

async def delete_workstation(org_id: str, workstation_id: str, db):
    res = db.table("workstations").delete().eq("id", workstation_id).eq("org_id", org_id).execute()
    return {"status": "deleted"}

async def get_workstations(org_id: str, venue_id: Optional[str], db):
    query = db.table("workstations").select("*").eq("org_id", org_id)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    res = query.execute()
    return res.data

# --- POS Sessions ---

async def open_pos_session(org_id: str, cashier_id: Optional[str], payload: PosSessionOpen, db):
    data = payload.model_dump(mode="json")
    data["org_id"] = org_id
    if cashier_id:
        data["cashier_id"] = str(cashier_id)
    data["status"] = "open"
    res = db.table("pos_sessions").insert(data).execute()
    if not res.data:
        raise HTTPException(400, "Could not open POS session")
    return res.data[0]

async def get_active_pos_session(org_id: str, workstation_id: Optional[str], db):
    query = db.table("pos_sessions").select("*").eq("org_id", org_id).eq("status", "open")
    if workstation_id:
        query = query.eq("workstation_id", workstation_id)
    res = query.order("opened_at", desc=True).limit(1).execute()
    return res.data[0] if res.data else None

# --- Catalog Service ---

# Categories
async def list_sale_categories(org_id: str, db):
    res = db.table("sale_categories").select("*").eq("org_id", org_id).order("position").execute()
    return res.data or []

async def create_sale_category(org_id: str, payload: SaleCategoryCreate, db):
    data = payload.model_dump()
    data["org_id"] = org_id
    res = db.table("sale_categories").insert(data).execute()
    return res.data[0]

async def update_sale_category(org_id: str, category_id: str, payload: SaleCategoryUpdate, db):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        res = db.table("sale_categories").select("*").eq("id", category_id).eq("org_id", org_id).execute()
        if not res.data:
            raise HTTPException(404, "Category not found")
        return res.data[0]
    res = db.table("sale_categories").update(data).eq("id", category_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Category not found")
    return res.data[0]

# Modifiers
async def list_modifier_groups(org_id: str, db):
    res = db.table("sale_modifier_groups").select("*, options:sale_modifier_options(*)").eq("org_id", org_id).order("position").execute()
    return res.data or []

async def create_modifier_group(org_id: str, payload: SaleModifierGroupCreate, db):
    data = payload.model_dump(exclude={"options"})
    data["org_id"] = org_id
    res = db.table("sale_modifier_groups").insert(data).execute()
    group = res.data[0]
    group_id = group["id"]
    
    if payload.options:
        opt_data = []
        for opt in payload.options:
            od = opt.model_dump()
            od["group_id"] = group_id
            od["price"] = float(od["price"])
            od["food_cost"] = float(od["food_cost"])
            if od.get("item_id"):
                od["item_id"] = str(od["item_id"])
            if od.get("deduct_qty") is not None:
                od["deduct_qty"] = float(od["deduct_qty"])
            opt_data.append(od)
        db.table("sale_modifier_options").insert(opt_data).execute()

    res = db.table("sale_modifier_groups").select("*, options:sale_modifier_options(*)").eq("id", group_id).eq("org_id", org_id).execute()
    return res.data[0]

async def update_modifier_group(org_id: str, group_id: str, payload: SaleModifierGroupCreate, db):
    existing = db.table("sale_modifier_groups").select("id").eq("id", group_id).eq("org_id", org_id).execute()
    if not existing.data:
        raise HTTPException(404, "Modifier group not found")

    data = payload.model_dump(exclude={"options"})
    db.table("sale_modifier_groups").update(data).eq("id", group_id).eq("org_id", org_id).execute()

    if payload.options is not None:
        db.table("sale_modifier_options").delete().eq("group_id", group_id).execute()
        if payload.options:
            opt_data = []
            for opt in payload.options:
                od = opt.model_dump()
                od["group_id"] = group_id
                od["price"] = float(od["price"])
                od["food_cost"] = float(od["food_cost"])
                if od.get("item_id"):
                    od["item_id"] = str(od["item_id"])
                if od.get("deduct_qty") is not None:
                    od["deduct_qty"] = float(od["deduct_qty"])
                opt_data.append(od)
            db.table("sale_modifier_options").insert(opt_data).execute()

    res = db.table("sale_modifier_groups").select("*, options:sale_modifier_options(*)").eq("id", group_id).eq("org_id", org_id).execute()
    return res.data[0]

async def delete_modifier_group(org_id: str, group_id: str, db):
    existing = db.table("sale_modifier_groups").select("id").eq("id", group_id).eq("org_id", org_id).execute()
    if not existing.data:
        raise HTTPException(404, "Modifier group not found")
    db.table("sale_modifier_groups").delete().eq("id", group_id).eq("org_id", org_id).execute()
    return {"status": "deleted", "id": group_id}

# Helper component & variant handlers
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

def _populate_item_relations(item: dict, all_categories: dict, all_taxes: dict, all_items: dict, all_variants: dict, all_components: dict, all_group_links: dict, all_groups: dict) -> dict:
    item_id = item["id"]
    
    # Category
    cat_id = item.get("category_id")
    if cat_id and cat_id in all_categories:
        item["category_name"] = all_categories[cat_id].get("name")
    else:
        item["category_name"] = None

    # Tax
    tax_id = item.get("tax_id")
    if tax_id and tax_id in all_taxes:
        item["tax_name"] = all_taxes[tax_id].get("name")
        item["tax_rate"] = all_taxes[tax_id].get("rate")
    else:
        item["tax_name"] = None
        item["tax_rate"] = None

    # Components directly on the sale item (where variant_id is None)
    item_comps = all_components.get((item_id, None), [])
    for comp in item_comps:
        raw_item = all_items.get(comp.get("item_id"))
        if raw_item:
            comp["item_name"] = raw_item.get("name")
            comp["item_code"] = raw_item.get("code")
    item["components"] = item_comps

    # Variants
    variants = all_variants.get(item_id, [])
    for var in variants:
        var_id = var["id"]
        var_comps = all_components.get((item_id, var_id), [])
        for comp in var_comps:
            raw_item = all_items.get(comp.get("item_id"))
            if raw_item:
                comp["item_name"] = raw_item.get("name")
                comp["item_code"] = raw_item.get("code")
        var["components"] = var_comps
    item["variants"] = variants

    # Modifier Groups
    linked_group_ids = all_group_links.get(item_id, [])
    item["modifier_groups"] = [all_groups[gid] for gid in linked_group_ids if gid in all_groups]

    return item

async def list_sale_items(org_id: str, category_id: Optional[str], active_only: bool, db):
    query = db.table("sale_items").select("*").eq("org_id", org_id)
    if category_id:
        query = query.eq("category_id", category_id)
    if active_only:
        query = query.eq("is_active", True)
    
    items_res = query.order("position").order("name").execute()
    raw_items = items_res.data or []
    if not raw_items:
        return []

    item_ids = [item["id"] for item in raw_items]

    # Pre-fetch categories
    cat_res = db.table("sale_categories").select("id, name").eq("org_id", org_id).execute()
    categories = {c["id"]: c for c in (cat_res.data or [])}

    # Pre-fetch taxes
    tax_res = db.table("taxes").select("id, name, rate").or_(f"org_id.is.null,org_id.eq.{org_id}").execute()
    taxes = {t["id"]: t for t in (tax_res.data or [])}

    # Pre-fetch variants
    var_res = db.table("sale_item_variants").select("*").in_("sale_item_id", item_ids).order("position").execute()
    variants_by_item = {}
    for var in (var_res.data or []):
        variants_by_item.setdefault(var["sale_item_id"], []).append(var)

    # Pre-fetch components
    comp_res = db.table("sale_item_components").select("*").in_("sale_item_id", item_ids).order("position").execute()
    components_by_key = {}
    raw_inv_item_ids = set()
    for comp in (comp_res.data or []):
        components_by_key.setdefault((comp["sale_item_id"], comp.get("variant_id")), []).append(comp)
        if comp.get("item_id"):
            raw_inv_item_ids.add(comp["item_id"])

    # Pre-fetch raw items for component names
    raw_items_dict = {}
    if raw_inv_item_ids:
        inv_res = db.table("items").select("id, name, code").in_("id", list(raw_inv_item_ids)).execute()
        raw_items_dict = {i["id"]: i for i in (inv_res.data or [])}

    # Pre-fetch modifier links & modifier groups
    mg_links_res = db.table("sale_item_modifier_groups").select("sale_item_id, group_id").in_("sale_item_id", item_ids).execute()
    group_links = {}
    used_group_ids = set()
    for link in (mg_links_res.data or []):
        group_links.setdefault(link["sale_item_id"], []).append(link["group_id"])
        used_group_ids.add(link["group_id"])

    groups_dict = {}
    if used_group_ids:
        mg_res = db.table("sale_modifier_groups").select("*, options:sale_modifier_options(*)").in_("id", list(used_group_ids)).execute()
        groups_dict = {g["id"]: g for g in (mg_res.data or [])}

    # Assemble
    result = []
    for item in raw_items:
        populated = _populate_item_relations(
            item=item,
            all_categories=categories,
            all_taxes=taxes,
            all_items=raw_items_dict,
            all_variants=variants_by_item,
            all_components=components_by_key,
            all_group_links=group_links,
            all_groups=groups_dict
        )
        result.append(populated)

    return result

async def get_sale_item(item_id: str, org_id: str, db):
    res = db.table("sale_items").select("*").eq("id", item_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Sale item not found")
    item = res.data[0]

    # Categories
    categories = {}
    if item.get("category_id"):
        cat_res = db.table("sale_categories").select("id, name").eq("id", item["category_id"]).execute()
        categories = {c["id"]: c for c in (cat_res.data or [])}

    # Taxes
    taxes = {}
    if item.get("tax_id"):
        tax_res = db.table("taxes").select("id, name, rate").eq("id", item["tax_id"]).execute()
        taxes = {t["id"]: t for t in (tax_res.data or [])}

    # Variants
    var_res = db.table("sale_item_variants").select("*").eq("sale_item_id", item_id).order("position").execute()
    variants_by_item = {item_id: var_res.data or []}

    # Components
    comp_res = db.table("sale_item_components").select("*").eq("sale_item_id", item_id).order("position").execute()
    components_by_key = {}
    raw_inv_item_ids = set()
    for comp in (comp_res.data or []):
        components_by_key.setdefault((comp["sale_item_id"], comp.get("variant_id")), []).append(comp)
        if comp.get("item_id"):
            raw_inv_item_ids.add(comp["item_id"])

    raw_items_dict = {}
    if raw_inv_item_ids:
        inv_res = db.table("items").select("id, name, code").in_("id", list(raw_inv_item_ids)).execute()
        raw_items_dict = {i["id"]: i for i in (inv_res.data or [])}

    # Modifier links
    mg_links_res = db.table("sale_item_modifier_groups").select("sale_item_id, group_id").eq("sale_item_id", item_id).execute()
    group_links = {}
    used_group_ids = set()
    for link in (mg_links_res.data or []):
        group_links.setdefault(link["sale_item_id"], []).append(link["group_id"])
        used_group_ids.add(link["group_id"])

    groups_dict = {}
    if used_group_ids:
        mg_res = db.table("sale_modifier_groups").select("*, options:sale_modifier_options(*)").in_("id", list(used_group_ids)).execute()
        groups_dict = {g["id"]: g for g in (mg_res.data or [])}

    return _populate_item_relations(
        item=item,
        all_categories=categories,
        all_taxes=taxes,
        all_items=raw_items_dict,
        all_variants=variants_by_item,
        all_components=components_by_key,
        all_group_links=group_links,
        all_groups=groups_dict
    )

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

    if payload.has_variants:
        if payload.variants:
            await _create_variants(item_id, payload.variants, db)
    else:
        if payload.components:
            await _create_components(item_id, None, payload.components, db)
        
    if payload.modifier_group_ids:
        await _link_modifiers(item_id, payload.modifier_group_ids, db)

    item_out = await get_sale_item(item_id, org_id, db)
    
    # Check if auto_sync_catalog is enabled in quick_integrations
    try:
        from app.integrations.service import get_integration_status
        int_status = get_integration_status(org_id, db)
        if int_status.get("is_connected") and int_status.get("config", {}).get("auto_sync_catalog", True):
            enqueue_event(
                org_id=org_id,
                event_type="product.created",
                payload=item_out,
                db=db
            )
    except Exception as e:
        print("[OUTBOX AUTO-SYNC] Note checking config:", e)

    return item_out

async def update_sale_item(org_id: str, item_id: str, payload: SaleItemUpdate, db):
    # Verify exists
    existing = db.table("sale_items").select("id").eq("id", item_id).eq("org_id", org_id).execute()
    if not existing.data:
        raise HTTPException(404, "Sale item not found")

    update_data = payload.model_dump(exclude_unset=True, exclude={"components", "variants", "modifier_group_ids"})
    if "sale_price" in update_data and update_data["sale_price"] is not None:
        update_data["sale_price"] = float(update_data["sale_price"])
    if "food_cost" in update_data and update_data["food_cost"] is not None:
        update_data["food_cost"] = float(update_data["food_cost"])
    if "category_id" in update_data and update_data["category_id"] is not None:
        update_data["category_id"] = str(update_data["category_id"])
    if "tax_id" in update_data and update_data["tax_id"] is not None:
        update_data["tax_id"] = str(update_data["tax_id"])

    if update_data:
        db.table("sale_items").update(update_data).eq("id", item_id).eq("org_id", org_id).execute()

    # Update variants if item has variants
    if payload.has_variants:
        db.table("sale_item_variants").delete().eq("sale_item_id", item_id).execute()
        db.table("sale_item_components").delete().eq("sale_item_id", item_id).execute()
        if payload.variants:
            await _create_variants(item_id, payload.variants, db)
    else:
        # If product does NOT have variants, clear variants and save base BOM components
        db.table("sale_item_variants").delete().eq("sale_item_id", item_id).execute()
        db.table("sale_item_components").delete().eq("sale_item_id", item_id).execute()
        if payload.components:
            await _create_components(item_id, None, payload.components, db)

    # Update modifier groups if explicitly passed
    if payload.modifier_group_ids is not None:
        db.table("sale_item_modifier_groups").delete().eq("sale_item_id", item_id).execute()
        if payload.modifier_group_ids:
            await _link_modifiers(item_id, payload.modifier_group_ids, db)

    item_out = await get_sale_item(item_id, org_id, db)

    # Check if auto_sync_catalog is enabled in quick_integrations
    try:
        from app.integrations.service import get_integration_status
        int_status = get_integration_status(org_id, db)
        if int_status.get("is_connected") and int_status.get("config", {}).get("auto_sync_catalog", True):
            enqueue_event(
                org_id=org_id,
                event_type="product.updated",
                payload=item_out,
                db=db
            )
    except Exception as e:
        print("[OUTBOX AUTO-SYNC] Note checking config:", e)

    return item_out

async def delete_sale_item(org_id: str, item_id: str, db):
    # Check exists
    existing = db.table("sale_items").select("id").eq("id", item_id).eq("org_id", org_id).execute()
    if not existing.data:
        raise HTTPException(404, "Sale item not found")
    
    db.table("sale_items").delete().eq("id", item_id).eq("org_id", org_id).execute()
    
    enqueue_event(
        org_id=org_id,
        event_type="product.deleted",
        payload={"id": item_id},
        db=db
    )
    
    return {"status": "deleted", "id": item_id}

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

# --- Cascade Cost from Inventory to Sale Items BOM ---

async def cascade_sale_items_cost_from_inventory(db, org_id: str, item_id: str):
    """
    When an inventory item (raw material or sub-recipe) updates its cost,
    recalculate the food_cost for all sale items that use this item in their BOM (sale_item_components).
    """
    # 1. Find all sale items that use this inventory item in their components
    comp_res = db.table("sale_item_components").select("sale_item_id").eq("item_id", str(item_id)).execute()
    affected_sale_item_ids = list(set(c["sale_item_id"] for c in (comp_res.data or []) if c.get("sale_item_id")))
    
    if not affected_sale_item_ids:
        return
        
    # 2. For each affected sale item, fetch all its components and the latest costs of those inventory items
    for sale_item_id in affected_sale_item_ids:
        all_comps_res = db.table("sale_item_components").select("item_id, quantity, variant_id").eq("sale_item_id", sale_item_id).execute()
        comps = all_comps_res.data or []
        if not comps:
            continue
            
        inv_ids = list(set(c["item_id"] for c in comps if c.get("item_id")))
        inv_items_res = db.table("items").select("id, last_purchase_cost, production_cost").in_("id", inv_ids).execute()
        inv_map = {i["id"]: (float(i.get("last_purchase_cost") or i.get("production_cost") or 0.0)) for i in (inv_items_res.data or [])}
        
        # Calculate total BOM food cost for base item (variant_id is null)
        base_comps = [c for c in comps if not c.get("variant_id")]
        if base_comps:
            total_food_cost = sum(float(c.get("quantity") or 0) * inv_map.get(c["item_id"], 0.0) for c in base_comps)
            db.table("sale_items").update({
                "food_cost": round(total_food_cost, 2)
            }).eq("id", sale_item_id).eq("org_id", org_id).execute()
            
        # Also update variants if variant-specific components exist
        variants_res = db.table("sale_item_variants").select("id").eq("sale_item_id", sale_item_id).execute()
        for var in (variants_res.data or []):
            var_id = var["id"]
            var_comps = [c for c in comps if c.get("variant_id") == var_id]
            if var_comps:
                var_food_cost = sum(float(c.get("quantity") or 0) * inv_map.get(c["item_id"], 0.0) for c in var_comps)
                db.table("sale_item_variants").update({
                    "food_cost": round(var_food_cost, 2)
                }).eq("id", var_id).execute()

# --- Floor Plans & Tables ---

async def list_floor_plans(org_id: str, venue_id: Optional[str] = None, db: Any = None):
    query = db.table("floor_plans").select("*").eq("org_id", org_id)
    if venue_id:
        query = query.eq("venue_id", str(venue_id))
    res = query.order("created_at").execute()
    plans = res.data or []

    if not plans:
        return []

    plan_ids = [p["id"] for p in plans]
    tables_res = db.table("tables").select("*").in_("floor_plan_id", plan_ids).execute()
    tables = tables_res.data or []

    tables_by_plan: Dict[str, List[dict]] = {p["id"]: [] for p in plans}
    for t in tables:
        pid = str(t["floor_plan_id"])
        if pid in tables_by_plan:
            tables_by_plan[pid].append(t)

    for p in plans:
        p["tables"] = tables_by_plan.get(str(p["id"]), [])

    return plans

async def get_floor_plan(org_id: str, plan_id: str, db: Any = None):
    res = db.table("floor_plans").select("*").eq("id", plan_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Floor plan not found")
    plan = res.data[0]

    tables_res = db.table("tables").select("*").eq("floor_plan_id", plan_id).execute()
    plan["tables"] = tables_res.data or []
    return plan

async def create_floor_plan(org_id: str, payload: FloorPlanCreate, db: Any = None):
    data = payload.model_dump(mode="json")
    data["org_id"] = org_id
    res = db.table("floor_plans").insert(data).execute()
    if not res.data:
        raise HTTPException(400, "Could not create floor plan")
    plan = res.data[0]
    plan["tables"] = []
    return plan

async def update_floor_plan(org_id: str, plan_id: str, payload: FloorPlanUpdate, db: Any = None):
    update_data = payload.model_dump(mode="json", exclude_unset=True)

    if not update_data:
        return await get_floor_plan(org_id, plan_id, db)

    res = db.table("floor_plans").update(update_data).eq("id", plan_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Floor plan not found")
    plan = res.data[0]

    tables_res = db.table("tables").select("*").eq("floor_plan_id", plan_id).execute()
    plan["tables"] = tables_res.data or []
    return plan

async def delete_floor_plan(org_id: str, plan_id: str, db: Any = None):
    res = db.table("floor_plans").delete().eq("id", plan_id).eq("org_id", org_id).execute()
    return {"status": "deleted"}

async def create_table(org_id: str, plan_id: str, payload: TableCreate, db: Any = None):
    # Verify plan belongs to org
    plan_res = db.table("floor_plans").select("id").eq("id", plan_id).eq("org_id", org_id).execute()
    if not plan_res.data:
        raise HTTPException(404, "Floor plan not found")

    data = payload.model_dump(mode="json")
    data["floor_plan_id"] = plan_id
    res = db.table("tables").insert(data).execute()
    if not res.data:
        raise HTTPException(400, "Could not create table")
    return res.data[0]

async def update_table(org_id: str, table_id: str, payload: TableUpdate, db: Any = None):
    update_data = payload.model_dump(mode="json", exclude_unset=True)
    if not update_data:
        res = db.table("tables").select("*").eq("id", table_id).execute()
        if not res.data:
            raise HTTPException(404, "Table not found")
        return res.data[0]

    res = db.table("tables").update(update_data).eq("id", table_id).execute()
    if not res.data:
        raise HTTPException(404, "Table not found")
    return res.data[0]

async def delete_table(org_id: str, table_id: str, db: Any = None):
    res = db.table("tables").delete().eq("id", table_id).execute()
    return {"status": "deleted"}



