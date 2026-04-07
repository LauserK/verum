from unittest.mock import MagicMock, patch
import pytest
from main import app, get_current_user

@patch("main.get_db")
def test_get_profile_multi_tenant_success(mock_get_db, client, authenticated_user_mock):
    # Setup
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    
    mock_db_instance = MagicMock()
    mock_get_db.return_value = mock_db_instance
    
    # 1. profiles.select("*").eq("id", user.id).execute()
    # 2. profile_organizations.select("organization_id, organizations(name)").eq("profile_id", user.id).execute()
    # 3. profile_venues.select("venue_id, venues(name, org_id)").eq("profile_id", user.id).execute()
    
    profile_data = {
        "id": "test-user-id",
        "full_name": "Test User",
        "role": "staff",
        "organization_id": "org-1",
        "venue_id": "venue-1",
        "shift_id": "shift-1"
    }
    
    profile_orgs_data = [
        {
            "organization_id": "org-1",
            "organizations": {"name": "Org 1"}
        },
        {
            "organization_id": "org-2",
            "organizations": {"name": "Org 2"}
        }
    ]
    
    profile_venues_data = [
        {
            "venue_id": "venue-1",
            "venues": {"name": "Venue 1", "org_id": "org-1"}
        },
        {
            "venue_id": "venue-2",
            "venues": {"name": "Venue 2", "org_id": "org-2"}
        }
    ]
    
    mock_db_instance.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[profile_data]),
        MagicMock(data=profile_orgs_data),
        MagicMock(data=profile_venues_data)
    ]
    
    # Also for shifts if needed, but let's focus on orgs/venues first
    # Mocking shift_res
    mock_db_instance.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[profile_data]),
        MagicMock(data=profile_orgs_data),
        MagicMock(data=profile_venues_data),
        MagicMock(data=[{"name": "Morning Shift"}])
    ]
    
    try:
        response = client.get("/me")
        assert response.status_code == 200
        data = response.json()
        
        assert "organizations" in data
        assert len(data["organizations"]) == 2
        
        # Org 1 check
        org1 = next(o for o in data["organizations"] if o["id"] == "org-1")
        assert org1["name"] == "Org 1"
        assert len(org1["venues"]) == 1
        assert org1["venues"][0]["id"] == "venue-1"
        
        # Org 2 check
        org2 = next(o for o in data["organizations"] if o["id"] == "org-2")
        assert org2["name"] == "Org 2"
        assert len(org2["venues"]) == 1
        assert org2["venues"][0]["id"] == "venue-2"
        
        # Legacy fields
        assert data["organization_id"] == "org-1"
        assert data["venue_id"] == "venue-1"
        assert data["shift_id"] == "shift-1"
        assert data["shift_name"] == "Morning Shift"
        
    finally:
        app.dependency_overrides = {}

@patch("main.get_db")
def test_get_profile_multi_tenant_admin_success(mock_get_db, client, authenticated_user_mock):
    # Setup
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    
    mock_db_instance = MagicMock()
    mock_get_db.return_value = mock_db_instance
    
    profile_data = {
        "id": "admin-user-id",
        "full_name": "Admin User",
        "role": "admin",
        "organization_id": "org-1"
    }
    
    profile_orgs_data = [
        {
            "organization_id": "org-1",
            "organizations": {"name": "Org 1"}
        }
    ]
    
    # For admins, it fetches all venues for the orgs
    all_venues_data = [
        {"id": "venue-1", "name": "Venue 1", "org_id": "org-1"},
        {"id": "venue-2", "name": "Venue 2", "org_id": "org-1"}
    ]
    
    mock_db_instance.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[profile_data]),
        MagicMock(data=profile_orgs_data)
    ]
    mock_db_instance.table.return_value.select.return_value.in_.return_value.execute.side_effect = [
        MagicMock(data=all_venues_data)
    ]
    
    try:
        response = client.get("/me")
        assert response.status_code == 200
        data = response.json()
        
        assert data["role"] == "admin"
        assert len(data["organizations"]) == 1
        assert data["organizations"][0]["id"] == "org-1"
        assert len(data["organizations"][0]["venues"]) == 2
        
    finally:
        app.dependency_overrides = {}
