import uuid
from typing import Optional, Dict, Any

def get_integration_status(org_id: str, db) -> Dict[str, Any]:
    # Use tenant_billing_config for integration metadata
    # as tenant_billing_config exists in typical setup for tenant configs
    res = db.table("tenant_billing_config").select("*").eq("organization_id", org_id).execute()
    
    is_connected = False
    company_id = None
    
    if res.data and len(res.data) > 0:
        config = res.data[0]
        # We store metadata in a jsonb field like metadata or just use fields if they exist
        # For safety we check if quick_company_id exists or metadata
        if "metadata" in config and isinstance(config["metadata"], dict):
            metadata = config["metadata"]
            is_connected = metadata.get("quick_is_connected", False)
            company_id = metadata.get("quick_company_id")
    
    ws_res = db.table("workstations").select("name").eq("organization_id", org_id).eq("name", "VerumQuick POS").execute()
    workstation_name = "VerumQuick POS" if ws_res.data else ""

    return {
        "is_connected": is_connected,
        "company_id": company_id,
        "workstation_name": workstation_name
    }

def complete_handshake(org_id: str, company_id: str, secret: str, db) -> Dict[str, Any]:
    prof_res = db.table("profiles").select("id").eq("organization_id", org_id).eq("email", "quick@verum.local").execute()
    if not prof_res.data:
        db.table("profiles").insert({
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "email": "quick@verum.local",
            "full_name": "VerumQuick System",
        }).execute()
        
    ws_res = db.table("workstations").select("id").eq("organization_id", org_id).eq("name", "VerumQuick POS").execute()
    if not ws_res.data:
        db.table("workstations").insert({
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "name": "VerumQuick POS",
            "status": "active"
        }).execute()
        
    # Store connection info in tenant_billing_config's metadata
    config_res = db.table("tenant_billing_config").select("*").eq("organization_id", org_id).execute()
    if config_res.data:
        current_metadata = config_res.data[0].get("metadata") or {}
        current_metadata["quick_company_id"] = company_id
        current_metadata["quick_secret"] = secret
        current_metadata["quick_is_connected"] = True
        
        db.table("tenant_billing_config").update({
            "metadata": current_metadata
        }).eq("organization_id", org_id).execute()
    else:
        db.table("tenant_billing_config").insert({
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "metadata": {
                "quick_company_id": company_id,
                "quick_secret": secret,
                "quick_is_connected": True
            }
        }).execute()

    return {
        "status": "success",
        "company_id": company_id
    }

def disconnect_integration(org_id: str, db) -> Dict[str, Any]:
    config_res = db.table("tenant_billing_config").select("*").eq("organization_id", org_id).execute()
    if config_res.data:
        current_metadata = config_res.data[0].get("metadata") or {}
        current_metadata["quick_is_connected"] = False
        current_metadata["quick_company_id"] = None
        current_metadata["quick_secret"] = None
        db.table("tenant_billing_config").update({
            "metadata": current_metadata
        }).eq("organization_id", org_id).execute()
        
    return {"status": "disconnected"}
