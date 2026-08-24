import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from main import app, get_active_org_id
from auth_deps import get_current_user


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    user.full_name = "Test User"
    return user


def test_resolve_pos_config_workstation_override(client, mock_supabase, mock_user):
    """When workstation has customer_requirement set, it should take priority."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    wh_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.cache.cache") as mock_cache:
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock()

            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                {"warehouse_id": wh_id, "customer_requirement": "required"}
            ]
            mock_supabase.table.return_value = mock_table

            response = client.get(f"/sales/pos-config?workstation_id={ws_id}&mode=tables")

            assert response.status_code == 200
            data = response.json()
            assert data["customer_requirement"] == "required"
            assert data["resolved_from"] == "workstation"
    app.dependency_overrides.clear()


def test_resolve_pos_config_mode_fallback(client, mock_supabase, mock_user):
    """When workstation has no override, falls back to sale_mode_config."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    wh_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.cache.cache") as mock_cache:
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock()

            def table_side_effect(name):
                mock_t = MagicMock()
                if name == "workstations":
                    mock_t.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                        {"warehouse_id": wh_id, "customer_requirement": None}
                    ]
                elif name == "sale_mode_config":
                    mock_t.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                        {"customer_requirement": "disabled"}
                    ]
                return mock_t

            mock_supabase.table.side_effect = table_side_effect

            response = client.get(f"/sales/pos-config?workstation_id={ws_id}&mode=delivery")

            assert response.status_code == 200
            data = response.json()
            assert data["customer_requirement"] == "disabled"
            assert data["resolved_from"] == "sale_mode_config"
    app.dependency_overrides.clear()


def test_create_sale_mode_config(client, mock_supabase, mock_user):
    """CRUD: create a sale mode config entry."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    config_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.cache.cache") as mock_cache:
            mock_cache.delete_pattern = AsyncMock()

            mock_insert = MagicMock()
            mock_insert.insert.return_value.execute.return_value.data = [{
                "id": config_id,
                "org_id": org_id,
                "mode": "delivery",
                "customer_requirement": "required",
                "created_at": "2026-08-24T12:00:00Z",
                "updated_at": "2026-08-24T12:00:00Z"
            }]
            mock_supabase.table.return_value = mock_insert

            response = client.post("/sales/mode-config", json={
                "mode": "delivery",
                "customer_requirement": "required"
            })

            assert response.status_code == 200
            data = response.json()
            assert data["mode"] == "delivery"
            assert data["customer_requirement"] == "required"
    app.dependency_overrides.clear()
