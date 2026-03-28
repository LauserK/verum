from unittest.mock import MagicMock, patch
import pytest
from main import app, get_current_user

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "VERUM API is running"}

@patch("main.get_db")
def test_get_profile_success(mock_get_db, client, authenticated_user_mock):
    # Setup
    # FastAPI dependency override for get_current_user
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    
    mock_db_instance = MagicMock()
    mock_get_db.return_value = mock_db_instance
    
    # Use side_effect to return different data for sequential execute() calls
    # 1st call: profiles
    # 2nd call: venues
    mock_db_instance.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{
            "id": "test-user-id",
            "full_name": "Test User",
            "role": "admin",
            "organization_id": "org-123"
        }]),
        MagicMock(data=[])
    ]
    
    try:
        # Act
        response = client.get("/me", headers={"Authorization": "Bearer fake-token"})
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "test-user-id"
        assert data["full_name"] == "Test User"
    finally:
        # Clean up overrides
        app.dependency_overrides = {}
