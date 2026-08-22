import sys
from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Optional

from database import get_db as _real_get_db
from auth_deps import get_current_user
from app.auth.schemas import SyncResponse, ProfileResponse
from permissions import get_user_permissions


def _get_db():
    """Dynamic get_db that picks up test mocks applied to main.get_db."""
    main_mod = sys.modules.get("main")
    if main_mod and hasattr(main_mod, "get_db"):
        fn = getattr(main_mod, "get_db")
        # Only use it if it's been replaced by a mock (not the real function)
        if fn is not _real_get_db:
            return fn()
    return _real_get_db()


router = APIRouter(prefix="", tags=["Auth"])


@router.get("/")
def read_root():
    return {"message": "VERUM API is running"}


@router.post("/auth/sync", response_model=SyncResponse)
async def sync_user(user=Depends(get_current_user)):
    """Syncs the Supabase Auth user into public.profiles with default staff role."""
    try:
        db = _get_db()
        existing = db.table("profiles").select("*").eq("id", user.id).execute()

        if existing.data and len(existing.data) > 0:
            profile = existing.data[0]
            
            # Check if their primary organization is active
            org_active = True
            if profile.get("organization_id"):
                org_res = db.table("organizations").select("is_active").eq("id", profile["organization_id"]).execute()
                if org_res.data:
                    org_active = org_res.data[0].get("is_active", True)
            
            return {
                "id": user.id, 
                "role": profile.get("role"),
                "is_superadmin": profile.get("is_superadmin", False),
                "organization_is_active": org_active
            }

        new_profile = {
            "id": user.id,
            "role": "staff",
            "full_name": user.user_metadata.get("full_name", user.email) if user else "",
            "is_superadmin": False
        }
        db.table("profiles").insert(new_profile).execute()

        return {"id": user.id, "role": "staff", "is_superadmin": False, "organization_is_active": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me", response_model=ProfileResponse)
async def get_profile(x_org_id: Optional[str] = Header(None), user=Depends(get_current_user)):
    """Returns the authenticated user's profile with their venues grouped by organization."""
    from app.cache import cache
    cache_key = f"auth:profile:{user.id}:{x_org_id or 'default'}"
    cached_profile = await cache.get(cache_key)
    if cached_profile:
        return cached_profile

    try:
        db = _get_db()
        result = db.table("profiles").select("*").eq("id", user.id).execute()
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        profile = result.data[0]
        user_role = profile.get("role", "staff")
        is_superadmin = profile.get("is_superadmin", False)
        
        # Fetch all user's organizations with their roles and organization details in ONE query
        po_res = db.table("profile_organizations") \
            .select("organization_id, role_id, custom_roles(name, is_admin), organizations!profile_organizations_organization_id_fkey(name, is_active)") \
            .eq("profile_id", user.id) \
            .execute()
            
        user_orgs = []
        role_for_selected_org = None
        
        if po_res.data:
            for po in po_res.data:
                o_data = po.get("organizations")
                if o_data:
                    user_orgs.append({
                        "id": po["organization_id"],
                        "name": o_data.get("name", "Unknown"),
                        "is_active": o_data.get("is_active", True)
                    })
                
                # If this matches the requested x_org_id, extract the role info
                if x_org_id and po["organization_id"] == x_org_id:
                    role_for_selected_org = po
        
        # If organization header is present, determine the role
        if x_org_id:
            if role_for_selected_org:
                custom_role = role_for_selected_org.get("custom_roles")
                if custom_role:
                    user_role = custom_role.get("name")
                    if custom_role.get("is_admin"):
                        user_role = "admin"
                else:
                    if user_role != "admin":
                        user_role = "staff"
            else:
                if user_role != "admin":
                    user_role = "staff"

        # 2. Fetch venues based on role
        # We'll build a map of org_id -> List[VenueInfo]
        org_venues_map = {}
        for org in user_orgs:
            org_venues_map[org["id"]] = []

        if user_role == "admin" or is_superadmin:
            # Admins see all venues for their organizations
            if user_orgs:
                org_ids = [org["id"] for org in user_orgs]
                venues_res = db.table("venues").select("id, name, org_id").in_("org_id", org_ids).execute()
                if venues_res.data:
                    for v in venues_res.data:
                        if v["org_id"] in org_venues_map:
                            org_venues_map[v["org_id"]].append({
                                "id": v["id"],
                                "name": v["name"]
                            })
        else:
            # Staff see only assigned venues
            pv_res = db.table("profile_venues").select("venue_id, venues(name, org_id)").eq("profile_id", user.id).execute()
            if pv_res.data:
                for pv in pv_res.data:
                    venue_data = pv.get("venues")
                    if venue_data:
                        v_org_id = venue_data.get("org_id")
                        if v_org_id in org_venues_map:
                            org_venues_map[v_org_id].append({
                                "id": pv["venue_id"],
                                "name": venue_data.get("name")
                            })

        # 3. Construct the organizations list for the response
        organizations_response = []
        for org in user_orgs:
            organizations_response.append({
                "id": org["id"],
                "name": org["name"],
                "venues": org_venues_map.get(org["id"], []),
                "is_active": org.get("is_active", True)
            })

        # Fetch shift name if shift_id is present
        shift_name = None
        shift_id = profile.get("shift_id")
        if shift_id:
            shift_res = db.table("shifts").select("name").eq("id", shift_id).execute()
            if shift_res.data and len(shift_res.data) > 0:
                shift_name = shift_res.data[0].get("name")

        # Resolve user permissions for the current active organization
        try:
            user_permissions = await get_user_permissions(user.id, db, org_id=x_org_id)
        except Exception:
            user_permissions = []

        response_data = {
            "id": profile["id"],
            "full_name": profile.get("full_name"),
            "role": user_role,
            "is_superadmin": is_superadmin,
            "organizations": organizations_response,
            "organization_id": profile.get("organization_id"),
            "venue_id": profile.get("venue_id"),
            "shift_id": shift_id,
            "shift_name": shift_name,
            "permissions": user_permissions,
        }
        await cache.set(cache_key, response_data, ttl=3600)
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
