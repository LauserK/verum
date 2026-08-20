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

def test_create_sale_item_with_components(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)
        
        item_id = str(uuid4())
        # Mock inserts
        mock_table = MagicMock()
        
        def side_effect(table_name):
            t = MagicMock()
            if table_name == "sale_items":
                t.insert.return_value.execute.return_value.data = [{
                    "id": item_id, "org_id": org_id, "name": "Pizza",
                    "sale_price": 12.0, "food_cost": 4.0, "tax_included": True,
                    "has_variants": False, "is_active": True, "position": 0,
                    "sale_item_variants": [], "sale_item_components": []
                }]
                # For the GET call at the end of create
                t.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
                    "id": item_id, "org_id": org_id, "name": "Pizza",
                    "sale_price": 12.0, "food_cost": 4.0, "tax_included": True,
                    "has_variants": False, "is_active": True, "position": 0,
                    "sale_item_variants": [],
                    "sale_item_components": [
                        {"id": str(uuid4()), "item_id": str(uuid4()), "component_type": "recipe_proportional", "quantity": 1.0, "position": 0}
                    ]
                }]
            elif table_name == "sale_item_components":
                t.insert.return_value.execute.return_value.data = []
            return t

        mock_supabase.table.side_effect = side_effect
        
        payload = {
            "name": "Pizza",
            "sale_price": 12.0,
            "components": [
                {
                    "item_id": str(uuid4()),
                    "component_type": "recipe_proportional",
                    "quantity": 1.0
                }
            ]
        }
        
        response = client.post("/sales/items", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Pizza"
        assert len(data["components"]) == 1
        assert data["components"][0]["component_type"] == "recipe_proportional"
        app.dependency_overrides.clear()


