import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from main import app, get_active_org_id
from auth_deps import get_current_user

@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    user.full_name = "Admin User"
    return user

def test_create_workstation(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    venue_id = str(uuid4())
    ws_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        mock_insert = MagicMock()
        mock_insert.insert.return_value.execute.return_value.data = [{
            "id": ws_id,
            "org_id": org_id,
            "venue_id": venue_id,
            "name": "POS Station 1",
            "printer_type": "thermal",
            "printer_config": {"ip": "192.168.1.100"},
            "numbering_source": "verum_sequence",
            "is_active": True,
            "allowed_modes": ["tables", "takeout", "delivery", "pickup", "bar"],
            "created_at": "2026-08-23T12:00:00Z"
        }]
        mock_supabase.table.return_value = mock_insert

        payload = {
            "name": "POS Station 1",
            "venue_id": venue_id,
            "printer_type": "thermal",
            "printer_config": {"ip": "192.168.1.100"},
            "numbering_source": "verum_sequence",
            "is_active": True,
            "allowed_modes": ["tables", "takeout", "delivery", "pickup", "bar"]
        }
        response = client.post("/sales/workstations", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == ws_id
        assert data["name"] == "POS Station 1"
        assert data["venue_id"] == venue_id
        assert data["allowed_modes"] == ["tables", "takeout", "delivery", "pickup", "bar"]
        app.dependency_overrides.clear()

def test_list_workstations(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    venue_id = str(uuid4())
    ws_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        mock_select = MagicMock()
        mock_select.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "id": ws_id,
            "org_id": org_id,
            "venue_id": venue_id,
            "name": "Bar Workstation",
            "printer_type": "none",
            "printer_config": {},
            "numbering_source": "verum_sequence",
            "is_active": True,
            "allowed_modes": ["bar"],
            "created_at": "2026-08-23T12:00:00Z"
        }]
        mock_supabase.table.return_value = mock_select

        response = client.get(f"/sales/workstations?venue_id={venue_id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == ws_id
        assert data[0]["name"] == "Bar Workstation"
        assert data[0]["allowed_modes"] == ["bar"]
        app.dependency_overrides.clear()

def test_update_workstation(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        mock_update = MagicMock()
        mock_update.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "id": ws_id,
            "org_id": org_id,
            "venue_id": None,
            "name": "Updated Station",
            "printer_type": "fiscal",
            "printer_config": {},
            "numbering_source": "fiscal_printer",
            "is_active": False,
            "allowed_modes": ["takeout", "delivery"],
            "created_at": "2026-08-23T12:00:00Z"
        }]
        mock_supabase.table.return_value = mock_update

        payload = {
            "name": "Updated Station",
            "printer_type": "fiscal",
            "numbering_source": "fiscal_printer",
            "is_active": False,
            "allowed_modes": ["takeout", "delivery"]
        }
        response = client.patch(f"/sales/workstations/{ws_id}", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == ws_id
        assert data["name"] == "Updated Station"
        assert data["is_active"] is False
        assert data["allowed_modes"] == ["takeout", "delivery"]
        app.dependency_overrides.clear()

def test_delete_workstation(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        mock_delete = MagicMock()
        mock_delete.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "id": ws_id
        }]
        mock_supabase.table.return_value = mock_delete

        response = client.delete(f"/sales/workstations/{ws_id}")

        assert response.status_code == 200
        data = response.json()
        assert data == {"status": "deleted"}
        app.dependency_overrides.clear()
