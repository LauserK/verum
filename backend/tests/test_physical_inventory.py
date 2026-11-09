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


def test_update_physical_inventory_deduplicates_and_upserts_safely(client, mock_supabase, authenticated_user_mock):
    user_id = str(uuid.uuid4())
    authenticated_user_mock.id = user_id
    inv_id = str(uuid.uuid4())
    warehouse_id = str(uuid.uuid4())
    item_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())

    # Send duplicate item_id in lines payload (simulating double-click or race condition)
    update_data = {
        "warehouse_id": warehouse_id,
        "notes": "Updated draft count",
        "lines": [
            {
                "item_id": item_id,
                "qty_counted_base": 10.0,
                "presentation_id": None,
                "qty_presentation": None,
                "notes": "First entry"
            },
            {
                "item_id": item_id,
                "qty_counted_base": 5.0,
                "presentation_id": None,
                "qty_presentation": None,
                "notes": "Duplicate entry"
            }
        ]
    }

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id

    with patch("main.resolve_permission", return_value=True):
        mock_header_res = MagicMock()
        mock_header_res.data = [{
            "id": inv_id,
            "org_id": org_id,
            "warehouse_id": warehouse_id,
            "document_number": "INV-2026-0006",
            "status": "draft",
            "notes": "Updated draft count",
            "created_by": user_id,
            "created_at": "2026-06-17T12:00:00Z"
        }]

        mock_inv_table = MagicMock()
        mock_inv_table.select.return_value.eq.return_value.execute.return_value = mock_header_res

        mock_lines_table = MagicMock()
        mock_lines_table.upsert.return_value.execute.return_value = MagicMock(data=[])
        mock_lines_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "qty_expected_base": 10.0,
            "qty_counted_base": 15.0,
            "presentation_id": None,
            "qty_presentation": None,
            "notes": "First entry; Duplicate entry",
            "items": {"name": "Test Item"},
            "uom_presentations": None
        }])

        mock_stock_table = MagicMock()
        mock_stock_table.select.return_value.eq.return_value.in_.return_value.execute.return_value = MagicMock(data=[{"item_id": item_id, "qty_base": 10.0}])

        def get_mock_table(name):
            if name == "physical_inventories":
                return mock_inv_table
            elif name == "physical_inventory_lines":
                return mock_lines_table
            elif name == "stock":
                return mock_stock_table
            return MagicMock()

        mock_supabase.table.side_effect = get_mock_table

        response = client.put(f"/inventory/physical-inventories/{inv_id}", json=update_data)

    app.dependency_overrides.clear()

    assert response.status_code == 200
    # Verify upsert was called with only 1 consolidated line (10.0 + 5.0 = 15.0)
    upserted_payload = mock_lines_table.upsert.call_args[0][0]
    assert len(upserted_payload) == 1
    assert upserted_payload[0]["item_id"] == item_id
    assert upserted_payload[0]["qty_counted_base"] == 15.0

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


def test_physical_inventory_self_heals_zero_stock_from_movements(client, mock_supabase, authenticated_user_mock):
    user_id = str(uuid.uuid4())
    authenticated_user_mock.id = user_id
    inv_id = str(uuid.uuid4())
    warehouse_id = str(uuid.uuid4())
    item_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())

    update_data = {
        "warehouse_id": warehouse_id,
        "notes": "Production warehouse count",
        "lines": [
            {
                "item_id": item_id,
                "qty_counted_base": 4800.0,
                "presentation_id": None,
                "qty_presentation": None,
                "notes": None
            }
        ]
    }

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id

    with patch("main.resolve_permission", return_value=True):
        mock_header_res = MagicMock()
        mock_header_res.data = [{
            "id": inv_id,
            "org_id": org_id,
            "warehouse_id": warehouse_id,
            "document_number": "INV-2026-0007",
            "status": "draft",
            "notes": "Production warehouse count",
            "created_by": user_id,
            "created_at": "2026-06-17T12:00:00Z"
        }]

        mock_inv_table = MagicMock()
        mock_inv_table.select.return_value.eq.return_value.execute.return_value = mock_header_res

        mock_lines_table = MagicMock()
        mock_lines_table.upsert.return_value.execute.return_value = MagicMock(data=[])
        mock_lines_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "qty_expected_base": 5000.0,
            "qty_counted_base": 4800.0,
            "presentation_id": None,
            "qty_presentation": None,
            "notes": None,
            "items": {"name": "Harina"},
            "uom_presentations": None
        }])

        # public.stock returns 0.0 (out of sync)
        mock_stock_table = MagicMock()
        mock_stock_table.select.return_value.eq.return_value.in_.return_value.execute.return_value = MagicMock(
            data=[{"id": str(uuid.uuid4()), "item_id": item_id, "qty_base": 0.0}]
        )
        mock_stock_table.upsert.return_value.execute.return_value = MagicMock(data=[])

        # stock_movements has +7000 and -2000 = 5000.0 real stock
        mock_movs_table = MagicMock()
        mock_movs_table.select.return_value.eq.return_value.in_.return_value.execute.return_value = MagicMock(
            data=[
                {"item_id": item_id, "qty_base": 7000.0},
                {"item_id": item_id, "qty_base": -2000.0}
            ]
        )

        def get_mock_table(name):
            if name == "physical_inventories":
                return mock_inv_table
            elif name == "physical_inventory_lines":
                return mock_lines_table
            elif name == "stock":
                return mock_stock_table
            elif name == "stock_movements":
                return mock_movs_table
            return MagicMock()

        mock_supabase.table.side_effect = get_mock_table

        response = client.put(f"/inventory/physical-inventories/{inv_id}", json=update_data)

    app.dependency_overrides.clear()

    assert response.status_code == 200
    upserted_lines = mock_lines_table.upsert.call_args[0][0]
    assert len(upserted_lines) == 1
    assert upserted_lines[0]["qty_expected_base"] == 5000.0
    # Verify public.stock was also self-healed to 5000.0
    healed_stock = mock_stock_table.upsert.call_args[0][0]
    assert healed_stock[0]["qty_base"] == 5000.0
