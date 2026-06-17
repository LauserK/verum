import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app, get_db, get_active_org_id
from auth_deps import get_current_user
import uuid
import main

def test_create_physical_inventory_draft(client, mock_supabase, authenticated_user_mock):
    user_id = str(uuid.uuid4())
    authenticated_user_mock.id = user_id
    warehouse_id = str(uuid.uuid4())
    item_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    
    count_data = {
        "warehouse_id": warehouse_id,
        "notes": "Test draft count",
        "lines": [
            {
                "item_id": item_id,
                "qty_counted_base": 15.0,
                "presentation_id": None,
                "qty_presentation": None,
                "notes": "Checked shelf A"
            }
        ]
    }

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True):
        mock_res_count = MagicMock()
        mock_res_count.count = 5

        mock_header_res = MagicMock()
        mock_header_res.data = [{
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "warehouse_id": warehouse_id,
            "document_number": "INV-2026-0006",
            "status": "draft",
            "notes": "Test draft count",
            "created_by": authenticated_user_mock.id,
            "created_at": "2026-06-17T12:00:00Z"
        }]

        mock_uom_pres_table = MagicMock()
        
        mock_inv_table = MagicMock()
        mock_inv_table.select.return_value.execute.return_value = mock_res_count
        mock_inv_table.insert.return_value.execute.return_value = mock_header_res

        # For detail retrieval in response
        mock_inv_table.select.return_value.eq.return_value.execute.return_value = mock_header_res

        mock_lines_table = MagicMock()
        mock_lines_table.insert.return_value.execute.return_value = MagicMock(data=[])
        mock_lines_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "qty_expected_base": 10.0,
            "qty_counted_base": 15.0,
            "presentation_id": None,
            "qty_presentation": None,
            "notes": "Checked shelf A",
            "items": {"name": "Test Item"},
            "uom_presentations": None
        }])

        mock_stock_table = MagicMock()
        mock_stock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"qty_base": 10.0}])

        def get_mock_table(name):
            if name == "physical_inventories":
                return mock_inv_table
            elif name == "physical_inventory_lines":
                return mock_lines_table
            elif name == "stock":
                return mock_stock_table
            elif name == "uom_presentations":
                return mock_uom_pres_table
            return MagicMock()

        mock_supabase.table.side_effect = get_mock_table

        response = client.post("/inventory/physical-inventories", json=count_data)

    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["document_number"] == "INV-2026-0006"
    assert res_data["status"] == "draft"
    assert len(res_data["lines"]) == 1
    assert float(res_data["lines"][0]["qty_counted_base"]) == 15.0

def test_resolve_lot_number(client, mock_supabase, authenticated_user_mock):
    lot_number = "LOT-12345"
    org_id = str(uuid.uuid4())
    item_id = str(uuid.uuid4())
    
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True):
        mock_lots_table = MagicMock()
        mock_lots_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[
            {
                "id": str(uuid.uuid4()),
                "lot_number": lot_number,
                "item_id": item_id,
                "expiry_date": None,
                "unit_cost_base": 12.5,
                "items": {
                    "id": item_id,
                    "name": "Test Lot Item",
                    "code": "ITEM-LOT",
                    "category_id": str(uuid.uuid4()),
                    "uom_base": {"name": "Kg"}
                },
                "warehouses": {
                    "org_id": org_id
                }
            }
        ])
        
        mock_supabase.table.side_effect = lambda name: mock_lots_table if name == "stock_lots" else MagicMock()
        
        response = client.get(f"/inventory/lots/resolve/{lot_number}")
        
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["lot_number"] == lot_number
    assert res_data["item"]["name"] == "Test Lot Item"
    assert res_data["item"]["uom_name"] == "Kg"
