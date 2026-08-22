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


