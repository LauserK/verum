import uuid
from typing import Optional, Dict, Any

def get_integration_status(org_id: str, db) -> Dict[str, Any]:
    default_config = {
        "auto_sync_catalog": True,
        "sync_prices": True,
        "auto_inject_orders": True
    }
    try:
        # Check quick_integrations table
        res = db.table("quick_integrations").select("*").eq("org_id", org_id).execute()
        if res.data and len(res.data) > 0:
            row = res.data[0]
            ws_name = "VerumQuick POS"
            if row.get("workstation_id"):
                ws_res = db.table("workstations").select("name").eq("id", row["workstation_id"]).execute()
                if ws_res.data:
                    ws_name = ws_res.data[0]["name"]
            
            saved_config = row.get("config") or {}
            merged_config = {**default_config, **saved_config}
            
            return {
                "is_connected": row.get("is_active", True),
                "company_id": row.get("company_id"),
                "workstation_name": ws_name,
                "config": merged_config
            }
    except Exception as e:
        print("[INTEGRATION STATUS ERROR]", e)

    # Fallback to check workstations
    try:
        ws_res = db.table("workstations").select("name").eq("org_id", org_id).eq("name", "VerumQuick POS").execute()
        workstation_name = "VerumQuick POS" if ws_res.data else ""
        return {
            "is_connected": bool(ws_res.data),
            "company_id": "1",
            "workstation_name": workstation_name,
            "config": default_config
        }
    except Exception:
        return {
            "is_connected": False,
            "company_id": None,
            "workstation_name": "",
            "config": default_config
        }

def update_integration_config(org_id: str, new_config: Dict[str, Any], db) -> Dict[str, Any]:
    current_status = get_integration_status(org_id, db)
    current_config = current_status.get("config") or {}
    updated_config = {**current_config, **new_config}
    
    try:
        db.table("quick_integrations").update({
            "config": updated_config
        }).eq("org_id", org_id).execute()
    except Exception as e:
        print("Note on updating quick_integrations config:", e)
        
    return {"status": "success", "config": updated_config}

def complete_handshake(org_id: str, company_id: str, secret: str, db) -> Dict[str, Any]:
    workstation_id = None
    
    # 1. Get first venue of this org for the workstation
    venue_id = None
    try:
        venue_res = db.table("venues").select("id").eq("org_id", org_id).limit(1).execute()
        if venue_res.data and len(venue_res.data) > 0:
            venue_id = venue_res.data[0]["id"]
    except Exception as e:
        print("Note on fetching venue:", e)

    # 2. Ensure Workstation exists
    if venue_id:
        try:
            ws_res = db.table("workstations").select("id").eq("org_id", org_id).eq("name", "VerumQuick POS").execute()
            if ws_res.data and len(ws_res.data) > 0:
                workstation_id = ws_res.data[0]["id"]
            else:
                new_ws = db.table("workstations").insert({
                    "org_id": org_id,
                    "venue_id": venue_id,
                    "name": "VerumQuick POS",
                    "printer_type": "none",
                    "numbering_source": "external",
                    "is_active": True
                }).execute()
                if new_ws.data:
                    workstation_id = new_ws.data[0]["id"]
        except Exception as e:
            print("Note on workstation creation:", e)

    # 3. Save connection into quick_integrations table (or ignore if table not created yet)
    try:
        db.table("quick_integrations").upsert({
            "org_id": org_id,
            "company_id": company_id,
            "secret": secret,
            "is_active": True,
            "workstation_id": workstation_id
        }, on_conflict="org_id").execute()
    except Exception as e:
        print("Note on saving quick_integrations record:", e)

    return {
        "status": "success",
        "company_id": company_id
    }

def disconnect_integration(org_id: str, db) -> Dict[str, Any]:
    try:
        db.table("quick_integrations").update({
            "is_active": False
        }).eq("org_id", org_id).execute()
    except Exception as e:
        print("Note on disconnect:", e)
        
    return {"status": "disconnected"}


# ── Inbound Catalog Import from VerumQuick ──────────────────────────

def fetch_quick_remote_catalog(org_id: str, db) -> Dict[str, Any]:
    """
    Fetches catalog from VerumQuick POS API using HMAC signature.
    """
    import os, hmac, hashlib, json, httpx
    from config import settings

    integration_res = db.table("quick_integrations").select("*").eq("org_id", org_id).eq("is_active", True).execute()
    if not integration_res.data:
        raise ValueError("No active VerumQuick integration found for this organization.")

    integration = integration_res.data[0]
    secret = integration.get("secret", "")
    company_id = integration.get("company_id", "1")

    # Derive export URL from settings
    base_quick_url = "http://localhost:8080"
    if getattr(settings, "VERUM_QUICK_WEBHOOK_URL", None):
        # e.g., http://localhost:8080/integrations/api/verum/webhook/product -> http://localhost:8080
        parts = settings.VERUM_QUICK_WEBHOOK_URL.split("/integrations/")
        base_quick_url = parts[0]
    elif getattr(settings, "VERUM_QUICK_URL", None):
        base_quick_url = settings.VERUM_QUICK_URL.rstrip("/")

    export_url = os.environ.get("VERUM_QUICK_EXPORT_URL") or f"{base_quick_url}/integrations/api/verum/export-catalog"

    signature = hmac.new(secret.encode("utf-8"), str(company_id).encode("utf-8"), hashlib.sha256).hexdigest()
    headers = {
        "X-Verum-Signature": signature,
        "X-Verum-Company-Id": str(company_id)
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.get(export_url, headers=headers)
            if res.status_code == 200:
                return res.json()
            else:
                print(f"[QUICK EXPORT FETCH HTTP {res.status_code}]: {res.text} at {export_url}")
                raise ValueError(f"VerumQuick respondió con error {res.status_code}: {res.text}")
    except Exception as e:
        print(f"[QUICK EXPORT FETCH ERROR]: {e} at {export_url}")
        raise ValueError(f"No se pudo conectar a VerumQuick ({export_url}): {str(e)}")


def preview_quick_catalog(org_id: str, db) -> Dict[str, Any]:
    """
    Computes a preview diff of what will be imported from VerumQuick.
    """
    remote_data = fetch_quick_remote_catalog(org_id, db)
    raw_cats = remote_data.get("categories", [])
    remote_cats = [c for c in raw_cats if c.get("name", "").strip().lower() != "importados de verum"]
    remote_mods = remote_data.get("modifier_groups", [])
    remote_prods = remote_data.get("products", [])
    remote_pms = remote_data.get("payment_methods", [])

    # Local data
    local_cats_res = db.table("sale_categories").select("name").eq("org_id", org_id).execute()
    local_cat_names = {c["name"].lower() for c in (local_cats_res.data or []) if c.get("name")}

    local_mods_res = db.table("sale_modifier_groups").select("name").eq("org_id", org_id).execute()
    local_mod_names = {m["name"].lower() for m in (local_mods_res.data or []) if m.get("name")}

    local_prods_res = db.table("sale_items").select("name, code").eq("org_id", org_id).execute()
    local_prod_names = {p["name"].lower() for p in (local_prods_res.data or []) if p.get("name")}
    local_prod_codes = {p["code"].lower() for p in (local_prods_res.data or []) if p.get("code")}

    local_pms_res = db.table("payment_methods").select("name").eq("org_id", org_id).execute()
    local_pm_names = {pm["name"].lower() for pm in (local_pms_res.data or []) if pm.get("name")}

    # Diff categories
    existing_cats = sum(1 for c in remote_cats if c.get("name", "").lower() in local_cat_names)
    new_cats = len(remote_cats) - existing_cats

    # Diff modifier groups
    existing_mods = sum(1 for m in remote_mods if m.get("name", "").lower() in local_mod_names)
    new_mods = len(remote_mods) - existing_mods

    # Diff products
    existing_prods = 0
    for p in remote_prods:
        p_name = p.get("name", "").lower()
        p_code = p.get("code", "").lower()
        if (p_code and p_code in local_prod_codes) or (p_name and p_name in local_prod_names):
            existing_prods += 1
    new_prods = len(remote_prods) - existing_prods

    # Diff payment methods
    existing_pms = sum(1 for pm in remote_pms if pm.get("name", "").lower() in local_pm_names)
    new_pms = len(remote_pms) - existing_pms

    return {
        "total_categories": len(remote_cats),
        "new_categories": new_cats,
        "existing_categories": existing_cats,
        "total_modifier_groups": len(remote_mods),
        "new_modifier_groups": new_mods,
        "existing_modifier_groups": existing_mods,
        "total_products": len(remote_prods),
        "new_products": new_prods,
        "existing_products": existing_prods,
        "total_payment_methods": len(remote_pms),
        "new_payment_methods": new_pms,
        "existing_payment_methods": existing_pms,
        "categories_sample": [c["name"] for c in remote_cats[:5] if c.get("name")],
        "modifier_groups_sample": [m["name"] for m in remote_mods[:5] if m.get("name")],
        "products_sample": [p["name"] for p in remote_prods[:5] if p.get("name")],
        "payment_methods_sample": [pm["name"] for pm in remote_pms[:5] if pm.get("name")]
    }


async def execute_quick_catalog_import(org_id: str, payload: Any, db) -> Dict[str, Any]:
    """
    Imports Categories, Modifier Groups, Options, Products and Variants from VerumQuick into VERUM.
    """
    from app.cache import invalidate_sales_catalog

    remote_data = fetch_quick_remote_catalog(org_id, db)
    raw_cats = remote_data.get("categories", [])
    remote_cats = [c for c in raw_cats if c.get("name", "").strip().lower() != "importados de verum"]
    remote_mods = remote_data.get("modifier_groups", [])
    remote_prods = remote_data.get("products", [])

    stats = {
        "status": "success",
        "categories_imported": 0,
        "modifier_groups_imported": 0,
        "modifier_options_imported": 0,
        "products_created": 0,
        "products_updated": 0,
        "variants_imported": 0,
        "product_modifier_links_created": 0
    }

    # 1. Categories Mapping
    cat_id_map: Dict[Any, str] = {} # remote_id/name -> verum_id
    local_cats_res = db.table("sale_categories").select("id, name").eq("org_id", org_id).execute()
    local_cat_by_name = {c["name"].lower(): c["id"] for c in (local_cats_res.data or []) if c.get("name")}

    for c in remote_cats:
        c_name = c.get("name", "").strip()
        if not c_name:
            continue
        c_lower = c_name.lower()
        if c_lower in local_cat_by_name:
            cat_id_map[c.get("id")] = local_cat_by_name[c_lower]
            cat_id_map[c_name] = local_cat_by_name[c_lower]
        else:
            ins = db.table("sale_categories").insert({
                "org_id": org_id,
                "name": c_name,
                "icon": "lunch_dining",
                "is_active": True
            }).execute()
            if ins.data:
                new_id = ins.data[0]["id"]
                local_cat_by_name[c_lower] = new_id
                cat_id_map[c.get("id")] = new_id
                cat_id_map[c_name] = new_id
                stats["categories_imported"] += 1

    # 2. Modifier Groups & Options Mapping
    mod_id_map: Dict[Any, str] = {} # remote_id/name -> verum_id
    local_mods_res = db.table("sale_modifier_groups").select("id, name").eq("org_id", org_id).execute()
    local_mod_by_name = {m["name"].lower(): m["id"] for m in (local_mods_res.data or []) if m.get("name")}

    for mg in remote_mods:
        mg_name = mg.get("name", "").strip()
        if not mg_name:
            continue
        mg_lower = mg_name.lower()
        
        verum_group_id = None
        if mg_lower in local_mod_by_name:
            verum_group_id = local_mod_by_name[mg_lower]
        else:
            raw_max = mg.get("max_select")
            if raw_max is None:
                raw_max = mg.get("max_selection")
            
            # If max_selection is empty string, None or <= 0, store None (unlimited)
            clean_max = None
            if raw_max is not None and str(raw_max).strip() != "":
                val = int(raw_max)
                if val > 0:
                    clean_max = val

            ins = db.table("sale_modifier_groups").insert({
                "org_id": org_id,
                "name": mg_name,
                "min_selection": int(mg.get("min_select") or mg.get("min_selection") or 0),
                "max_selection": clean_max,
                "is_active": True
            }).execute()
            if ins.data:
                verum_group_id = ins.data[0]["id"]
                local_mod_by_name[mg_lower] = verum_group_id
                stats["modifier_groups_imported"] += 1

        if verum_group_id:
            mod_id_map[mg.get("id")] = verum_group_id
            mod_id_map[mg_name] = verum_group_id

            # Insert Options
            options = mg.get("modifiers") or mg.get("options") or []
            for opt_idx, opt in enumerate(options):
                opt_name = opt.get("name", "").strip()
                if not opt_name:
                    continue
                try:
                    db.table("sale_modifier_options").insert({
                        "group_id": verum_group_id,
                        "name": opt_name,
                        "price": float(opt.get("price") or opt.get("price_delta") or 0.0),
                        "food_cost": float(opt.get("food_cost") or 0.0),
                        "position": opt_idx,
                        "is_active": True
                    }).execute()
                    stats["modifier_options_imported"] += 1
                except Exception:
                    # Ignore duplicate option names in group
                    pass

    # 3. Products & Variants
    local_prods_res = db.table("sale_items").select("id, name, code").eq("org_id", org_id).execute()
    local_prod_by_code = {p["code"].lower(): p["id"] for p in (local_prods_res.data or []) if p.get("code")}
    local_prod_by_name = {p["name"].lower(): p["id"] for p in (local_prods_res.data or []) if p.get("name")}

    for p in remote_prods:
        p_name = p.get("name", "").strip()
        p_code = (p.get("code") or "").strip()
        if not p_name:
            continue

        existing_item_id = None
        if p_code and p_code.lower() in local_prod_by_code:
            existing_item_id = local_prod_by_code[p_code.lower()]
        elif p_name.lower() in local_prod_by_name:
            existing_item_id = local_prod_by_name[p_name.lower()]

        # Resolve category
        category_id = cat_id_map.get(p.get("category_id")) or cat_id_map.get(p.get("category_name"))

        has_variants = bool(p.get("variants"))
        item_data = {
            "name": p_name,
            "code": p_code or None,
            "sale_price": float(p.get("price") or p.get("sale_price") or 0.0),
            "food_cost": float(p.get("food_cost") or 0.0),
            "category_id": category_id,
            "description": p.get("description") or "",
            "has_variants": has_variants,
            "is_active": p.get("is_active", True)
        }

        item_id = None
        if existing_item_id:
            db.table("sale_items").update(item_data).eq("id", existing_item_id).eq("org_id", org_id).execute()
            item_id = existing_item_id
            stats["products_updated"] += 1
        else:
            item_data["org_id"] = org_id
            ins = db.table("sale_items").insert(item_data).execute()
            if ins.data:
                item_id = ins.data[0]["id"]
                if p_code:
                    local_prod_by_code[p_code.lower()] = item_id
                local_prod_by_name[p_name.lower()] = item_id
                stats["products_created"] += 1

        if not item_id:
            continue

        # Link modifier groups
        remote_mg_ids = p.get("modifier_group_ids") or []
        for r_mg_id in remote_mg_ids:
            mapped_group_id = mod_id_map.get(r_mg_id)
            if mapped_group_id:
                try:
                    db.table("sale_item_modifier_groups").insert({
                        "sale_item_id": item_id,
                        "modifier_group_id": mapped_group_id
                    }).execute()
                    stats["product_modifier_links_created"] += 1
                except Exception:
                    pass

        # Variants
        if has_variants:
            db.table("sale_item_variants").delete().eq("sale_item_id", item_id).execute()
            for v_idx, v in enumerate(p.get("variants", [])):
                v_name = v.get("name", "").strip()
                if not v_name:
                    continue
                db.table("sale_item_variants").insert({
                    "sale_item_id": item_id,
                    "name": v_name,
                    "price": float(v.get("price") or 0.0),
                    "food_cost": float(v.get("food_cost") or 0.0),
                    "external_code": v.get("external_code") or "",
                    "is_default": v.get("is_default", v_idx == 0),
                    "position": v_idx,
                    "is_active": True
                }).execute()
                stats["variants_imported"] += 1

    # 4. Payment Methods Import
    from app.cache import invalidate_sales_config
    remote_pms = remote_data.get("payment_methods", [])
    local_pms_res = db.table("payment_methods").select("id, name").eq("org_id", org_id).execute()
    local_pm_by_name = {pm["name"].lower(): pm["id"] for pm in (local_pms_res.data or []) if pm.get("name")}

    for pm in remote_pms:
        pm_name = pm.get("name", "").strip()
        if not pm_name:
            continue
        pm_lower = pm_name.lower()
        pm_data = {
            "name": pm_name,
            "method_type": pm.get("method_type", "other"),
            "currency_code": pm.get("currency_code"),
            "instructions": pm.get("instructions") or "",
            "requires_reference": pm.get("requires_reference", True),
            "is_active": pm.get("is_active", True),
            "position": pm.get("position", 0)
        }

        if pm_lower in local_pm_by_name:
            db.table("payment_methods").update(pm_data).eq("id", local_pm_by_name[pm_lower]).eq("org_id", org_id).execute()
        else:
            pm_data["org_id"] = org_id
            db.table("payment_methods").insert(pm_data).execute()
            stats["payment_methods_imported"] += 1

    await invalidate_sales_catalog(org_id)
    await invalidate_sales_config(org_id)
    return stats



