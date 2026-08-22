# backend/tests/test_quick_import.py
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

def test_preview_quick_catalog(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    mock_quick_catalog = {
        "categories": [{"id": 1, "name": "Bebidas"}, {"id": 2, "name": "Pizzas"}],
        "modifier_groups": [
            {
                "id": 10,
                "name": "Tipo de Queso",
                "min_select": 1,
                "max_select": 1,
                "is_required": True,
                "modifiers": [{"id": 101, "name": "Mozzarella", "price": 0.0}, {"id": 102, "name": "Cheddar", "price": 1.5}]
            }
        ],
        "products": [
            {
                "id": 201,
                "name": "Pizza Margarita",
                "code": "PIZ-001",
                "price": 10.0,
                "category_name": "Pizzas",
                "modifier_group_ids": [10],
                "variants": []
            }
        ]
    }

    with patch("app.deps._get_helper") as mock_helper, \
         patch("app.integrations.service.fetch_quick_remote_catalog", return_value=mock_quick_catalog):
        mock_helper.return_value = AsyncMock(return_value=True)

        # Mock existing tables in VERUM
        def side_effect(table_name):
            t = MagicMock()
            if table_name == "quick_integrations":
                t.select.return_value.eq.return_value.execute.return_value.data = [{
                    "org_id": org_id, "is_active": True, "secret": "sec_123", "company_id": "1"
                }]
            elif table_name == "sale_categories":
                t.select.return_value.eq.return_value.execute.return_value.data = [{"name": "Bebidas"}]
            elif table_name == "sale_modifier_groups":
                t.select.return_value.eq.return_value.execute.return_value.data = []
            elif table_name == "sale_items":
                t.select.return_value.eq.return_value.execute.return_value.data = []
            return t

        mock_supabase.table.side_effect = side_effect

        response = client.get("/integrations/quick/preview-catalog")
        assert response.status_code == 200
        data = response.json()
        assert data["total_categories"] == 2
        assert data["new_categories"] == 1
        assert data["existing_categories"] == 1
        assert data["total_modifier_groups"] == 1
        assert data["new_modifier_groups"] == 1
        assert data["total_products"] == 1
        assert data["new_products"] == 1

def test_execute_quick_catalog_import(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    mock_quick_catalog = {
        "categories": [{"id": 1, "name": "Pizzas"}],
        "modifier_groups": [
            {
                "id": 10,
                "name": "Tipo de Queso",
                "min_select": 1,
                "max_select": 1,
                "is_required": True,
                "modifiers": [{"id": 101, "name": "Mozzarella", "price": 0.0}]
            }
        ],
        "products": [
            {
                "id": 201,
                "name": "Pizza Margarita",
                "code": "PIZ-001",
                "price": 10.0,
                "category_name": "Pizzas",
                "modifier_group_ids": [10],
                "variants": []
            }
        ]
    }

    with patch("app.deps._get_helper") as mock_helper, \
         patch("app.integrations.service.fetch_quick_remote_catalog", return_value=mock_quick_catalog), \
         patch("app.integrations.service.invalidate_sales_catalog", new_callable=AsyncMock):
        mock_helper.return_value = AsyncMock(return_value=True)

        cat_id = str(uuid4())
        mod_group_id = str(uuid4())
        item_id = str(uuid4())

        def side_effect(table_name):
            t = MagicMock()
            if table_name == "quick_integrations":
                t.select.return_value.eq.return_value.execute.return_value.data = [{
                    "org_id": org_id, "is_active": True, "secret": "sec_123", "company_id": "1"
                }]
            elif table_name == "sale_categories":
                t.select.return_value.eq.return_value.execute.return_value.data = []
                t.insert.return_value.execute.return_value.data = [{"id": cat_id, "name": "Pizzas"}]
            elif table_name == "sale_modifier_groups":
                t.select.return_value.eq.return_value.execute.return_value.data = []
                t.insert.return_value.execute.return_value.data = [{"id": mod_group_id, "name": "Tipo de Queso"}]
            elif table_name == "sale_modifier_options":
                t.insert.return_value.execute.return_value.data = [{"id": str(uuid4()), "name": "Mozzarella"}]
            elif table_name == "sale_items":
                t.select.return_value.eq.return_value.execute.return_value.data = []
                t.insert.return_value.execute.return_value.data = [{"id": item_id, "name": "Pizza Margarita"}]
            elif table_name == "sale_item_modifier_groups":
                t.insert.return_value.execute.return_value.data = []
            return t

        mock_supabase.table.side_effect = side_effect

        response = client.post("/integrations/quick/import-catalog", json={
            "overwrite_existing_prices": True,
            "match_by": "name_or_code"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["categories_imported"] >= 1
        assert data["modifier_groups_imported"] >= 1
        assert data["products_created"] >= 1
