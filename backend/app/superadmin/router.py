from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
def get_db():
    from main import get_db as main_get_db
    return main_get_db()
from permissions import get_super_admin
from auth_deps import security, get_current_user

# From root schemas/admin schemas
from app.admin.schemas import CreateOrgRequest, CreateVenueRequest, UpdateVenueRequest

# From superadmin schemas
from app.superadmin.schemas import (
    SuperAdminOrgDetail,
    SuperAdminUserDetail,
    SuperAdminUserOrgAdd,
    SuperAdminUserOrgUpdate,
)

router = APIRouter(prefix="/super-admin", tags=["Super Admin"])

@router.get("/organizations")
async def super_list_organizations(user=Depends(get_super_admin)):
    db = get_db()
    res = db.table("organizations").select("*").execute()
    return res.data or []

@router.post("/organizations")
async def super_create_organization(body: CreateOrgRequest, user=Depends(get_super_admin)):
    from app.admin.router import seed_org_roles
    db = get_db()
    res = db.table("organizations").insert({"name": body.name}).execute()
    if res.data:
        org = res.data[0]
        # Seed default roles for this new organization
        await seed_org_roles(org["id"], db)
        return org
    raise HTTPException(500, "Failed to create organization")

@router.patch("/organizations/{org_id}")
async def super_update_organization(org_id: str, body: dict, user=Depends(get_super_admin)):
    db = get_db()
    res = db.table("organizations").update(body).eq("id", org_id).execute()
    return res.data[0] if res.data else {}

@router.get("/organizations/{org_id}", response_model=SuperAdminOrgDetail)
async def super_get_org_detail(org_id: str, user=Depends(get_super_admin)):
    db = get_db()
    # 1. Get organization
    o_res = db.table("organizations").select("*").eq("id", org_id).single().execute()
    if not o_res.data:
        raise HTTPException(404, "Organization not found")
    org = o_res.data

    # 2. Get venues
    v_res = db.table("venues").select("*").eq("org_id", org_id).execute()
    venues = v_res.data or []

    # 3. Get users associated with this organization
    u_res = db.table("profile_organizations") \
        .select("profile_id, profiles(full_name), custom_roles(name)") \
        .eq("organization_id", org_id).execute()
    
    users_detail = []
    for item in (u_res.data or []):
        p_data = item.get("profiles")
        if not p_data: continue
        
        role_name = "staff"
        if item.get("custom_roles"):
            role_name = item["custom_roles"]["name"]
        
        users_detail.append({
            "id": item["profile_id"],
            "full_name": p_data["full_name"],
            "role_name": role_name
        })

    return {
        "id": org["id"],
        "name": org["name"],
        "is_active": org.get("is_active", True),
        "venues": venues,
        "users": users_detail
    }

@router.post("/organizations/{org_id}/venues")
async def super_create_org_venue(org_id: str, body: CreateVenueRequest, user=Depends(get_super_admin)):
    db = get_db()
    # Force the org_id from the URL path
    payload = {"org_id": org_id, "name": body.name, "address": body.address}
    res = db.table("venues").insert(payload).execute()
    return res.data[0]

@router.patch("/venues/{venue_id}")
async def super_update_venue(venue_id: str, body: UpdateVenueRequest, user=Depends(get_super_admin)):
    db = get_db()
    payload = body.dict(exclude_none=True)
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("venues").update(payload).eq("id", venue_id).execute()
    return res.data[0] if res.data else {}

@router.delete("/venues/{venue_id}")
async def super_delete_venue(venue_id: str, user=Depends(get_super_admin)):
    db = get_db()
    db.table("venues").delete().eq("id", venue_id).execute()
    return {"ok": True}

@router.get("/users")
async def super_list_users(user=Depends(get_super_admin)):
    db = get_db()
    # List all users with their primary organization info
    # Specify the relationship to avoid ambiguity
    res = db.table("profiles").select("*, organizations!profiles_organization_id_fkey(name)").execute()
    return res.data or []

@router.patch("/users/{user_id}/super-admin")
async def super_promote_user(user_id: str, body: dict, user=Depends(get_super_admin)):
    db = get_db()
    is_super = body.get("is_superadmin", False)
    res = db.table("profiles").update({"is_superadmin": is_super}).eq("id", user_id).execute()
    return res.data[0] if res.data else {}

@router.get("/users/{user_id}", response_model=SuperAdminUserDetail)
async def super_get_user_detail(user_id: str, user=Depends(get_super_admin)):
    db = get_db()
    # 1. Get profile
    p_res = db.table("profiles").select("*").eq("id", user_id).single().execute()
    if not p_res.data:
        raise HTTPException(404, "Profile not found")
    profile = p_res.data

    # 2. Get email from Auth
    email = None
    try:
        auth_user = db.auth.admin.get_user_by_id(user_id)
        email = auth_user.user.email if auth_user.user else None
    except Exception:
        pass

    # 3. Get organizations
    orgs_res = db.table("profile_organizations") \
        .select("organization_id, role_id, organizations(name), custom_roles(name)") \
        .eq("profile_id", user_id).execute()
    
    # 4. Get venues
    venues_res = db.table("profile_venues") \
        .select("venue_id, venues(name, org_id)") \
        .eq("profile_id", user_id).execute()
    
    org_venues_map = {}
    for pv in (venues_res.data or []):
        v_data = pv.get("venues")
        if v_data:
            o_id = v_data["org_id"]
            if o_id not in org_venues_map: org_venues_map[o_id] = []
            org_venues_map[o_id].append({"id": pv["venue_id"], "name": v_data["name"]})

    orgs_detail = []
    for po in (orgs_res.data or []):
        o_id = po["organization_id"]
        o_name = po["organizations"]["name"] if po.get("organizations") else "Unknown"
        
        role_name = "staff"
        if po.get("custom_roles"):
            role_name = po["custom_roles"]["name"]
        elif profile.get("role") == "admin":
            role_name = "admin"

        orgs_detail.append({
            "id": o_id,
            "name": o_name,
            "role_id": po.get("role_id"),
            "role_name": role_name,
            "venues": org_venues_map.get(o_id, [])
        })

    return {
        "id": profile["id"],
        "full_name": profile.get("full_name"),
        "email": email,
        "role": profile.get("role", "staff"),
        "is_superadmin": profile.get("is_superadmin", False),
        "organizations": orgs_detail
    }

@router.post("/users/{user_id}/organizations")
async def super_add_user_org(user_id: str, body: SuperAdminUserOrgAdd, user=Depends(get_super_admin)):
    db = get_db()
    
    # 1. Update/Insert organization association
    role_id = body.role_id
    if not role_id and body.role_name and body.role_name not in ["admin", "staff"]:
        # Try to find role_id by name
        r_res = db.table("custom_roles").select("id").eq("org_id", body.organization_id).eq("name", body.role_name).execute()
        if r_res.data:
            role_id = r_res.data[0]["id"]

    db.table("profile_organizations").upsert({
        "profile_id": user_id,
        "organization_id": body.organization_id,
        "role_id": role_id
    }).execute()

    # 2. Update venues (remove old ones for THIS org and insert new)
    # First, get all venues for this organization
    ov_res = db.table("venues").select("id").eq("org_id", body.organization_id).execute()
    org_venue_ids = [v["id"] for v in (ov_res.data or [])]
    
    if org_venue_ids:
        # Delete user associations for THESE venues
        db.table("profile_venues").delete().eq("profile_id", user_id).in_("venue_id", org_venue_ids).execute()
        
        # Insert new associations
        if body.venue_ids:
            # Only insert those that actually belong to the org
            valid_ids = [vid for vid in body.venue_ids if vid in org_venue_ids]
            if valid_ids:
                db.table("profile_venues").insert([{"profile_id": user_id, "venue_id": vid} for vid in valid_ids]).execute()

    return {"ok": True}

@router.put("/users/{user_id}/organizations/{org_id}")
async def super_update_user_org(user_id: str, org_id: str, body: SuperAdminUserOrgUpdate, user=Depends(get_super_admin)):
    db = get_db()
    
    # 1. Update role
    role_id = body.role_id
    if not role_id and body.role_name and body.role_name not in ["admin", "staff"]:
        r_res = db.table("custom_roles").select("id").eq("org_id", org_id).eq("name", body.role_name).execute()
        if r_res.data:
            role_id = r_res.data[0]["id"]

    db.table("profile_organizations").upsert({
        "profile_id": user_id,
        "organization_id": org_id,
        "role_id": role_id
    }).execute()

    # 2. Update venues
    if body.venue_ids is not None:
        ov_res = db.table("venues").select("id").eq("org_id", org_id).execute()
        org_venue_ids = [v["id"] for v in (ov_res.data or [])]
        
        if org_venue_ids:
            db.table("profile_venues").delete().eq("profile_id", user_id).in_("venue_id", org_venue_ids).execute()
            valid_ids = [vid for vid in body.venue_ids if vid in org_venue_ids]
            if valid_ids:
                db.table("profile_venues").insert([{"profile_id": user_id, "venue_id": vid} for vid in valid_ids]).execute()

    return {"ok": True}

@router.delete("/users/{user_id}/organizations/{org_id}")
async def super_remove_user_org(user_id: str, org_id: str, user=Depends(get_super_admin)):
    db = get_db()
    # 1. Delete org association
    db.table("profile_organizations").delete().eq("profile_id", user_id).eq("organization_id", org_id).execute()
    
    # 2. Delete venue associations for venues in this org
    ov_res = db.table("venues").select("id").eq("org_id", org_id).execute()
    org_venue_ids = [v["id"] for v in (ov_res.data or [])]
    if org_venue_ids:
        db.table("profile_venues").delete().eq("profile_id", user_id).in_("venue_id", org_venue_ids).execute()
        
    return {"ok": True}

@router.get("/metrics")
async def super_get_metrics(user=Depends(get_super_admin)):
    db = get_db()
    
    orgs_res = db.table("organizations").select("id", count="exact").execute()
    venues_res = db.table("venues").select("id", count="exact").execute()
    users_res = db.table("profiles").select("id", count="exact").execute()
    
    return {
        "total_organizations": orgs_res.count or 0,
        "total_venues": venues_res.count or 0,
        "total_users": users_res.count or 0,
    }
