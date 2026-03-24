# backend/permissions.py
from fastapi import Depends, HTTPException, status
from database import get_db

async def resolve_permission(profile_id: str, permission_key: str, db) -> bool:
    # 1. Check admin bypass
    # Fetch user's custom role
    role_res = db.table('profile_roles').select('role_id, custom_roles(is_admin)').eq('profile_id', profile_id).execute()
    if role_res.data and len(role_res.data) > 0:
        custom_role = role_res.data[0].get('custom_roles', {})
        if custom_role and custom_role.get('is_admin') is True:
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
    if role_res.data and len(role_res.data) > 0:
        role_id = role_res.data[0]['role_id']
        rp_res = db.table('role_permissions').select('permission_id').eq('role_id', role_id).eq('permission_id', perm_id).execute()
        if rp_res.data and len(rp_res.data) > 0:
            return True

    return False


async def check_restriction(profile_id: str, permission_key: str, db) -> bool:
    """ Checks for a permission without admin bypass. Useful for toggleable restrictions. """
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
    role_res = db.table('profile_roles').select('role_id').eq('profile_id', profile_id).execute()
    if role_res.data and len(role_res.data) > 0:
        role_id = role_res.data[0]['role_id']
        rp_res = db.table('role_permissions').select('permission_id').eq('role_id', role_id).eq('permission_id', perm_id).execute()
        if rp_res.data and len(rp_res.data) > 0:
            return True

    return False
