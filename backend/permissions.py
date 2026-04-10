# backend/permissions.py
from fastapi import Depends, HTTPException, status
from database import get_db
from auth_deps import get_current_user

async def get_super_admin(current_user=Depends(get_current_user), db=Depends(get_db)):
    """
    Dependency that ensures the authenticated user is a Super Admin.
    Checks the 'is_superadmin' flag in the user's profile.
    """
    result = db.table("profiles").select("is_superadmin").eq("id", current_user.id).execute()
    if not result.data or not result.data[0].get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized as Super Admin"
        )
    return current_user

async def resolve_permission(profile_id: str, permission_key: str, db, org_id: str = None) -> bool:
    # 1. Fetch user's organization-specific role
    role_id = None
    is_admin = False

    if org_id:
        po_res = db.table('profile_organizations').select('role_id, custom_roles(is_admin)').eq('profile_id', profile_id).eq('organization_id', org_id).execute()
        if po_res.data:
            role_id = po_res.data[0].get('role_id')
            is_admin = po_res.data[0].get('custom_roles', {}).get('is_admin') is True
    
    # Fallback to legacy profile_roles if no org_id or no record in profile_organizations
    if not role_id:
        role_res = db.table('profile_roles').select('role_id, custom_roles(is_admin)').eq('profile_id', profile_id).execute()
        if role_res.data:
            role_id = role_res.data[0].get('role_id')
            is_admin = role_res.data[0].get('custom_roles', {}).get('is_admin') is True

    # Check admin bypass
    if is_admin:
        return True

    # Fetch permission id
    perm_res = db.table('permissions').select('id').eq('key', permission_key).execute()
    if not perm_res.data:
        return False
    perm_id = perm_res.data[0]['id']

    # 2. Check individual override
    override_res = db.table('profile_permission_overrides').select('granted').eq('profile_id', profile_id).eq('permission_id', perm_id).execute()
    if override_res.data and len(override_res.data) > 0:
        return override_res.data[0]['granted']

    # 3. Check role permissions
    if role_id:
        rp_res = db.table('role_permissions').select('permission_id').eq('role_id', role_id).eq('permission_id', perm_id).execute()
        if rp_res.data and len(rp_res.data) > 0:
            return True

    return False


async def check_restriction(profile_id: str, permission_key: str, db, org_id: str = None) -> bool:
    """ Checks for a permission without admin bypass. Useful for toggleable restrictions. """
    # Fetch user's organization-specific role
    role_id = None

    if org_id:
        po_res = db.table('profile_organizations').select('role_id').eq('profile_id', profile_id).eq('organization_id', org_id).execute()
        if po_res.data:
            role_id = po_res.data[0].get('role_id')
    
    # Fallback to legacy profile_roles
    if not role_id:
        role_res = db.table('profile_roles').select('role_id').eq('profile_id', profile_id).execute()
        if role_res.data:
            role_id = role_res.data[0].get('role_id')

    # Fetch permission id
    perm_res = db.table('permissions').select('id').eq('key', permission_key).execute()
    if not perm_res.data:
        return False
    perm_id = perm_res.data[0]['id']

    # 1. Check individual override
    override_res = db.table('profile_permission_overrides').select('granted').eq('profile_id', profile_id).eq('permission_id', perm_id).execute()
    if override_res.data and len(override_res.data) > 0:
        return override_res.data[0]['granted']

    # 2. Check role permissions
    if role_id:
        rp_res = db.table('role_permissions').select('permission_id').eq('role_id', role_id).eq('permission_id', perm_id).execute()
        if rp_res.data and len(rp_res.data) > 0:
            return True

    return False
