from fastapi import HTTPException
import pytest
from unittest.mock import MagicMock, patch
from permissions import get_super_admin

@pytest.mark.asyncio
async def test_get_super_admin_raises_403_for_normal_user():
    # Mock user
    user = MagicMock()
    user.id = "123"
    
    # Mock DB
    db = MagicMock()
    # Chain mock for db.table().select().eq().execute()
    db.table().select().eq().execute.return_value.data = [{"is_superadmin": False}]
    
    with pytest.raises(HTTPException) as excinfo:
        await get_super_admin(user, db)
    assert excinfo.value.status_code == 403
    assert excinfo.value.detail == "Not authorized as Super Admin"

@pytest.mark.asyncio
async def test_get_super_admin_passes_for_super_admin():
    # Mock user
    user = MagicMock()
    user.id = "123"
    
    # Mock DB
    db = MagicMock()
    db.table().select().eq().execute.return_value.data = [{"is_superadmin": True}]
    
    result = await get_super_admin(user, db)
    assert result == user

@pytest.mark.asyncio
async def test_get_super_admin_raises_403_if_no_profile():
    # Mock user
    user = MagicMock()
    user.id = "123"
    
    # Mock DB
    db = MagicMock()
    db.table().select().eq().execute.return_value.data = []
    
    with pytest.raises(HTTPException) as excinfo:
        await get_super_admin(user, db)
    assert excinfo.value.status_code == 403
