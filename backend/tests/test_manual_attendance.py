import pytest
from unittest.mock import MagicMock, patch
from main import app, get_current_user, get_db

@pytest.fixture
def admin_token():
    return "fake-admin-token"

@pytest.fixture
def test_user_id():
    return "test-user-id"

@pytest.fixture
def test_venue_id():
    return "test-venue-id"

def test_manual_attendance_flow(client, admin_token, test_user_id, test_venue_id, authenticated_user_mock):
    # Setup FastAPI dependency overrides
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    # Mock resolve_permission to return True for attendance.manage
    with patch("main.resolve_permission", return_value=True):
        # Mock employee_shifts query
        # db.table("employee_shifts").select("*").eq("profile_id", ...).eq("venue_id", ...).eq("is_active", True).execute()
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
            "id": "shift-123",
            "modality": "fixed",
            "weekdays": [1, 2, 3, 4, 5, 6, 7],
            "start_time": "08:00:00",
            "end_time": "17:00:00"
        }])
        
        # Mock attendance_logs inserts
        mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": "log-123"}])

        payload = {
            "profile_id": test_user_id,
            "venue_id": test_venue_id,
            "clock_in": "2026-04-04T08:00:00",
            "clock_out": "2026-04-04T17:00:00",
            "reason": "Olvido marcar"
        }
        
        try:
            response = client.post(
                "/admin/attendance/manual",
                json=payload,
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            # Assert
            assert response.status_code == 200
            assert response.json()["ok"] is True
            assert response.json()["count"] == 2
        finally:
            # Clean up overrides
            app.dependency_overrides = {}
