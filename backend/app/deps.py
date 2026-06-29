from typing import Optional
from fastapi import Depends, HTTPException, status, Header
import sys

from auth_deps import security, get_current_user
from database import get_db

def _get_helper(name, fallback_module, fallback_name):
    main_mod = sys.modules.get("main")
    if main_mod and hasattr(main_mod, name):
        return getattr(main_mod, name)
    # Lazy import of fallback
    if fallback_module == "permissions":
        import permissions
        return getattr(permissions, fallback_name)
    elif fallback_module == "attendance_utils":
        import attendance_utils
        return getattr(attendance_utils, fallback_name)
    return None

async def get_active_org_id(x_org_id: Optional[str] = Header(None), current_user=Depends(get_current_user), db=Depends(get_db)) -> str:
    """
    Resolves the active organization ID from the X-Org-ID header, 
    or fallbacks to default/first organization.
    """
    # 1. If header exists, validate user belongs to it
    if x_org_id:
        res = db.table("profile_organizations").select("organization_id").eq("profile_id", current_user.id).eq("organization_id", x_org_id).execute()
        if res.data:
            return x_org_id
    
    # 2. Fallback: get default or first org
    res = db.table("profile_organizations").select("organization_id").eq("profile_id", current_user.id).order("is_default", desc=True).limit(1).execute()
    if res.data:
        return res.data[0]["organization_id"]
    
    # 3. Final fallback: profile.organization_id (legacy)
    profile = db.table("profiles").select("organization_id").eq("id", current_user.id).execute()
    if profile.data and len(profile.data) > 0 and profile.data[0].get("organization_id"):
        return profile.data[0]["organization_id"]
        
    raise HTTPException(400, "Organization context required")


def require_permission(permission_key: str):
    async def _check(current_user=Depends(get_current_user), db=Depends(get_db), org_id: str = Depends(get_active_org_id)):
        profile_id = current_user.id
        
        # 1. Check if user is forced to clock-in before other actions
        is_attendance_action = permission_key.startswith("attendance.")
        is_admin_action = permission_key.startswith("admin.")
        
        if not is_attendance_action and not is_admin_action:
            check_restriction_fn = _get_helper("check_restriction", "permissions", "check_restriction")
            force_check = await check_restriction_fn(profile_id, "attendance.force_clock_in", db, org_id=org_id)
            if force_check:
                is_clocked_in_fn = _get_helper("is_clocked_in", "attendance_utils", "is_clocked_in")
                clocked_in = await is_clocked_in_fn(profile_id, db)
                if not clocked_in:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={"detail": "CLOCK_IN_REQUIRED", "required": "attendance.mark"}
                    )

        # 2. Standard permission check
        resolve_permission_fn = _get_helper("resolve_permission", "permissions", "resolve_permission")
        has_perm = await resolve_permission_fn(profile_id, permission_key, db, org_id=org_id)
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "missing_permission", "required": permission_key},
            )
        return current_user

    return _check
