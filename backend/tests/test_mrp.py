import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app, get_active_org_id
from auth_deps import get_current_user
import uuid
import main

def test_create_catering_request(client, mock_supabase, authenticated_user_mock):
    org_id = str(uuid.uuid4())
    item_id = str(uuid.uuid4())
    
    catering_data = {
        "name": "Evento Prueba",
        "event_date": "2026-06-20",
        "notes": "Notas del evento",
        "lines": [
            {
                "item_id": item_id,
                "qty_base": 10.5,
                "presentation_id": str(uuid.uuid4()),
                "qty_presentation": 1.0
            }
        ]
    }

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        
        # Mocking Supabase chain
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        
        # Mock for catering_requests insert
        mock_header_res = MagicMock()
        mock_header_res.data = [{
            "id": str(uuid.uuid4()),
            "name": catering_data["name"],
            "event_date": catering_data["event_date"],
            "status": "pending",
            "created_at": "2023-01-01T00:00:00Z"
        }]
        
        # We use side_effect to handle multiple table calls
        def table_side_effect(name):
            if name == "catering_requests":
                m = MagicMock()
                m.insert.return_value.execute.return_value = mock_header_res
                return m
            elif name == "catering_request_lines":
                m = MagicMock()
                m.insert.return_value.execute.return_value = MagicMock(data=[])
                return m
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect
        
        response = client.post(
            "/production/catering",
            json=catering_data,
            headers={"X-Org-ID": org_id}
        )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["name"] == catering_data["name"]

def test_list_catering_requests(client, mock_supabase, authenticated_user_mock):
    org_id = str(uuid.uuid4())
    
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        
        mock_res = MagicMock()
        mock_res.data = [{
            "id": str(uuid.uuid4()),
            "name": "Evento 1",
            "event_date": "2026-06-20",
            "status": "pending",
            "created_at": "2023-01-01T00:00:00Z"
        }]
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_res
        
        response = client.get("/production/catering")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Evento 1"

def test_get_catering_request_detail(client, mock_supabase, authenticated_user_mock):
    org_id = str(uuid.uuid4())
    req_id = str(uuid.uuid4())
    
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        
        # Mock header
        mock_header_res = MagicMock()
        mock_header_res.data = [{
            "id": req_id,
            "name": "Evento Detalle",
            "event_date": "2026-06-20",
            "status": "pending",
            "created_at": "2023-01-01T00:00:00Z"
        }]
        
        # Mock lines
        mock_lines_res = MagicMock()
        mock_lines_res.data = [{
            "id": str(uuid.uuid4()),
            "request_id": req_id,
            "item_id": str(uuid.uuid4()),
            "qty_base": 10.0,
            "items": {"name": "Item Test"}
        }]
        
        def table_side_effect(name):
            if name == "catering_requests":
                m = MagicMock()
                m.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_header_res
                return m
            elif name == "catering_request_lines":
                m = MagicMock()
                m.select.return_value.eq.return_value.execute.return_value = mock_lines_res
                return m
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect
        
        response = client.get(f"/production/catering/{req_id}")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Evento Detalle"
    assert len(data["lines"]) == 1
    assert data["lines"][0]["item_name"] == "Item Test"

def test_mrp_explosion(client, mock_supabase, authenticated_user_mock):
    org_id = str(uuid.uuid4())
    req_id = str(uuid.uuid4())
    warehouse_id = str(uuid.uuid4())
    
    # Item IDs
    pizza_id = str(uuid.uuid4())
    masa_id = str(uuid.uuid4())
    salsa_id = str(uuid.uuid4())
    harina_id = str(uuid.uuid4())
    agua_id = str(uuid.uuid4())
    tomate_id = str(uuid.uuid4())
    sal_id = str(uuid.uuid4())

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        
        # Mock Catering Request Lines (10 Pizzas)
        mock_req_lines = MagicMock()
        mock_req_lines.data = [{"item_id": pizza_id, "qty_base": 10.0}]
        
        # Mock Recipes
        # Pizza -> 1 Masa, 1 Salsa
        # Masa -> 0.5 Harina, 0.2 Agua
        # Salsa -> 0.3 Tomate, 0.01 Sal
        mock_recipes = MagicMock()
        mock_recipes.data = [
            {"id": "r1", "item_id": pizza_id, "yield_qty_base": 1.0},
            {"id": "r2", "item_id": masa_id, "yield_qty_base": 1.0},
            {"id": "r3", "item_id": salsa_id, "yield_qty_base": 1.0}
        ]
        
        mock_ingredients = MagicMock()
        mock_ingredients.data = [
            {"recipe_id": "r1", "item_id": masa_id, "qty_base": 1.0},
            {"recipe_id": "r1", "item_id": salsa_id, "qty_base": 1.0},
            {"recipe_id": "r2", "item_id": harina_id, "qty_base": 0.5},
            {"recipe_id": "r2", "item_id": agua_id, "qty_base": 0.2},
            {"recipe_id": "r3", "item_id": tomate_id, "qty_base": 0.3},
            {"recipe_id": "r3", "item_id": sal_id, "qty_base": 0.01}
        ]

        # Mock Items info (names, UOMs)
        mock_items = MagicMock()
        mock_items.data = [
            {"id": pizza_id, "name": "Pizza", "base_uoms": {"code": "un"}},
            {"id": masa_id, "name": "Masa", "base_uoms": {"code": "kg"}},
            {"id": salsa_id, "name": "Salsa", "base_uoms": {"code": "L"}},
            {"id": harina_id, "name": "Harina", "base_uoms": {"code": "kg"}},
            {"id": agua_id, "name": "Agua", "base_uoms": {"code": "L"}},
            {"id": tomate_id, "name": "Tomate", "base_uoms": {"code": "kg"}},
            {"id": sal_id, "name": "Sal", "base_uoms": {"code": "kg"}}
        ]

        # Mock Stock
        # Harina: 2kg available (Need 5kg for 10 pizzas -> Deficit 3kg)
        # Agua: 10L available (Need 2L -> OK)
        # Tomate: 1kg available (Need 3kg -> Deficit 2kg)
        # Sal: 1kg available (Need 0.1kg -> OK)
        mock_stock = MagicMock()
        mock_stock.data = [
            {"item_id": harina_id, "qty_base": 2.0, "qty_reserved": 0.0},
            {"item_id": agua_id, "qty_base": 10.0, "qty_reserved": 0.0},
            {"item_id": tomate_id, "qty_base": 1.0, "qty_reserved": 0.0},
            {"item_id": sal_id, "qty_base": 1.0, "qty_reserved": 0.0}
        ]

        def table_side_effect(name):
            m = MagicMock()
            if name == "catering_request_lines":
                m.select.return_value.eq.return_value.execute.return_value = mock_req_lines
            elif name == "recipes":
                m.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_recipes       
            elif name == "recipe_ingredients":
                m.select.return_value.in_.return_value.execute.return_value = mock_ingredients
            elif name == "items":
                m.select.return_value.in_.return_value.execute.return_value = mock_items
            elif name == "stock":
                # Robust mock for the chain .select().eq().eq().execute()
                stock_query_mock = MagicMock()

                # We'll store the current filter state in the mock
                stock_query_mock._filters = {}

                def eq_handler(col, val):
                    stock_query_mock._filters[col] = val
                    return stock_query_mock

                def execute_handler():
                    item_id = stock_query_mock._filters.get("item_id")
                    res = MagicMock()
                    if item_id:
                        res.data = [s for s in mock_stock.data if s["item_id"] == item_id]
                    else:
                        res.data = mock_stock.data
                    return res

                stock_query_mock.eq.side_effect = eq_handler
                stock_query_mock.execute.side_effect = execute_handler

                m.select.return_value = stock_query_mock
            return m

        mock_supabase.table.side_effect = table_side_effect
        
        response = client.post(
            f"/production/catering/{req_id}/plan",
            json={"warehouse_id": warehouse_id},
            headers={"X-Org-ID": org_id}
        )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    
    # Production Plan: Pizza (10), Masa (10), Salsa (10)
    assert len(data["production_plan"]) == 3
    production_items = {p["item_name"]: p["qty_to_produce"] for p in data["production_plan"]}
    assert production_items["Pizza"] == 10.0
    assert production_items["Masa"] == 10.0
    assert production_items["Salsa"] == 10.0

    # Purchase List (Raw Materials with Deficit): Harina, Tomate
    assert len(data["purchase_list"]) == 2
    purchase_items = {p["item_name"]: p for p in data["purchase_list"]}
    
    assert purchase_items["Harina"]["qty_needed"] == 5.0
    assert purchase_items["Harina"]["qty_deficit"] == 3.0
    
    assert purchase_items["Tomate"]["qty_needed"] == 3.0
    assert purchase_items["Tomate"]["qty_deficit"] == 2.0

def test_generate_mrp_orders(client, mock_supabase, authenticated_user_mock):
    org_id = str(uuid.uuid4())
    req_id = str(uuid.uuid4())
    warehouse_id = str(uuid.uuid4())
    target_warehouse_id = str(uuid.uuid4())
    
    # Item IDs
    pizza_id = str(uuid.uuid4())
    masa_id = str(uuid.uuid4())

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        
        # 1. Mock _calculate_mrp_data via its internal Supabase calls
        # Mock Catering Request Lines (1 Pizza)
        mock_req_lines = MagicMock()
        mock_req_lines.data = [{"item_id": pizza_id, "qty_base": 1.0}]
        
        # Mock Recipes
        # Pizza -> 1 Masa
        mock_recipes = MagicMock()
        mock_recipes.data = [
            {"id": "r1", "item_id": pizza_id, "yield_qty_base": 1.0},
            {"id": "r2", "item_id": masa_id, "yield_qty_base": 1.0}
        ]
        
        mock_ingredients = MagicMock()
        mock_ingredients.data = [
            {"recipe_id": "r1", "item_id": masa_id, "qty_base": 1.0}
        ]

        # Mock items info
        mock_items = MagicMock()
        mock_items.data = [
            {"id": pizza_id, "name": "Pizza", "base_uoms": {"code": "un"}},
            {"id": masa_id, "name": "Masa", "base_uoms": {"code": "kg"}}
        ]
        
        # Mock production orders count (for order number)
        mock_count = MagicMock()
        mock_count.count = 5

        # Mock Insert Response
        mock_insert_res = MagicMock()
        mock_insert_res.data = [{"id": "new_order_id"}]

        def table_side_effect(name):
            m = MagicMock()
            if name == "catering_request_lines":
                m.select.return_value.eq.return_value.execute.return_value = mock_req_lines
            elif name == "recipes":
                m.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_recipes
            elif name == "recipe_ingredients":
                m.select.return_value.in_.return_value.execute.return_value = mock_ingredients
            elif name == "items":
                m.select.return_value.in_.return_value.execute.return_value = mock_items
            elif name == "stock_levels_view":
                m.select.return_value.eq.return_value.in_.return_value.execute.return_value = MagicMock(data=[])
            elif name == "production_orders":
                # For count
                m.select.return_value.gte.return_value.execute.return_value = mock_count
                # For insert
                m.insert.return_value.execute.return_value = mock_insert_res
            elif name == "catering_requests":
                m.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            return m

        mock_supabase.table.side_effect = table_side_effect
        
        response = client.post(
            f"/production/catering/{req_id}/generate-orders",
            json={
                "warehouse_id": warehouse_id,
                "target_warehouse_id": target_warehouse_id,
                "scheduled_date": "2026-06-20"
            },
            headers={"X-Org-ID": org_id}
        )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["generated_count"] == 2 # Pizza and Masa

def test_update_catering_request(client, mock_supabase, authenticated_user_mock):
    org_id = str(uuid.uuid4())
    req_id = str(uuid.uuid4())
    item_id = str(uuid.uuid4())
    
    catering_update_data = {
        "name": "Evento Actualizado",
        "event_date": "2026-06-25",
        "notes": "Notas actualizadas",
        "lines": [
            {
                "item_id": item_id,
                "qty_base": 15.0,
                "presentation_id": str(uuid.uuid4()),
                "qty_presentation": 1.5
            }
        ]
    }

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        
        # Mocking Supabase chain
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        
        # We use side_effect to handle multiple table calls
        def table_side_effect(name):
            m = MagicMock()
            if name == "catering_requests":
                m.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": req_id}])
                return m
            elif name == "catering_request_lines":
                m.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
                m.insert.return_value.execute.return_value = MagicMock(data=[])
                return m
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect
        
        response = client.put(
            f"/production/catering/{req_id}",
            json=catering_update_data,
            headers={"X-Org-ID": org_id}
        )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["ok"] is True

def test_mrp_explosion_with_buffer(client, mock_supabase, authenticated_user_mock):
    org_id = str(uuid.uuid4())
    req_id = str(uuid.uuid4())
    warehouse_id = str(uuid.uuid4())
    
    # Item IDs
    pizza_id = str(uuid.uuid4())
    masa_id = str(uuid.uuid4())
    salsa_id = str(uuid.uuid4())
    harina_id = str(uuid.uuid4())
    agua_id = str(uuid.uuid4())
    tomate_id = str(uuid.uuid4())
    sal_id = str(uuid.uuid4())

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        
        # Mock Catering Request Lines (10 Pizzas)
        mock_req_lines = MagicMock()
        mock_req_lines.data = [{"item_id": pizza_id, "qty_base": 10.0}]
        
        # Mock Recipes
        # Pizza -> 1 Masa, 1 Salsa
        # Masa -> 0.5 Harina, 0.2 Agua
        # Salsa -> 0.3 Tomate, 0.01 Sal
        mock_recipes = MagicMock()
        mock_recipes.data = [
            {"id": "r1", "item_id": pizza_id, "yield_qty_base": 1.0},
            {"id": "r2", "item_id": masa_id, "yield_qty_base": 1.0},
            {"id": "r3", "item_id": salsa_id, "yield_qty_base": 1.0}
        ]
        
        mock_ingredients = MagicMock()
        mock_ingredients.data = [
            {"recipe_id": "r1", "item_id": masa_id, "qty_base": 1.0},
            {"recipe_id": "r1", "item_id": salsa_id, "qty_base": 1.0},
            {"recipe_id": "r2", "item_id": harina_id, "qty_base": 0.5},
            {"recipe_id": "r2", "item_id": agua_id, "qty_base": 0.2},
            {"recipe_id": "r3", "item_id": tomate_id, "qty_base": 0.3},
            {"recipe_id": "r3", "item_id": sal_id, "qty_base": 0.01}
        ]

        # Mock Items info (names, UOMs)
        mock_items = MagicMock()
        mock_items.data = [
            {"id": pizza_id, "name": "Pizza", "base_uoms": {"code": "un"}},
            {"id": masa_id, "name": "Masa", "base_uoms": {"code": "kg"}},
            {"id": salsa_id, "name": "Salsa", "base_uoms": {"code": "L"}},
            {"id": harina_id, "name": "Harina", "base_uoms": {"code": "kg"}},
            {"id": agua_id, "name": "Agua", "base_uoms": {"code": "L"}},
            {"id": tomate_id, "name": "Tomate", "base_uoms": {"code": "kg"}},
            {"id": sal_id, "name": "Sal", "base_uoms": {"code": "kg"}}
        ]

        # Mock Stock
        # Harina: 2kg available (Need 5.5kg for 11 pizzas -> Deficit 3.5kg)
        # Agua: 10L available (Need 2.2L -> OK)
        # Tomate: 1kg available (Need 3.3kg -> Deficit 2.3kg)
        # Sal: 1kg available (Need 0.11kg -> OK)
        mock_stock = MagicMock()
        mock_stock.data = [
            {"item_id": harina_id, "qty_base": 2.0, "qty_reserved": 0.0},
            {"item_id": agua_id, "qty_base": 10.0, "qty_reserved": 0.0},
            {"item_id": tomate_id, "qty_base": 1.0, "qty_reserved": 0.0},
            {"item_id": sal_id, "qty_base": 1.0, "qty_reserved": 0.0}
        ]

        def table_side_effect(name):
            m = MagicMock()
            if name == "catering_request_lines":
                m.select.return_value.eq.return_value.execute.return_value = mock_req_lines
            elif name == "recipes":
                m.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_recipes       
            elif name == "recipe_ingredients":
                m.select.return_value.in_.return_value.execute.return_value = mock_ingredients
            elif name == "items":
                m.select.return_value.in_.return_value.execute.return_value = mock_items
            elif name == "stock":
                stock_query_mock = MagicMock()
                stock_query_mock._filters = {}
                def eq_handler(col, val):
                    stock_query_mock._filters[col] = val
                    return stock_query_mock
                def execute_handler():
                    item_id = stock_query_mock._filters.get("item_id")
                    res = MagicMock()
                    if item_id:
                        res.data = [s for s in mock_stock.data if s["item_id"] == item_id]
                    else:
                        res.data = mock_stock.data
                    return res
                stock_query_mock.eq.side_effect = eq_handler
                stock_query_mock.execute.side_effect = execute_handler
                m.select.return_value = stock_query_mock
            elif name == "catering_requests":
                # Returns 10% buffer
                m.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"buffer_percentage": 10.0}])
                return m
            return m

        mock_supabase.table.side_effect = table_side_effect
        
        response = client.post(
            f"/production/catering/{req_id}/plan",
            json={"warehouse_id": warehouse_id},
            headers={"X-Org-ID": org_id}
        )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    
    # Scaled production plan: Pizza (11), Masa (11), Salsa (11)
    production_items = {p["item_name"]: p["qty_to_produce"] for p in data["production_plan"]}
    assert production_items["Pizza"] == 11.0
    assert production_items["Masa"] == 11.0
    assert production_items["Salsa"] == 11.0

    # Scaled purchase list: Harina (deficit 3.5), Tomate (deficit 2.3)
    purchase_items = {p["item_name"]: p for p in data["purchase_list"]}
    assert purchase_items["Harina"]["qty_needed"] == 5.5
    assert purchase_items["Harina"]["qty_deficit"] == 3.5
    assert purchase_items["Tomate"]["qty_needed"] == 3.3
    assert purchase_items["Tomate"]["qty_deficit"] == 2.3


