import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock
from main import app, get_active_org_id
from auth_deps import get_current_user

def test_create_production_order_reservations(client, mock_supabase, authenticated_user_mock):
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    item_id = str(uuid4())
    warehouse_id = str(uuid4())
    recipe_id = str(uuid4())
    ingredient_id = str(uuid4())
    org_id = str(uuid4())
    user_id = str(uuid4())
    
    mock_recipes = MagicMock()
    mock_recipes.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": recipe_id,
        "yield_qty_base": 10.0
    }]
    
    mock_orders = MagicMock()
    mock_orders.select.return_value.gte.return_value.execute.return_value.count = 0
    mock_orders.insert.return_value.execute.return_value.data = [{
        "id": str(uuid4()),
        "org_id": org_id,
        "order_number": "OP-TEST-001",
        "item_id": item_id,
        "recipe_id": recipe_id,
        "warehouse_id": warehouse_id,
        "qty_ordered_base": 20.0,
        "scheduled_date": "2026-06-27",
        "priority": "normal",
        "status": "pending",
        "created_by": user_id,
        "created_at": "2026-06-27T00:00:00Z"
    }]
    
    mock_ingredients = MagicMock()
    mock_ingredients.select.return_value.eq.return_value.execute.return_value.data = [{
        "item_id": ingredient_id,
        "qty_base": 5.0
    }]
    
    mock_consumptions = MagicMock()
    mock_consumptions.insert.return_value.execute.return_value.data = []
    
    mock_stock = MagicMock()
    mock_stock.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "id": str(uuid4()),
        "qty_reserved": 2.0
    }]
    mock_stock.update.return_value.eq.return_value.execute.return_value.data = []
    
    def side_effect(name):
        if name == "recipes":
            return mock_recipes
        elif name == "production_orders":
            return mock_orders
        elif name == "recipe_ingredients":
            return mock_ingredients
        elif name == "production_order_consumptions":
            return mock_consumptions
        elif name == "stock":
            return mock_stock
        return MagicMock()
        
    mock_supabase.table.side_effect = side_effect
    
    payload = {
        "item_id": item_id,
        "warehouse_id": warehouse_id,
        "qty_ordered_base": 20.0,
        "priority": "normal",
        "scheduled_date": "2026-06-27"
    }
    
    with patch("main.require_permission", return_value=lambda x: None):
        with patch("main.check_restriction", return_value=False):
            with patch("main.resolve_permission", return_value=True):
                response = client.post("/production/orders", json=payload)
                
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    update_calls = mock_stock.update.call_args_list
    assert len(update_calls) > 0
    assert update_calls[0][0][0]["qty_reserved"] == 12.0


def test_cancel_production_order_release(client, mock_supabase, authenticated_user_mock):
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    order_id = str(uuid4())
    warehouse_id = str(uuid4())
    ingredient_id = str(uuid4())
    org_id = str(uuid4())
    user_id = str(uuid4())
    
    mock_orders = MagicMock()
    mock_orders.select.return_value.eq.return_value.execute.return_value.data = [{
        "status": "pending",
        "warehouse_id": warehouse_id
    }]
    mock_orders.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "id": order_id,
        "org_id": org_id,
        "order_number": "OP-TEST-001",
        "item_id": str(uuid4()),
        "recipe_id": str(uuid4()),
        "warehouse_id": warehouse_id,
        "qty_ordered_base": 10.0,
        "scheduled_date": "2026-06-27",
        "priority": "normal",
        "status": "cancelled",
        "created_by": user_id,
        "created_at": "2026-06-27T00:00:00Z"
    }]
    
    mock_consumptions = MagicMock()
    mock_consumptions.select.return_value.eq.return_value.execute.return_value.data = [{
        "item_id": ingredient_id,
        "qty_planned_base": 4.0
    }]
    
    mock_stock = MagicMock()
    mock_stock.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "id": str(uuid4()),
        "qty_reserved": 10.0
    }]
    mock_stock.update.return_value.eq.return_value.execute.return_value.data = []
    
    def side_effect(name):
        if name == "production_orders":
            return mock_orders
        elif name == "production_order_consumptions":
            return mock_consumptions
        elif name == "stock":
            return mock_stock
        return MagicMock()
        
    mock_supabase.table.side_effect = side_effect
    
    with patch("main.require_permission", return_value=lambda x: None):
        with patch("main.check_restriction", return_value=False):
            with patch("main.resolve_permission", return_value=True):
                response = client.patch(f"/production/orders/{order_id}/status", json={"status": "cancelled"})
                
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    update_calls = mock_stock.update.call_args_list
    assert len(update_calls) > 0
    assert update_calls[0][0][0]["qty_reserved"] == 6.0


def test_complete_production_order_release(client, mock_supabase, authenticated_user_mock):
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    order_id = str(uuid4())
    warehouse_id = str(uuid4())
    ingredient_id = str(uuid4())
    produced_item_id = str(uuid4())
    
    mock_orders = MagicMock()
    mock_orders.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": order_id,
        "status": "in_progress",
        "qty_ordered_base": 10.0,
        "warehouse_id": warehouse_id,
        "order_number": "OP-TEST",
        "item_id": produced_item_id,
        "items": {
            "yield_alert_enabled": False,
            "yield_alert_threshold_pct": 5.0
        }
    }]
    mock_orders.update.return_value.eq.return_value.execute.return_value.data = []
    
    mock_consumptions = MagicMock()
    mock_consumptions.select.return_value.eq.return_value.execute.return_value.data = [{
        "item_id": ingredient_id,
        "qty_planned_base": 5.0
    }]
    mock_consumptions.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    
    mock_stock_lots = MagicMock()
    mock_stock_lots.select.return_value.eq.return_value.eq.return_value.filter.return_value.order.return_value.execute.return_value.data = []
    mock_stock_lots.insert.return_value.execute.return_value.data = [{"id": str(uuid4())}]
    
    mock_production_lots = MagicMock()
    mock_production_lots.insert.return_value.execute.return_value.data = []
    
    mock_stock_movements = MagicMock()
    mock_stock_movements.insert.return_value.execute.return_value.data = []
    
    mock_items = MagicMock()
    mock_items.select.return_value.eq.return_value.execute.return_value.data = []
    
    mock_stock = MagicMock()
    
    # Custom side effect for select() matching columns to avoid KeyError:
    def mock_stock_execute(select_cols, w_id, i_id):
        if "qty_reserved" in select_cols:
            return MagicMock(data=[{"id": "stock-ing", "qty_reserved": 5.0}])
        elif "qty_base" in select_cols:
            if str(i_id) == produced_item_id:
                # Target warehouse stock search (return empty for insert)
                return MagicMock(data=[])
            else:
                # Origin stock
                return MagicMock(data=[{"id": "stock-ing", "qty_base": 20.0}])
        return MagicMock(data=[])
        
    def stock_chain_select(cols):
        mock_eq1 = MagicMock()
        def eq1_fn(k1, v1):
            mock_eq2 = MagicMock()
            def eq2_fn(k2, v2):
                mock_exec = MagicMock()
                w_id = v1 if k1 == "warehouse_id" else v2
                i_id = v2 if k2 == "item_id" else v1
                mock_exec.execute.return_value = mock_stock_execute(cols, w_id, i_id)
                return mock_exec
            mock_eq2.eq.side_effect = eq2_fn
            return mock_eq2
        mock_eq1.eq.side_effect = eq1_fn
        return mock_eq1
        
    mock_stock.select.side_effect = stock_chain_select
    mock_stock.update.return_value.eq.return_value.execute.return_value.data = []
    mock_stock.insert.return_value.execute.return_value.data = []
    
    def side_effect(name):
        if name == "production_orders":
            return mock_orders
        elif name == "production_order_consumptions":
            return mock_consumptions
        elif name == "stock_lots":
            return mock_stock_lots
        elif name == "production_lots":
            return mock_production_lots
        elif name == "stock_movements":
            return mock_stock_movements
        elif name == "items":
            return mock_items
        elif name == "stock":
            return mock_stock
        return MagicMock()
        
    mock_supabase.table.side_effect = side_effect
    
    with patch("main.require_permission", return_value=lambda x: None):
        with patch("main.check_restriction", return_value=False):
            with patch("main.resolve_permission", return_value=True):
                response = client.post(f"/production/orders/{order_id}/complete", json={"qty_produced_base": 10.0, "ignore_variance": False})
                
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    stock_updates = mock_stock.update.call_args_list
    reservation_updates = [call for call in stock_updates if "qty_reserved" in call[0][0]]
    assert len(reservation_updates) > 0
    assert reservation_updates[0][0][0]["qty_reserved"] == 0.0


def test_get_low_stock_alerts(client, mock_supabase, authenticated_user_mock):
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    mock_warehouses = MagicMock()
    mock_warehouses.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "00000000-0000-0000-0000-000000000001", "name": "Almacén Central"}
    ]
    
    mock_stock = MagicMock()
    mock_stock.select.return_value.in_.return_value.execute.return_value.data = [
        {
            "item_id": "00000000-0000-0000-0000-00000000000a",
            "warehouse_id": "00000000-0000-0000-0000-000000000001",
            "qty_base": 10.0,
            "qty_reserved": 8.0,
            "items": {
                "name": "Queso Mozzarella",
                "code": "QUES-001",
                "min_stock": 5.0,
                "uom_base": {"code": "kg"}
            }
        },
        {
            "item_id": "00000000-0000-0000-0000-00000000000b",
            "warehouse_id": "00000000-0000-0000-0000-000000000001",
            "qty_base": 20.0,
            "qty_reserved": 2.0,
            "items": {
                "name": "Harina 00",
                "code": "HAR-001",
                "min_stock": 10.0,
                "uom_base": {"code": "kg"}
            }
        }
    ]
    
    def side_effect(name):
        if name == "warehouses":
            return mock_warehouses
        elif name == "stock":
            return mock_stock
        return MagicMock()
        
    mock_supabase.table.side_effect = side_effect
    
    with patch("main.require_permission", return_value=lambda x: None):
        with patch("main.check_restriction", return_value=False):
            with patch("main.resolve_permission", return_value=True):
                response = client.get("/inventory/alerts/low-stock")
                
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) == 1
    assert alerts[0]["item_name"] == "Queso Mozzarella"
    assert alerts[0]["qty_available"] == 2.0
    assert alerts[0]["min_stock"] == 5.0
