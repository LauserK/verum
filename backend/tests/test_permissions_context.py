import pytest
from unittest.mock import MagicMock, patch
from permissions import get_user_permission_context

@patch("permissions.get_db")
async def test_superadmin_gets_full_context(mock_get_db):
    """A superadmin returns is_superadmin=True, is_admin=True with minimal queries."""
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    mock_profiles_execute = MagicMock(data=[{"is_superadmin": True}])
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_profiles_execute
    
    context = await get_user_permission_context("user-123", mock_db, "org-123")
    
    assert context["is_superadmin"] is True
    assert context["is_admin"] is True
    assert context["role_id"] is None
    
    mock_db.table.assert_called_once_with("profiles")

@patch("permissions.get_db")
async def test_org_admin_gets_admin_context(mock_get_db):
    """An organization admin returns is_admin=True, is_superadmin=False."""
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    # We mock table calls separately based on the table name.
    # 1. profiles table mock
    mock_profiles = MagicMock()
    mock_profiles.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"is_superadmin": False}])
    
    # 2. profile_organizations table mock
    mock_orgs = MagicMock()
    mock_orgs.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"role_id": "role-admin-123", "custom_roles": {"is_admin": True}}]
    )
    
    def table_side_effect(name):
        if name == "profiles":
            return mock_profiles
        elif name == "profile_organizations":
            return mock_orgs
        return MagicMock()
        
    mock_db.table.side_effect = table_side_effect
    
    context = await get_user_permission_context("user-123", mock_db, "org-123")
    
    assert context["is_superadmin"] is False
    assert context["is_admin"] is True
    assert context["role_id"] == "role-admin-123"

@patch("permissions.get_db")
async def test_staff_gets_minimal_context(mock_get_db):
    """A staff user returns is_superadmin=False, is_admin=False."""
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    mock_profiles = MagicMock()
    mock_profiles.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"is_superadmin": False}])
    
    mock_orgs = MagicMock()
    mock_orgs.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"role_id": "role-staff-123", "custom_roles": {"is_admin": False}}]
    )
    
    def table_side_effect(name):
        if name == "profiles":
            return mock_profiles
        elif name == "profile_organizations":
            return mock_orgs
        return MagicMock()
        
    mock_db.table.side_effect = table_side_effect
    
    context = await get_user_permission_context("user-123", mock_db, "org-123")
    
    assert context["is_superadmin"] is False
    assert context["is_admin"] is False
    assert context["role_id"] == "role-staff-123"

@patch("permissions.get_db")
async def test_no_org_falls_back_to_profile_roles(mock_get_db):
    """If no org_id is provided, search profile_roles as fallback."""
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    mock_profiles = MagicMock()
    mock_profiles.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"is_superadmin": False}])
    
    mock_roles = MagicMock()
    mock_roles.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"role_id": "role-fallback-123", "custom_roles": {"is_admin": False}}]
    )
    
    def table_side_effect(name):
        if name == "profiles":
            return mock_profiles
        elif name == "profile_roles":
            return mock_roles
        return MagicMock()
        
    mock_db.table.side_effect = table_side_effect
    
    context = await get_user_permission_context("user-123", mock_db, None)
    
    assert context["is_superadmin"] is False
    assert context["is_admin"] is False
    assert context["role_id"] == "role-fallback-123"
