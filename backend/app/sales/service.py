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
    PosSessionOpen, PosSessionOut,
    SaleModeConfigCreate, SaleModeConfigUpdate
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

    from app.cache import invalidate_sales_config
    await invalidate_sales_config(org_id)

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

    from app.cache import invalidate_sales_config
    await invalidate_sales_config(org_id)

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
    from app.cache import invalidate_sales_config
    await invalidate_sales_config(org_id)
    return {"status": "deleted"}

async def get_payment_methods(org_id: str, db):
    from app.cache import cache
    cache_key = f"sales:payment_methods:{org_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    res = db.table("payment_methods").select("*").eq("org_id", org_id).order("position").execute()
    result = res.data or []
    # Cache for 9 hours (32400 seconds)
    await cache.set(cache_key, result, ttl=32400)
    return result

async def create_workstation(org_id: str, payload: WorkstationCreate, db):
    data = payload.model_dump(mode="json")
    data["org_id"] = org_id
    res = db.table("workstations").insert(data).execute()
    from app.cache import invalidate_workstations
    await invalidate_workstations(org_id)
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
    from app.cache import invalidate_workstations
    await invalidate_workstations(org_id)
    return res.data[0]

async def delete_workstation(org_id: str, workstation_id: str, db):
    res = db.table("workstations").delete().eq("id", workstation_id).eq("org_id", org_id).execute()
    from app.cache import invalidate_workstations
    await invalidate_workstations(org_id)
    return {"status": "deleted"}

async def get_workstations(org_id: str, venue_id: Optional[str], db):
    from app.cache import cache
    cache_key = f"sales:workstations:{org_id}:{venue_id or 'all'}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    query = db.table("workstations").select("*").eq("org_id", org_id)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    res = query.execute()
    result = res.data or []
    await cache.set(cache_key, result, ttl=32400)
    return result

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
    session = res.data[0]

    from app.cache import invalidate_pos_session
    await invalidate_pos_session(org_id)
    return session

async def get_active_pos_session(org_id: str, workstation_id: Optional[str], db):
    from app.cache import cache
    cache_key = f"pos:session:active:{org_id}:{workstation_id or 'all'}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    query = db.table("pos_sessions").select("*").eq("org_id", org_id).eq("status", "open")
    if workstation_id:
        query = query.eq("workstation_id", workstation_id)
    res = query.order("opened_at", desc=True).limit(1).execute()
    session = res.data[0] if res.data else None

    if session:
        # Cache active open session for 2 hours (invalidated on session close/open)
        await cache.set(cache_key, session, ttl=7200)

    return session

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

# ── Sale Mode Config CRUD ──

async def list_sale_mode_configs(org_id: str, db: Any = None):
    res = db.table("sale_mode_config").select("*").eq("org_id", org_id).order("mode").execute()
    return res.data or []


async def create_sale_mode_config(org_id: str, payload: SaleModeConfigCreate, db: Any = None):
    data = payload.model_dump(mode="json")
    data["org_id"] = org_id
    res = db.table("sale_mode_config").insert(data).execute()
    if not res.data:
        raise HTTPException(400, "Could not create sale mode config")
    return res.data[0]


async def update_sale_mode_config(org_id: str, config_id: str, payload: SaleModeConfigUpdate, db: Any = None):
    data = payload.model_dump(mode="json", exclude_unset=True)
    if not data:
        raise HTTPException(400, "No fields to update")
    data["updated_at"] = "now()"
    res = db.table("sale_mode_config").update(data).eq("id", config_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Sale mode config not found")
    return res.data[0]


async def delete_sale_mode_config(org_id: str, config_id: str, db: Any = None):
    db.table("sale_mode_config").delete().eq("id", config_id).eq("org_id", org_id).execute()
    return {"status": "deleted"}


# ── POS Config Resolution (cascade with Redis cache) ──

async def resolve_pos_config(org_id: str, workstation_id: str, mode: str, db: Any = None):
    from app.cache import cache

    cache_key = f"pos:config:{org_id}:{workstation_id}:{mode}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    # 1. Read workstation
    wk_res = db.table("workstations").select("warehouse_id, customer_requirement").eq("id", workstation_id).eq("org_id", org_id).execute()
    if not wk_res.data:
        raise HTTPException(404, "Workstation not found")
    wk = wk_res.data[0]

    # 2. Resolve customer_requirement in cascade
    req = None
    resolved_from = "default"

    if wk.get("customer_requirement"):
        req = wk["customer_requirement"]
        resolved_from = "workstation"
    else:
        sm_res = db.table("sale_mode_config").select("customer_requirement").eq("org_id", org_id).eq("mode", mode).execute()
        if sm_res.data and sm_res.data[0].get("customer_requirement"):
            req = sm_res.data[0]["customer_requirement"]
            resolved_from = "sale_mode_config"
        else:
            tb_res = db.table("tenant_billing_config").select("customer_requirement").eq("org_id", org_id).execute()
            if tb_res.data and tb_res.data[0].get("customer_requirement"):
                req = tb_res.data[0]["customer_requirement"]
                resolved_from = "tenant_billing_config"

    if req is None:
        req = "optional"

    result = {
        "customer_requirement": req,
        "warehouse_id": wk.get("warehouse_id"),
        "resolved_from": resolved_from
    }
    await cache.set(cache_key, result, ttl=32400)
    return result


# ── POS Table Orders (Multi-terminal real-time sync) ──

async def list_active_table_orders(org_id: str, venue_id: Optional[str] = None, db: Any = None):
    from app.cache import cache
    cache_key = f"sales:table_orders:{org_id}:{venue_id or 'all'}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    query = db.table("pos_table_orders").select("*").eq("org_id", org_id).eq("status", "active")
    if venue_id:
        query = query.eq("venue_id", str(venue_id))
    res = query.order("updated_at", desc=True).execute()
    orders = res.data or []

    # Cache for 30s in Redis
    await cache.set(cache_key, orders, ttl=30)
    return orders


async def get_active_table_order(org_id: str, table_id: str, db: Any = None):
    res = db.table("pos_table_orders").select("*").eq("org_id", org_id).eq("table_id", str(table_id)).eq("status", "active").limit(1).execute()
    return res.data[0] if res.data else None


async def sync_table_order(org_id: str, user_id: str, payload: Any, db: Any = None):
    from app.cache import invalidate_table_orders

    mode = getattr(payload, "mode", "tables") or "tables"
    table_id = str(payload.table_id) if payload.table_id else None
    tab_name = payload.tab_name or payload.table_name or (
        "Barra" if mode == "bar" else
        "Delivery" if mode == "delivery" else
        "Para Llevar" if mode == "takeout" else
        "Pick-up" if mode == "pickup" else "Mesa"
    )
    cart = payload.cart or []
    total = float(payload.total or 0)

    # 1. If cart is empty or cleared, mark cancelled / clear active order
    if not cart or total <= 0:
        query = db.table("pos_table_orders").update({
            "status": "cancelled",
            "updated_at": "now()"
        }).eq("org_id", org_id).eq("status", "active")
        if table_id:
            query = query.eq("table_id", table_id)
        elif getattr(payload, "id", None):
            query = query.eq("id", str(payload.id))
        else:
            query = query.eq("mode", mode).eq("workstation_id", str(payload.workstation_id) if payload.workstation_id else None)
        query.execute()

        await invalidate_table_orders(org_id)
        return {"status": "cleared", "table_id": table_id}

    # 2. Find existing active order
    query = db.table("pos_table_orders").select("id").eq("org_id", org_id).eq("status", "active")
    if table_id:
        query = query.eq("table_id", table_id)
    elif getattr(payload, "id", None):
        query = query.eq("id", str(payload.id))
    else:
        # Match on workstation & mode
        query = query.eq("mode", mode)
        if payload.workstation_id:
            query = query.eq("workstation_id", str(payload.workstation_id))

    existing = query.limit(1).execute()

    venue_id = str(payload.venue_id) if payload.venue_id else None
    if not venue_id and payload.workstation_id:
        try:
            wk_res = db.table("workstations").select("venue_id").eq("id", str(payload.workstation_id)).execute()
            if wk_res.data and wk_res.data[0].get("venue_id"):
                venue_id = str(wk_res.data[0]["venue_id"])
        except Exception:
            pass

    if not venue_id:
        try:
            v_res = db.table("venues").select("id").eq("org_id", org_id).limit(1).execute()
            if v_res.data:
                venue_id = str(v_res.data[0]["id"])
        except Exception:
            pass

    if not venue_id:
        raise HTTPException(400, "venue_id is required to register an active POS order")

    if existing.data:
        order_id = existing.data[0]["id"]
        update_data = {
            "venue_id": venue_id,
            "mode": mode,
            "table_id": table_id,
            "table_name": payload.table_name,
            "tab_name": tab_name,
            "customer_id": str(payload.customer_id) if payload.customer_id else None,
            "customer_name": payload.customer_name,
            "customer_tax_id": payload.customer_tax_id,
            "cart": cart,
            "total": total,
            "order_number": payload.order_number,
            "workstation_id": str(payload.workstation_id) if payload.workstation_id else None,
            "updated_at": "now()",
        }
        res = db.table("pos_table_orders").update(update_data).eq("id", order_id).execute()
        saved = res.data[0] if res.data else update_data
    else:
        insert_data = {
            "org_id": org_id,
            "venue_id": venue_id,
            "mode": mode,
            "table_id": table_id,
            "table_name": payload.table_name,
            "tab_name": tab_name,
            "customer_id": str(payload.customer_id) if payload.customer_id else None,
            "customer_name": payload.customer_name,
            "customer_tax_id": payload.customer_tax_id,
            "cart": cart,
            "total": total,
            "order_number": payload.order_number,
            "workstation_id": str(payload.workstation_id) if payload.workstation_id else None,
            "created_by": str(user_id) if user_id else None,
            "status": "active",
        }
        res = db.table("pos_table_orders").insert(insert_data).execute()
        saved = res.data[0] if res.data else insert_data

    await invalidate_table_orders(org_id)
    return saved


async def update_table_order(org_id: str, table_id: str, payload: Any, db: Any = None):
    from app.cache import invalidate_table_orders
    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else {k: v for k, v in payload.items() if v is not None}
    
    # Handle UUID string conversion
    if "assigned_to" in data and data["assigned_to"]:
        data["assigned_to"] = str(data["assigned_to"])
    if "customer_id" in data and data["customer_id"]:
        data["customer_id"] = str(data["customer_id"])
    if "status" in data and data["status"] == "pre_bill" and "pre_bill_requested_at" not in data:
        data["pre_bill_requested_at"] = "now()"

    data["updated_at"] = "now()"

    query = db.table("pos_table_orders").update(data).eq("org_id", org_id).in_("status", ["active", "pre_bill"])
    try:
        from uuid import UUID
        UUID(str(table_id))
        query = query.or_(f"table_id.eq.{table_id},id.eq.{table_id}")
    except ValueError:
        query = query.eq("table_id", str(table_id))

    res = query.execute()
    if not res.data:
        raise HTTPException(404, "Active table order not found")

    await invalidate_table_orders(org_id)
    return res.data[0]


async def transfer_table_order(org_id: str, user_id: str, payload: Any, db: Any = None):
    from app.cache import invalidate_table_orders

    source_table_id = str(payload.source_table_id)
    target_table_id = str(payload.target_table_id)
    transfer_type = payload.transfer_type  # 'full', 'items', 'seat'
    item_ids = [str(x) for x in (payload.item_ids or [])]
    seat_id = str(payload.seat_id) if payload.seat_id else None

    # 1. Fetch active source order
    src_res = db.table("pos_table_orders").select("*").eq("org_id", org_id).eq("table_id", source_table_id).in_("status", ["active", "pre_bill"]).limit(1).execute()
    if not src_res.data:
        raise HTTPException(404, f"No active order found for source table {source_table_id}")
    source_order = src_res.data[0]
    source_cart = source_order.get("cart") or []
    source_seats = source_order.get("seats") or []

    # 2. Fetch destination table details (to get name)
    target_table_res = db.table("tables").select("name, venue_id").eq("id", target_table_id).execute()
    target_table_name = target_table_res.data[0]["name"] if target_table_res.data else f"Mesa {target_table_id}"
    target_venue_id = target_table_res.data[0]["venue_id"] if target_table_res.data and target_table_res.data[0].get("venue_id") else source_order.get("venue_id")

    # 3. Check if target table already has an active order
    tgt_res = db.table("pos_table_orders").select("*").eq("org_id", org_id).eq("table_id", target_table_id).in_("status", ["active", "pre_bill"]).limit(1).execute()
    target_order = tgt_res.data[0] if tgt_res.data else None

    items_transferred = []

    if transfer_type == "full":
        items_transferred = list(source_cart)
        if target_order:
            # Merge whole source into target
            new_cart = list(target_order.get("cart") or []) + source_cart
            new_seats = list(target_order.get("seats") or [])
            for s in source_seats:
                if not any(ts.get("id") == s.get("id") for ts in new_seats):
                    new_seats.append(s)
            new_total = sum(float(i.get("price", 0)) * int(i.get("quantity", 1)) for i in new_cart)
            
            merged_from = list(target_order.get("merged_from") or [])
            if source_order["id"] not in merged_from:
                merged_from.append(source_order["id"])

            db.table("pos_table_orders").update({
                "cart": new_cart,
                "seats": new_seats,
                "total": new_total,
                "merged_from": merged_from,
                "updated_at": "now()"
            }).eq("id", target_order["id"]).execute()
        else:
            # Move source order to target table
            db.table("pos_table_orders").update({
                "table_id": target_table_id,
                "table_name": target_table_name,
                "venue_id": target_venue_id,
                "updated_at": "now()"
            }).eq("id", source_order["id"]).execute()

        # If target existed and merged into, mark source cancelled
        if target_order:
            db.table("pos_table_orders").update({
                "status": "cancelled",
                "updated_at": "now()"
            }).eq("id", source_order["id"]).execute()

    elif transfer_type in ("items", "seat"):
        # Identify items to transfer
        if transfer_type == "seat" and seat_id:
            items_to_move = [i for i in source_cart if str(i.get("seat")) == seat_id]
            remaining_items = [i for i in source_cart if str(i.get("seat")) != seat_id]
            # Also move seat definition if present
            moving_seat_def = [s for s in source_seats if str(s.get("id")) == seat_id]
            remaining_seats = [s for s in source_seats if str(s.get("id")) != seat_id]
        else:
            # By item_ids (cartItemId or id)
            items_to_move = [i for i in source_cart if str(i.get("cartItemId", i.get("id"))) in item_ids or str(i.get("id")) in item_ids]
            remaining_items = [i for i in source_cart if str(i.get("cartItemId", i.get("id"))) not in item_ids and str(i.get("id")) not in item_ids]
            moving_seat_def = []
            remaining_seats = source_seats

        if not items_to_move:
            raise HTTPException(400, "No items selected to transfer")

        items_transferred = items_to_move

        # Add items to target order (create target order if none exists)
        if target_order:
            target_cart = list(target_order.get("cart") or []) + items_to_move
            target_seats = list(target_order.get("seats") or [])
            for s in moving_seat_def:
                if not any(ts.get("id") == s.get("id") for ts in target_seats):
                    target_seats.append(s)
            target_total = sum(float(i.get("price", 0)) * int(i.get("quantity", 1)) for i in target_cart)
            
            db.table("pos_table_orders").update({
                "cart": target_cart,
                "seats": target_seats,
                "total": target_total,
                "updated_at": "now()"
            }).eq("id", target_order["id"]).execute()
        else:
            target_total = sum(float(i.get("price", 0)) * int(i.get("quantity", 1)) for i in items_to_move)
            db.table("pos_table_orders").insert({
                "org_id": org_id,
                "venue_id": target_venue_id,
                "mode": "tables",
                "table_id": target_table_id,
                "table_name": target_table_name,
                "tab_name": f"Mesa {target_table_name}",
                "cart": items_to_move,
                "seats": moving_seat_def,
                "total": target_total,
                "created_by": str(user_id) if user_id else None,
                "status": "active",
                "opened_at": "now()"
            }).execute()

        # Update or cancel source order
        if not remaining_items:
            db.table("pos_table_orders").update({
                "cart": [],
                "total": 0,
                "status": "cancelled",
                "updated_at": "now()"
            }).eq("id", source_order["id"]).execute()
        else:
            remaining_total = sum(float(i.get("price", 0)) * int(i.get("quantity", 1)) for i in remaining_items)
            db.table("pos_table_orders").update({
                "cart": remaining_items,
                "seats": remaining_seats,
                "total": remaining_total,
                "updated_at": "now()"
            }).eq("id", source_order["id"]).execute()

    else:
        raise HTTPException(400, f"Unsupported transfer_type: {transfer_type}")

    # 4. Log to pos_transfer_log
    try:
        db.table("pos_transfer_log").insert({
            "org_id": org_id,
            "source_table_id": source_table_id,
            "target_table_id": target_table_id,
            "transfer_type": transfer_type,
            "items_transferred": items_transferred,
            "performed_by": str(user_id) if user_id else None,
        }).execute()
    except Exception:
        pass

    await invalidate_table_orders(org_id)
    return {
        "status": "transferred",
        "source_table_id": source_table_id,
        "target_table_id": target_table_id,
        "transfer_type": transfer_type,
        "transferred_count": len(items_transferred)
    }


async def merge_table_orders(org_id: str, user_id: str, payload: Any, db: Any = None):
    from app.cache import invalidate_table_orders

    source_table_id = str(payload.source_table_id)
    target_table_id = str(payload.target_table_id)

    if source_table_id == target_table_id:
        raise HTTPException(400, "Source and target table must be different")

    # 1. Fetch source order
    src_res = db.table("pos_table_orders").select("*").eq("org_id", org_id).eq("table_id", source_table_id).in_("status", ["active", "pre_bill"]).limit(1).execute()
    if not src_res.data:
        raise HTTPException(404, f"No active order found for source table {source_table_id}")
    source_order = src_res.data[0]

    # 2. Fetch destination table & order
    tgt_res = db.table("pos_table_orders").select("*").eq("org_id", org_id).eq("table_id", target_table_id).in_("status", ["active", "pre_bill"]).limit(1).execute()
    if not tgt_res.data:
        raise HTTPException(404, f"No active order found for target table {target_table_id}")
    target_order = tgt_res.data[0]

    source_cart = source_order.get("cart") or []
    source_seats = source_order.get("seats") or []
    target_cart = target_order.get("cart") or []
    target_seats = target_order.get("seats") or []

    # Merge items and seats
    merged_cart = list(target_cart) + list(source_cart)
    merged_seats = list(target_seats)
    for s in source_seats:
        if not any(ts.get("id") == s.get("id") for ts in merged_seats):
            merged_seats.append(s)

    merged_total = sum(float(i.get("price", 0)) * int(i.get("quantity", 1)) for i in merged_cart)

    merged_from = list(target_order.get("merged_from") or [])
    if source_order["id"] not in merged_from:
        merged_from.append(source_order["id"])

    # Update target order
    db.table("pos_table_orders").update({
        "cart": merged_cart,
        "seats": merged_seats,
        "total": merged_total,
        "merged_from": merged_from,
        "updated_at": "now()"
    }).eq("id", target_order["id"]).execute()

    # Cancel source order
    db.table("pos_table_orders").update({
        "status": "cancelled",
        "updated_at": "now()"
    }).eq("id", source_order["id"]).execute()

    # Log to pos_transfer_log
    try:
        db.table("pos_transfer_log").insert({
            "org_id": org_id,
            "source_table_id": source_table_id,
            "target_table_id": target_table_id,
            "transfer_type": "merge",
            "items_transferred": source_cart,
            "performed_by": str(user_id) if user_id else None,
        }).execute()
    except Exception:
        pass

    await invalidate_table_orders(org_id)
    return {
        "status": "merged",
        "source_table_id": source_table_id,
        "target_table_id": target_table_id,
        "merged_items_count": len(source_cart),
        "new_total": merged_total
    }


async def delete_table_order(org_id: str, table_id: str, db: Any = None):
    from app.cache import invalidate_table_orders
    query = db.table("pos_table_orders").update({
        "status": "cancelled",
        "updated_at": "now()"
    }).eq("org_id", org_id).in_("status", ["active", "pre_bill"])

    # table_id can be a table_id string or a record UUID
    try:
        from uuid import UUID
        UUID(str(table_id))
        query = query.or_(f"table_id.eq.{table_id},id.eq.{table_id}")
    except ValueError:
        query = query.eq("table_id", str(table_id))

    query.execute()
    await invalidate_table_orders(org_id)
    return {"status": "deleted", "table_id": table_id}


async def get_invoice_by_table_order(org_id: str, table_order_id: str, db: Any = None):
    from app.sales.invoice_service import get_invoice_by_table_order as _get_inv
    return await _get_inv(org_id, table_order_id, db)







