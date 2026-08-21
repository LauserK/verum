import uuid
from typing import Optional, Dict, Any

def get_integration_status(org_id: str, db) -> Dict[str, Any]:
    try:
        res = db.table("tenant_billing_config").select("*").eq("org_id", org_id).execute()
        
        is_connected = False
        company_id = None
        
        if res.data and len(res.data) > 0:
            config = res.data[0]
            if "metadata" in config and isinstance(config["metadata"], dict):
                metadata = config["metadata"]
                is_connected = metadata.get("quick_is_connected", False)
                company_id = metadata.get("quick_company_id")
        
        ws_res = db.table("workstations").select("name").eq("org_id", org_id).eq("name", "VerumQuick POS").execute()
        workstation_name = "VerumQuick POS" if ws_res.data else ""

        return {
            "is_connected": is_connected,
            "company_id": company_id,
            "workstation_name": workstation_name
        }
    except Exception as e:
        print("Error getting integration status:", e)
        return {
            "is_connected": False,
            "company_id": None,
            "workstation_name": ""
        }

def complete_handshake(org_id: str, company_id: str, secret: str, db) -> Dict[str, Any]:
    try:
        prof_res = db.table("profiles").select("id").eq("org_id", org_id).eq("email", "quick@verum.local").execute()
        if not prof_res.data:
            db.table("profiles").insert({
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "email": "quick@verum.local",
                "full_name": "VerumQuick System",
            }).execute()
    except Exception as e:
        print("Note on profile creation:", e)
        
    try:
        ws_res = db.table("workstations").select("id").eq("org_id", org_id).eq("name", "VerumQuick POS").execute()
        if not ws_res.data:
            db.table("workstations").insert({
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "name": "VerumQuick POS",
            }).execute()
    except Exception as e:
        print("Note on workstation creation:", e)
        
    try:
        # Store connection info in tenant_billing_config's metadata or extra fields
        config_res = db.table("tenant_billing_config").select("*").eq("org_id", org_id).execute()
        if config_res.data:
            current_metadata = config_res.data[0].get("metadata") or {}
            current_metadata["quick_company_id"] = company_id
            current_metadata["quick_secret"] = secret
            current_metadata["quick_is_connected"] = True
            
            db.table("tenant_billing_config").update({
                "metadata": current_metadata
            }).eq("org_id", org_id).execute()
        else:
            db.table("tenant_billing_config").insert({
                "org_id": org_id,
                "metadata": {
                    "quick_company_id": company_id,
                    "quick_secret": secret,
                    "quick_is_connected": True
                }
            }).execute()
    except Exception as e:
        print("Note on config update:", e)

    return {
        "status": "success",
        "company_id": company_id
    }

def disconnect_integration(org_id: str, db) -> Dict[str, Any]:
    try:
        config_res = db.table("tenant_billing_config").select("*").eq("org_id", org_id).execute()
        if config_res.data:
            current_metadata = config_res.data[0].get("metadata") or {}
            current_metadata["quick_is_connected"] = False
            current_metadata["quick_company_id"] = None
            current_metadata["quick_secret"] = None
            db.table("tenant_billing_config").update({
                "metadata": current_metadata
            }).eq("org_id", org_id).execute()
    except Exception as e:
        print("Error on disconnect:", e)
        
    return {"status": "disconnected"}

