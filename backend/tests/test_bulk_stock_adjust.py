import pytest
import uuid
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app

# Valid UUIDs for testing
ORG_ID = str(uuid.uuid4())
WAREHOUSE_ID = str(uuid.uuid4())
ITEM_ID = str(uuid.uuid4())
LOT_1_ID = str(uuid.uuid4())
LOT_2_ID = str(uuid.uuid4())

@pytest.fixture
def authorized_client(client, authenticated_user_mock):
    from auth_deps import get_current_user
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    from main import get_active_org_id
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        yield client
    app.dependency_overrides.clear()

def test_bulk_adjust_positive(authorized_client, mock_supabase):
    # Setup table mocks
    mock_warehouses = MagicMock()
    mock_items = MagicMock()
    mock_stock = MagicMock()
    mock_lots = MagicMock()
    mock_movements = MagicMock()

    def get_table_mock(name):
        if name == "warehouses": return mock_warehouses
        if name == "items": return mock_items
        if name == "stock": return mock_stock
        if name == "stock_lots": return mock_lots
        if name == "stock_movements": return mock_movements
        return MagicMock()

    mock_supabase.table.side_effect = get_table_mock

    # Mock warehouse check using .return_value
    mock_warehouses.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": WAREHOUSE_ID}])
    # Mock item lookup
    mock_items.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": ITEM_ID, "last_purchase_cost": 10.0}])
    # Mock stock lookup: expected stock is 12.0
    mock_stock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "stock-1", "qty_base": 12.0}])
    
    # Mock insert/update
    mock_lots.insert.return_value.execute.return_value = MagicMock(data=[{"id": LOT_1_ID}])
    mock_movements.insert.return_value.execute.return_value = MagicMock(data=[])
    mock_stock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    response = authorized_client.post("/inventory/bulk-adjust-stock", json={
        "warehouse_id": WAREHOUSE_ID,
        "adjustments": [
            {"item_code": "ITEM001", "qty_counted": 17.0}  # counted 17.0 (difference +5.0)
        ]
    })

    assert response.status_code == 200
    res_data = response.json()
    assert len(res_data["results"]) == 1
    result = res_data["results"][0]
    assert result["item_code"] == "ITEM001"
    assert result["status"] == "success"
    assert result["qty_expected"] == 12.0
    assert result["qty_counted"] == 17.0
    assert result["difference"] == 5.0

    # Verify lot was inserted
    mock_lots.insert.assert_called_once()
    inserted_lot = mock_lots.insert.call_args[0][0]
    assert inserted_lot["qty_base"] == 5.0
    assert inserted_lot["unit_cost_base"] == 10.0

def test_bulk_adjust_negative_fifo(authorized_client, mock_supabase):
    mock_warehouses = MagicMock()
    mock_items = MagicMock()
    mock_stock = MagicMock()
    mock_lots = MagicMock()
    mock_movements = MagicMock()

    def get_table_mock(name):
        if name == "warehouses": return mock_warehouses
        if name == "items": return mock_items
        if name == "stock": return mock_stock
        if name == "stock_lots": return mock_lots
        if name == "stock_movements": return mock_movements
        return MagicMock()

    mock_supabase.table.side_effect = get_table_mock

    # Mock warehouse check
    mock_warehouses.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": WAREHOUSE_ID}])
    # Mock item lookup
    mock_items.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": ITEM_ID, "last_purchase_cost": 10.0}])
    # Mock stock lookup: expected stock is 15.0
    mock_stock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "stock-1", "qty_base": 15.0}])
    
    # Mock lots query for FIFO consumption: Lot 1 has 6.0 units, Lot 2 has 8.0 units (Total 14.0 available in lots)
    mock_lots.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[
        {"id": LOT_1_ID, "qty_base": 6.0, "unit_cost_base": 8.0},
        {"id": LOT_2_ID, "qty_base": 8.0, "unit_cost_base": 12.0}
    ])

    mock_lots.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock_movements.insert.return_value.execute.return_value = MagicMock(data=[])
    mock_stock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    response = authorized_client.post("/inventory/bulk-adjust-stock", json={
        "warehouse_id": WAREHOUSE_ID,
        "adjustments": [
            {"item_code": "ITEM001", "qty_counted": 5.0}  # counted 5.0 (difference -10.0)
        ]
    })

    assert response.status_code == 200
    res_data = response.json()
    result = res_data["results"][0]
    assert result["status"] == "success"
    assert result["qty_expected"] == 15.0
    assert result["qty_counted"] == 5.0
    assert result["difference"] == -10.0

    # Should update lots twice (Lot 1 consumed 6.0 units, Lot 2 consumed 4.0 units)
    assert mock_lots.update.call_count == 2
    
    # Check the update values for Lot 1
    call1_args = mock_lots.update.call_args_list[0][0][0]
    assert call1_args["qty_base"] == 0.0
    assert call1_args["is_exhausted"] is True

    # Check the update values for Lot 2
    call2_args = mock_lots.update.call_args_list[1][0][0]
    assert call2_args["qty_base"] == 4.0
    assert call2_args["is_exhausted"] is False

    # Check that stock table is updated to counted qty (5.0)
    mock_stock.update.assert_called_once_with({"qty_base": 5.0})

def test_bulk_adjust_invalid_code(authorized_client, mock_supabase):
    mock_warehouses = MagicMock()
    mock_items = MagicMock()

    def get_table_mock(name):
        if name == "warehouses": return mock_warehouses
        if name == "items": return mock_items
        return MagicMock()

    mock_supabase.table.side_effect = get_table_mock

    # Mock warehouse check
    mock_warehouses.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": WAREHOUSE_ID}])
    # Mock item lookup returns empty (not registered)
    mock_items.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    response = authorized_client.post("/inventory/bulk-adjust-stock", json={
        "warehouse_id": WAREHOUSE_ID,
        "adjustments": [
            {"item_code": "INVALID_CODE", "qty_counted": 10.0}
        ]
    })

    assert response.status_code == 200
    res_data = response.json()
    result = res_data["results"][0]
    assert result["status"] == "error"
    assert result["error_message"] == "Artículo no registrado"
    assert result["qty_counted"] == 10.0

def test_bulk_adjust_zero_difference(authorized_client, mock_supabase):
    mock_warehouses = MagicMock()
    mock_items = MagicMock()
    mock_stock = MagicMock()
    mock_lots = MagicMock()
    mock_movements = MagicMock()

    def get_table_mock(name):
        if name == "warehouses": return mock_warehouses
        if name == "items": return mock_items
        if name == "stock": return mock_stock
        if name == "stock_lots": return mock_lots
        if name == "stock_movements": return mock_movements
        return MagicMock()

    mock_supabase.table.side_effect = get_table_mock

    # Mock warehouse check
    mock_warehouses.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": WAREHOUSE_ID}])
    # Mock item lookup
    mock_items.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": ITEM_ID, "last_purchase_cost": 10.0}])
    # Mock stock lookup: expected stock is 10.0
    mock_stock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "stock-1", "qty_base": 10.0}])

    response = authorized_client.post("/inventory/bulk-adjust-stock", json={
        "warehouse_id": WAREHOUSE_ID,
        "adjustments": [
            {"item_code": "ITEM001", "qty_counted": 10.0}  # counted 10.0 (difference 0.0)
        ]
    })

    assert response.status_code == 200
    res_data = response.json()
    result = res_data["results"][0]
    assert result["status"] == "success"
    assert result["difference"] == 0.0

    # Verify no inserts or updates were executed
    mock_lots.insert.assert_not_called()
    mock_movements.insert.assert_not_called()
    mock_stock.update.assert_not_called()
