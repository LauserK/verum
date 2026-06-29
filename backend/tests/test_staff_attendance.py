import pytest
import uuid
from unittest.mock import MagicMock, patch
from main import app

# Generate valid UUIDs for testing
ORG_ID = str(uuid.uuid4())
VENUE_ID = str(uuid.uuid4())
SHIFT_ID = str(uuid.uuid4())

@pytest.fixture
def authorized_client(client, authenticated_user_mock):
    # Mock FastAPI dependencies
    from auth_deps import get_current_user
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    
    from main import get_active_org_id
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        yield client
    
    app.dependency_overrides.clear()

@pytest.fixture
def mock_supabase_registry(mock_supabase):
    registry = {}
    
    def mock_table(table_name):
        mock_t = MagicMock()
        action = ["select"]
        
        def set_action(act):
            def wrapper(*args, **kwargs):
                action[0] = act
                return mock_t
            return wrapper
            
        mock_t.select.side_effect = set_action("select")
        mock_t.insert.side_effect = set_action("insert")
        mock_t.update.side_effect = set_action("update")
        mock_t.upsert.side_effect = set_action("upsert")
        
        mock_t.eq.return_value = mock_t
        mock_t.in_.return_value = mock_t
        mock_t.gte.return_value = mock_t
        mock_t.lte.return_value = mock_t
        mock_t.order.return_value = mock_t
        mock_t.limit.return_value = mock_t
        mock_t.single.return_value = mock_t
        
        def execute_side_effect():
            act = action[0]
            key = f"{table_name}_{act}"
            if key in registry:
                res = registry[key]
            else:
                res = registry.get(table_name, [])
            return MagicMock(data=res)
            
        mock_t.execute.side_effect = execute_side_effect
        return mock_t

    mock_supabase.table.side_effect = mock_table
    return registry

def test_get_attendance_status_no_logs(authorized_client, mock_supabase_registry):
    mock_supabase_registry["attendance_logs_select"] = []
    mock_supabase_registry["profiles_select"] = [{"role": "staff"}]
    mock_supabase_registry["employee_shifts_select"] = [{"id": SHIFT_ID}]

    response = authorized_client.get(f"/attendance/today/status?venue_id={VENUE_ID}")
    assert response.status_code == 200
    assert response.json()["last_event"] is None
    assert "clock_in" in response.json()["available_actions"]
    assert response.json()["has_active_shift"] is True

def test_get_attendance_status_clocked_in(authorized_client, mock_supabase_registry):
    # Today's logs query returning clock_in
    mock_supabase_registry["attendance_logs_select"] = [{
        "id": "log-123",
        "event_type": "clock_in",
        "venue_id": VENUE_ID,
        "marked_at": "2026-06-10T08:00:00Z"
    }]
    mock_supabase_registry["profiles_select"] = [{"role": "staff"}]
    mock_supabase_registry["employee_shifts_select"] = [{"id": SHIFT_ID}]

    response = authorized_client.get(f"/attendance/today/status?venue_id={VENUE_ID}")
    assert response.status_code == 200
    assert response.json()["last_event"] == "clock_in"
    assert "clock_out" in response.json()["available_actions"]
    assert "break_start" in response.json()["available_actions"]

def test_mark_attendance_clock_in(authorized_client, mock_supabase_registry):
    # Status check: select returns empty (ready to clock in)
    mock_supabase_registry["attendance_logs_select"] = []
    mock_supabase_registry["profiles_select"] = [{"role": "staff"}]
    
    # Active shifts check
    mock_supabase_registry["employee_shifts_select"] = [{
        "id": SHIFT_ID,
        "modality": "fixed",
        "weekdays": [1, 2, 3, 4, 5, 6, 7],
        "start_time": "08:00:00",
        "end_time": "17:00:00"
    }]

    # Log creation: insert returns the clocked_in log
    mock_supabase_registry["attendance_logs_insert"] = [{
        "id": "log-123",
        "profile_id": "test-user-id",
        "venue_id": VENUE_ID,
        "event_type": "clock_in",
        "marked_at": "2026-06-10T08:00:00Z"
    }]

    payload = {
        "venue_id": VENUE_ID,
        "event_type": "clock_in",
        "gps_lat": 10.4806,
        "gps_lng": -66.9036,
        "gps_accuracy_m": 15.0
    }
    response = authorized_client.post("/attendance/mark", json=payload)
    assert response.status_code == 200
    assert response.json()["id"] == "log-123"
    assert response.json()["event_type"] == "clock_in"

def test_get_attendance_report(authorized_client, mock_supabase_registry):
    # Mock data for daily attendance view report
    mock_supabase_registry["v_daily_attendance_select"] = [{
        "id": "log-1",
        "event_type": "clock_in",
        "marked_at": "2026-06-10T08:00:00-04:00",
        "minutes_late": 0,
        "overtime_hours": 0.0,
        "expected_start": "08:00:00",
        "work_date": "2026-06-10"
    }]

    response = authorized_client.get(f"/attendance/report?venue_id={VENUE_ID}&date_from=2026-06-01&date_to=2026-06-30")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["work_date"] == "2026-06-10"
