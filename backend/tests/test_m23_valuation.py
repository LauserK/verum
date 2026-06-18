import pytest
import uuid
from unittest.mock import MagicMock, patch
from main import app, get_active_org_id, get_current_user

ORG_ID = str(uuid.uuid4())
WAREHOUSE_ID = str(uuid.uuid4())
ITEM_ID = str(uuid.uuid4())

@pytest.fixture
def authorized_client(client, authenticated_user_mock):
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        yield client
    
    app.dependency_overrides.clear()

def test_get_inventory_snapshot(authorized_client, mock_supabase):
    # Mock movements that sum up to 8.5 units and $85 valuation
    mock_movements = [
        {
            "item_id": ITEM_ID,
            "warehouse_id": WAREHOUSE_ID,
            "qty_base": 10.5,
            "total_cost": 105.0,
            "items": {
                "name": "Harina",
                "code": "HAR-01",
                "uom_base": {"name": "kg"}
            },
            "warehouses": {
                "name": "Almacén Central"
            }
        },
        {
            "item_id": ITEM_ID,
            "warehouse_id": WAREHOUSE_ID,
            "qty_base": -2.0,
            "total_cost": -20.0,
            "items": {
                "name": "Harina",
                "code": "HAR-01",
                "uom_base": {"name": "kg"}
            },
            "warehouses": {
                "name": "Almacén Central"
            }
        }
    ]
    def table_side_effect(name):
        m = MagicMock()
        if name == "items":
            m.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                {"id": ITEM_ID, "name": "Harina", "code": "HAR-01", "uom_base": {"name": "kg"}}
            ])
            return m
        elif name == "warehouses":
            m.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                {"id": WAREHOUSE_ID, "name": "Almacén Central"}
            ])
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                {"id": WAREHOUSE_ID, "name": "Almacén Central"}
            ])
            return m
        elif name == "stock_movements":
            m.select.return_value.eq.return_value.lte.return_value.execute.return_value = MagicMock(data=mock_movements)
            m.select.return_value.eq.return_value.lte.return_value.eq.return_value.execute.return_value = MagicMock(data=mock_movements)
            return m
        return MagicMock()
        
    mock_supabase.table.side_effect = table_side_effect
    
    response = authorized_client.get(
        "/inventory/snapshot?date=2026-05-31",
        headers={"X-Org-ID": ORG_ID}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["date"] == "2026-05-31"
    assert data["total_valuation"] == 85.0
    assert len(data["items"]) == 1
    assert data["items"][0]["qty_on_hand"] == 8.5
    assert data["items"][0]["valuation"] == 85.0
    assert data["items"][0]["item_name"] == "Harina"

def test_get_inventory_snapshot_zero_stock(authorized_client, mock_supabase):
    # Mock movements that sum up to 0 units and $0 valuation
    mock_movements = [
        {
            "item_id": ITEM_ID,
            "warehouse_id": WAREHOUSE_ID,
            "qty_base": 10.0,
            "total_cost": 100.0,
            "items": {
                "name": "Harina",
                "code": "HAR-01",
                "uom_base": {"name": "kg"}
            },
            "warehouses": {
                "name": "Almacén Central"
            }
        },
        {
            "item_id": ITEM_ID,
            "warehouse_id": WAREHOUSE_ID,
            "qty_base": -10.0,
            "total_cost": -100.0,
            "items": {
                "name": "Harina",
                "code": "HAR-01",
                "uom_base": {"name": "kg"}
            },
            "warehouses": {
                "name": "Almacén Central"
            }
        }
    ]
    def table_side_effect(name):
        m = MagicMock()
        if name == "items":
            m.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                {"id": ITEM_ID, "name": "Harina", "code": "HAR-01", "uom_base": {"name": "kg"}}
            ])
            return m
        elif name == "warehouses":
            m.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                {"id": WAREHOUSE_ID, "name": "Almacén Central"}
            ])
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                {"id": WAREHOUSE_ID, "name": "Almacén Central"}
            ])
            return m
        elif name == "stock_movements":
            m.select.return_value.eq.return_value.lte.return_value.execute.return_value = MagicMock(data=mock_movements)
            m.select.return_value.eq.return_value.lte.return_value.eq.return_value.execute.return_value = MagicMock(data=mock_movements)
            return m
        return MagicMock()
        
    mock_supabase.table.side_effect = table_side_effect
    
    response = authorized_client.get(
        "/inventory/snapshot?date=2026-05-31",
        headers={"X-Org-ID": ORG_ID}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["date"] == "2026-05-31"
    assert data["total_valuation"] == 0.0
    assert len(data["items"]) == 1
    assert data["items"][0]["qty_on_hand"] == 0.0
    assert data["items"][0]["valuation"] == 0.0
    assert data["items"][0]["item_name"] == "Harina"

def test_get_inventory_valuation(authorized_client, mock_supabase):
    mock_whs = MagicMock()
    mock_whs.data = [{"id": WAREHOUSE_ID, "name": "Almacén Central"}]
    
    mock_lots = MagicMock()
    mock_lots.data = [
        {
            "id": str(uuid.uuid4()),
            "warehouse_id": WAREHOUSE_ID,
            "item_id": ITEM_ID,
            "lot_number": "LOTE-001",
            "qty_base": 5.0,
            "unit_cost_base": 12.0,
            "production_date": "2026-06-01",
            "expiry_date": "2026-12-01",
            "received_at": "2026-06-02T10:00:00Z",
            "items": {
                "name": "Harina",
                "code": "HAR-01",
                "uom_base": {"name": "kg"}
            }
        }
    ]
    
    def table_side_effect(name):
        m = MagicMock()
        if name == "warehouses":
            m.select.return_value.eq.return_value.execute.return_value = mock_whs
            return m
        elif name == "stock_lots":
            m.select.return_value.in_.return_value.eq.return_value.execute.return_value = mock_lots
            return m
        return MagicMock()
        
    mock_supabase.table.side_effect = table_side_effect
    
    response = authorized_client.get(
        "/inventory/valuation",
        headers={"X-Org-ID": ORG_ID}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_valuation"] == 60.0
    assert len(data["items"]) == 1
    assert data["items"][0]["qty_on_hand"] == 5.0
    assert data["items"][0]["lots_detail"][0]["lot_number"] == "LOTE-001"
