import pytest
from uuid import uuid4
from decimal import Decimal
from unittest.mock import patch, MagicMock
from main import app, get_active_org_id
from auth_deps import get_current_user

def test_calculate_production_needs_deficit(client, mock_supabase):
    # IDs
    item_id = uuid4()
    warehouse_id = uuid4()
    presentation_id = uuid4()
    ingredient_id = uuid4()
    
    # Mock Recipe fetch
    mock_recipe = {
        "id": str(uuid4()),
        "item_id": str(item_id),
        "yield_qty_base": 1.0,
        "yield_presentation_id": str(presentation_id)
    }
    mock_supabase.table().select().eq().execute.return_value.data = [mock_recipe]
    
    # Mock Ingredients fetch
    mock_ingredients = [
        {
            "item_id": str(ingredient_id),
            "qty_base": 500,
            "presentation_id": str(uuid4()),
            "items": {"name": "Ingredient A"}
        }
    ]
    # We need to distinguish between the different table calls if possible, 
    # but for a single-endpoint test we can use side_effect or just sequence them if they are called in order.
    
    def side_effect(table_name):
        mock_table = MagicMock()
        if table_name == "recipes":
            mock_table.select.return_value.eq.return_value.execute.return_value.data = [mock_recipe]
        elif table_name == "recipe_ingredients":
            mock_table.select.return_value.eq.return_value.execute.return_value.data = mock_ingredients
        elif table_name == "uom_presentations":
            mock_table.select.return_value.eq.return_value.execute.return_value.data = [{"id": str(presentation_id), "conversion_factor": 1.0}]
        elif table_name == "stock":
            mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"qty_base": 200, "qty_reserved": 0}]
        return mock_table

    mock_supabase.table.side_effect = side_effect

    payload = {
        "item_id": str(item_id),
        "target_qty": 2, # Request 2 units
        "target_uom_id": str(presentation_id),
        "warehouse_id": str(warehouse_id)
    }
    
    # Need to mock authentication/permissions if required by main.py
    mock_user = MagicMock()
    mock_user.id = str(uuid4())
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())

    with patch("main.require_permission", return_value=lambda x: None):
        with patch("main.check_restriction", return_value=False):
            with patch("main.resolve_permission", return_value=True):
                response = client.post("/production/calculate-needs", json=payload)

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "DEFICIT"
    assert len(data["deficits"]) == 1
    assert Decimal(str(data["deficits"][0]["needed_base_qty"])) == Decimal("1000")
    assert Decimal(str(data["deficits"][0]["deficit_base_qty"])) == Decimal("800")
