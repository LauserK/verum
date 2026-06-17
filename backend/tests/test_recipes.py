import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app, get_db, get_active_org_id
from auth_deps import get_current_user
import uuid
import main

def test_create_recipe(client, mock_supabase, authenticated_user_mock):
    # Setup
    item_id = str(uuid.uuid4())
    presentation_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    
    recipe_data = {
        "item_id": item_id,
        "yield_qty_base": 10.0,
        "yield_presentation_id": presentation_id,
        "ingredients": [
            {
                "item_id": str(uuid.uuid4()),
                "qty_base": 2.5,
                "presentation_id": str(uuid.uuid4()),
                "order_index": 0,
                "notes": "First ingredient"
            }
        ],
        "steps": [
            {
                "order_index": 0,
                "description": "First step",
                "estimated_time_minutes": 10
            }
        ]
    }

    # Use dependency overrides
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        
        # Mocking Supabase chain for recipe insert
        mock_recipe_res = MagicMock()
        mock_recipe_res.data = [{
            "id": str(uuid.uuid4()), 
            "org_id": org_id, 
            "item_id": item_id,
            "yield_qty_base": 10.0,
            "yield_presentation_id": presentation_id,
            "is_active": True,
            "created_at": "2023-01-01T00:00:00Z"
        }]
        
        # We need a more flexible mock for the chain
        mock_uom_pres_table = MagicMock()
        mock_uom_pres_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
            "conversion_factor": 1.0
        }])

        mock_recipes_table = MagicMock()
        mock_recipes_table.upsert.return_value.execute.return_value = mock_recipe_res
        mock_recipes_table.select.return_value.eq.return_value.execute.return_value = mock_recipe_res

        mock_recipe_ing_table = MagicMock()
        mock_recipe_ing_table.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        mock_recipe_ing_table.insert.return_value.execute.return_value = MagicMock(data=[])
        mock_recipe_ing_table.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[])

        mock_recipe_steps_table = MagicMock()
        mock_recipe_steps_table.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        mock_recipe_steps_table.insert.return_value.execute.return_value = MagicMock(data=[])
        mock_recipe_steps_table.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[])

        def get_mock_table(table_name):
            if table_name == "uom_presentations":
                return mock_uom_pres_table
            elif table_name == "recipes":
                return mock_recipes_table
            elif table_name == "recipe_ingredients":
                return mock_recipe_ing_table
            elif table_name == "recipe_steps":
                return mock_recipe_steps_table
            return MagicMock()

        mock_supabase.table.side_effect = get_mock_table

        response = client.post(
            "/production/recipes",
            json=recipe_data,
            headers={"X-Org-ID": org_id}
        )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["item_id"] == item_id

def test_get_recipe_by_item_id(client, mock_supabase, authenticated_user_mock):
    item_id = str(uuid.uuid4())
    recipe_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    
    # Mocking Supabase responses
    # 1. recipes table
    mock_recipe_data = [{
        "id": recipe_id,
        "item_id": item_id,
        "yield_qty_base": 10.0,
        "yield_presentation_id": str(uuid.uuid4()),
        "is_active": True,
        "created_at": "2023-01-01T00:00:00Z"
    }]
    
    # 2. recipe_ingredients table
    mock_ingredients_data = [{
        "item_id": str(uuid.uuid4()),
        "qty_base": 2.5,
        "presentation_id": str(uuid.uuid4()),
        "order_index": 0,
        "items": {"name": "Ingredient 1"},
        "uom_presentations": {"name": "Kg"}
    }]
    
    # 3. recipe_steps table
    mock_steps_data = [{
        "order_index": 0,
        "description": "Step 1",
        "estimated_time_minutes": 10
    }]

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id

    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        
        # Setup the mock for the GET sequence
        mock_table.select.return_value.eq.return_value.execute.side_effect = [
            MagicMock(data=mock_recipe_data), # recipes
        ]
        mock_table.select.return_value.eq.return_value.order.return_value.execute.side_effect = [
            MagicMock(data=mock_ingredients_data), # ingredients
            MagicMock(data=mock_steps_data)       # steps
        ]

        response = client.get(f"/production/recipes/{item_id}")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["item_id"] == item_id
    assert len(data["ingredients"]) == 1
    assert len(data["steps"]) == 1
