# backend/permissions.py
from typing import Optional
from fastapi import Depends, HTTPException, status
from database import get_db
from auth_deps import get_current_user
from app.cache import cache

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

async def get_user_permission_context(profile_id: str, db, org_id: str = None) -> dict:
    """
    Fetches user's permission context in minimal queries.
    Returns: { "is_superadmin": bool, "role_id": str|None, "is_admin": bool }
    """
    cache_key = f"rbac:context:{org_id}:{profile_id}" if org_id else None
    if cache_key:
        cached = await cache.get(cache_key)
        if cached:
            return cached

    # 0. Check global super admin
    profile_res = db.table('profiles').select('is_superadmin').eq('id', profile_id).execute()
    is_superadmin = profile_res.data[0].get('is_superadmin', False) if profile_res.data else False

    if is_superadmin:
        result = {"is_superadmin": True, "role_id": None, "is_admin": True}
        if cache_key:
            await cache.set(cache_key, result, ttl=600)
        return result

    # 1. Fetch user's organization-specific role
    role_id = None
    is_admin = False

    if org_id:
        po_res = db.table('profile_organizations').select('role_id, custom_roles(is_admin)').eq('profile_id', profile_id).eq('organization_id', org_id).execute()
        if po_res.data:
            role_id = po_res.data[0].get('role_id')
            custom_roles = po_res.data[0].get('custom_roles')
            if custom_roles:
                is_admin = custom_roles.get('is_admin') is True
    
    # Fallback to legacy profile_roles if no org_id or no record in profile_organizations
    if not role_id:
        role_res = db.table('profile_roles').select('role_id, custom_roles(is_admin)').eq('profile_id', profile_id).execute()
        if role_res.data:
            role_id = role_res.data[0].get('role_id')
            custom_roles = role_res.data[0].get('custom_roles')
            if custom_roles:
                is_admin = custom_roles.get('is_admin') is True

    result = {
        "is_superadmin": False,
        "role_id": role_id,
        "is_admin": is_admin
    }
    if cache_key:
        await cache.set(cache_key, result, ttl=600)

    return result

async def _get_permission_id(permission_key: str, db, org_id: str = None) -> Optional[str]:
    catalog_key = f"rbac:catalog:perms:{org_id or 'global'}"
    catalog = await cache.get(catalog_key)
    if catalog is None:
        all_perms = db.table('permissions').select('id, key').execute()
        catalog = {p['key']: p['id'] for p in (all_perms.data or [])}
        await cache.set(catalog_key, catalog, ttl=3600)
    return catalog.get(permission_key)

async def resolve_permission(profile_id: str, permission_key: str, db, org_id: str = None, perm_context: dict = None) -> bool:
    if perm_context is None:
        perm_context = await get_user_permission_context(profile_id, db, org_id)

    if perm_context["is_superadmin"] or perm_context["is_admin"]:
        return True

    role_id = perm_context["role_id"]

    # Fetch permission id via cached catalog helper
    perm_id = await _get_permission_id(permission_key, db, org_id)
    if not perm_id:
        return False

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


async def check_restriction(profile_id: str, permission_key: str, db, org_id: str = None, perm_context: dict = None) -> bool:
    """ Checks for a permission without admin bypass. Useful for toggleable restrictions. """
    if perm_context is None:
        perm_context = await get_user_permission_context(profile_id, db, org_id)

    role_id = perm_context["role_id"]

    # Fetch permission id via cached catalog helper
    perm_id = await _get_permission_id(permission_key, db, org_id)
    if not perm_id:
        return False

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


async def get_user_permissions(profile_id: str, db, org_id: str = None) -> list[str]:
    """
    Returns the list of all permission keys that the user has.
    """
    perm_context = await get_user_permission_context(profile_id, db, org_id)
    
    # Fetch all permissions from the catalog (using cache)
    catalog_key = f"rbac:catalog:perms:{org_id or 'global'}"
    catalog = await cache.get(catalog_key)
    if catalog is None:
        all_perms_res = db.table('permissions').select('id, key').execute()
        catalog = {p['key']: p['id'] for p in (all_perms_res.data or [])}
        await cache.set(catalog_key, catalog, ttl=3600)

    if not catalog:
        return []
    
    # If the user is super admin or admin of the organization, they have all permissions
    if perm_context["is_superadmin"] or perm_context["is_admin"]:
        return list(catalog.keys())
        
    role_id = perm_context["role_id"]
    
    # Map permission ID to key
    perm_map = {perm_id: key for key, perm_id in catalog.items()}
    
    granted_perm_ids = set()
    
    # 1. Add permissions from the role
    if role_id:
        rp_res = db.table('role_permissions').select('permission_id').eq('role_id', role_id).execute()
        if rp_res.data:
            for rp in rp_res.data:
                granted_perm_ids.add(rp['permission_id'])
                
    # 2. Apply individual overrides
    override_res = db.table('profile_permission_overrides').select('permission_id, granted').eq('profile_id', profile_id).execute()
    if override_res.data:
        for override in override_res.data:
            p_id = override['permission_id']
            if override['granted']:
                granted_perm_ids.add(p_id)
            else:
                granted_perm_ids.discard(p_id)
                
    # Map back to keys
    return [perm_map[p_id] for p_id in granted_perm_ids if p_id in perm_map]
