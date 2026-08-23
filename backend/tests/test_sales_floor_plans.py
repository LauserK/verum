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

def test_create_floor_plan(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    venue_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        plan_id = str(uuid4())
        mock_insert = MagicMock()
        mock_insert.insert.return_value.execute.return_value.data = [{
            "id": plan_id,
            "org_id": org_id,
            "venue_id": venue_id,
            "name": "Main Dining Room",
            "width": 800,
            "height": 600,
            "created_at": "2026-08-23T12:00:00Z",
            "updated_at": "2026-08-23T12:00:00Z"
        }]
        mock_supabase.table.return_value = mock_insert

        payload = {
            "venue_id": venue_id,
            "name": "Main Dining Room",
            "width": 800,
            "height": 600
        }
        response = client.post("/sales/floor-plans", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == plan_id
        assert data["name"] == "Main Dining Room"
        assert data["tables"] == []
        app.dependency_overrides.clear()

def test_list_floor_plans(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    venue_id = str(uuid4())
    plan_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        mock_plans = MagicMock()
        mock_plans.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value.data = [{
            "id": plan_id,
            "org_id": org_id,
            "venue_id": venue_id,
            "name": "Terrace",
            "width": 1000,
            "height": 700,
            "created_at": "2026-08-23T12:00:00Z",
            "updated_at": "2026-08-23T12:00:00Z"
        }]

        mock_tables = MagicMock()
        mock_tables.select.return_value.in_.return_value.execute.return_value.data = [{
            "id": str(uuid4()),
            "floor_plan_id": plan_id,
            "name": "T-1",
            "shape": "rectangle",
            "x": 50,
            "y": 100,
            "width": 60,
            "height": 60,
            "capacity": 4,
            "is_active": True,
            "created_at": "2026-08-23T12:00:00Z"
        }]

        def table_side_effect(table_name):
            if table_name == "floor_plans":
                return mock_plans
            elif table_name == "tables":
                return mock_tables
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect

        response = client.get(f"/sales/floor-plans?venue_id={venue_id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Terrace"
        assert len(data[0]["tables"]) == 1
        assert data[0]["tables"][0]["name"] == "T-1"
        app.dependency_overrides.clear()

def test_update_and_delete_floor_plan(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    plan_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        mock_table = MagicMock()
        mock_table.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "id": plan_id,
            "org_id": org_id,
            "venue_id": str(uuid4()),
            "name": "Updated Terrace",
            "width": 1200,
            "height": 800,
            "created_at": "2026-08-23T12:00:00Z",
            "updated_at": "2026-08-23T12:30:00Z"
        }]
        mock_table.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "id": plan_id
        }]
        mock_supabase.table.return_value = mock_table

        # Update
        patch_res = client.patch(f"/sales/floor-plans/{plan_id}", json={"name": "Updated Terrace"})
        assert patch_res.status_code == 200
        assert patch_res.json()["name"] == "Updated Terrace"

        # Delete
        del_res = client.delete(f"/sales/floor-plans/{plan_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        app.dependency_overrides.clear()

def test_table_crud(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    plan_id = str(uuid4())
    table_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        mock_table = MagicMock()
        # Verify floor plan ownership select
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "id": plan_id, "org_id": org_id
        }]

        # Create table insert
        mock_table.insert.return_value.execute.return_value.data = [{
            "id": table_id,
            "floor_plan_id": plan_id,
            "name": "Table 12",
            "shape": "circle",
            "x": 100,
            "y": 150,
            "width": 80,
            "height": 80,
            "capacity": 6,
            "is_active": True,
            "created_at": "2026-08-23T12:00:00Z"
        }]

        # Update table
        mock_table.update.return_value.eq.return_value.execute.return_value.data = [{
            "id": table_id,
            "floor_plan_id": plan_id,
            "name": "Table 12 VIP",
            "shape": "circle",
            "x": 120,
            "y": 150,
            "width": 80,
            "height": 80,
            "capacity": 6,
            "is_active": True,
            "created_at": "2026-08-23T12:00:00Z"
        }]

        # Delete table
        mock_table.delete.return_value.eq.return_value.execute.return_value.data = [{
            "id": table_id
        }]

        mock_supabase.table.return_value = mock_table

        # 1. Create table
        create_res = client.post(f"/sales/floor-plans/{plan_id}/tables", json={
            "name": "Table 12",
            "shape": "circle",
            "x": 100,
            "y": 150,
            "width": 80,
            "height": 80,
            "capacity": 6
        })
        assert create_res.status_code == 200
        assert create_res.json()["name"] == "Table 12"

        # 2. Update table
        update_res = client.patch(f"/sales/tables/{table_id}", json={
            "name": "Table 12 VIP",
            "x": 120
        })
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "Table 12 VIP"

        # 3. Delete table
        del_res = client.delete(f"/sales/tables/{table_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        app.dependency_overrides.clear()
