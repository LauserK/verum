# backend/tests/test_m25_inventory_documents.py

import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock
from main import app, get_active_org_id
from auth_deps import get_current_user

@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    user.full_name = "User Test"
    return user

def make_mock_doc(doc_id, org_id, doc_type, doc_number, status, warehouse_id, created_by, destination_warehouse_id=None):
    return {
        "id": str(doc_id),
        "org_id": str(org_id),
        "document_type": doc_type,
        "document_number": doc_number,
        "status": status,
        "warehouse_id": str(warehouse_id),
        "destination_warehouse_id": str(destination_warehouse_id) if destination_warehouse_id else None,
        "supplier": "Supplier Test" if doc_type == "receipt" else None,
        "reason": "adjustment" if doc_type == "issue" else None,
        "notes": "Test note",
        "created_by": str(created_by),
        "created_at": "2026-07-05T00:00:00Z",
        "processed_by": None,
        "processed_at": None,
        "cancelled_by": None,
        "cancelled_at": None
    }

def test_create_inventory_document_draft(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    warehouse_id = str(uuid4())
    item_id = str(uuid4())
    presentation_id = str(uuid4())
    doc_id = str(uuid4())

    # Mocks
    mock_sequences = MagicMock()
    mock_sequences.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [] # 1st value
    mock_sequences.insert.return_value.execute.return_value.data = []

    mock_documents = MagicMock()
    mock_documents.insert.return_value.execute.return_value.data = [
        make_mock_doc(doc_id, org_id, "receipt", "ING-0001", "draft", warehouse_id, mock_user.id)
    ]

    mock_lines = MagicMock()
    mock_lines.insert.return_value.execute.return_value.data = []

    mock_presentations = MagicMock()
    mock_presentations.select.return_value.eq.return_value.execute.return_value.data = [{"conversion_factor": 2.0}]

    def side_effect(name):
        if name == "inventory_document_sequences":
            return mock_sequences
        elif name == "inventory_documents":
            return mock_documents
        elif name == "inventory_document_lines":
            return mock_lines
        elif name == "uom_presentations":
            return mock_presentations
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    payload = {
        "document_type": "receipt",
        "warehouse_id": warehouse_id,
        "notes": "Test draft receipt",
        "lines": [
            {
                "item_id": item_id,
                "qty_presentation": 10.0,
                "presentation_id": presentation_id,
                "unit_cost_presentation": 5.0
            }
        ]
    }

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post("/inventory/documents", json=payload)

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "draft"
    # Ensure lines were inserted with conversion qty_base = 20.0
    lines_calls = mock_lines.insert.call_args_list
    assert len(lines_calls) == 1
    assert lines_calls[0][0][0]["qty_base"] == 20.0


def test_process_receipt_document(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    doc_id = str(uuid4())
    warehouse_id = str(uuid4())
    item_id = str(uuid4())

    mock_documents = MagicMock()
    # /process executes a select before updating, and another select at the end.
    draft_doc = make_mock_doc(doc_id, org_id, "receipt", "ING-0001", "draft", warehouse_id, mock_user.id)
    confirmed_doc = make_mock_doc(doc_id, org_id, "receipt", "ING-0001", "confirmed", warehouse_id, mock_user.id)
    
    mock_documents.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[draft_doc]),
        MagicMock(data=[confirmed_doc])
    ]
    mock_documents.update.return_value.eq.return_value.execute.return_value.data = []

    mock_lines = MagicMock()
    mock_lines.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": str(uuid4()),
        "document_id": doc_id,
        "item_id": item_id,
        "qty_base": 15.0,
        "unit_cost_base": 4.5,
        "lot_number": "L-TEST",
        "expiry_date": "2026-12-31"
    }]

    mock_lots = MagicMock()
    mock_lots.insert.return_value.execute.return_value.data = [{"id": str(uuid4())}]

    mock_stock = MagicMock()
    mock_stock.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": "st-id", "qty_base": 5.0}]
    mock_stock.update.return_value.eq.return_value.execute.return_value.data = []

    mock_movements = MagicMock()
    mock_movements.insert.return_value.execute.return_value.data = []

    mock_items = MagicMock()
    mock_items.update.return_value.eq.return_value.execute.return_value.data = []

    def side_effect(name):
        if name == "inventory_documents":
            return mock_documents
        elif name == "inventory_document_lines":
            return mock_lines
        elif name == "stock_lots":
            return mock_lots
        elif name == "stock":
            return mock_stock
        elif name == "stock_movements":
            return mock_movements
        elif name == "items":
            return mock_items
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post(f"/inventory/documents/{doc_id}/process")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    # Verify stock update adds 15.0 to existing 5.0 (result 20.0)
    stock_update_calls = mock_stock.update.call_args_list
    assert len(stock_update_calls) == 1
    assert stock_update_calls[0][0][0]["qty_base"] == 20.0


def test_process_issue_document(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    doc_id = str(uuid4())
    warehouse_id = str(uuid4())
    item_id = str(uuid4())

    mock_documents = MagicMock()
    draft_doc = make_mock_doc(doc_id, org_id, "issue", "EGR-0001", "draft", warehouse_id, mock_user.id)
    confirmed_doc = make_mock_doc(doc_id, org_id, "issue", "EGR-0001", "confirmed", warehouse_id, mock_user.id)
    
    mock_documents.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[draft_doc]),
        MagicMock(data=[confirmed_doc])
    ]
    mock_documents.update.return_value.eq.return_value.execute.return_value.data = []

    mock_lines = MagicMock()
    mock_lines.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": str(uuid4()),
        "document_id": doc_id,
        "item_id": item_id,
        "qty_base": 12.0
    }]

    mock_lots = MagicMock()
    # Mocking oldest non-exhausted lots for FIFO
    mock_lots.select.return_value.eq.return_value.eq.return_value.filter.return_value.order.return_value.execute.return_value.data = [
        {"id": "lot-1", "qty_base": 10.0, "unit_cost_base": 2.0},
        {"id": "lot-2", "qty_base": 5.0, "unit_cost_base": 2.5}
    ]
    mock_lots.update.return_value.eq.return_value.execute.return_value.data = []

    mock_stock = MagicMock()
    mock_stock.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": "st-id", "qty_base": 15.0}]
    mock_stock.update.return_value.eq.return_value.execute.return_value.data = []

    mock_movements = MagicMock()
    mock_movements.insert.return_value.execute.return_value.data = []

    def side_effect(name):
        if name == "inventory_documents":
            return mock_documents
        elif name == "inventory_document_lines":
            return mock_lines
        elif name == "stock_lots":
            return mock_lots
        elif name == "stock":
            return mock_stock
        elif name == "stock_movements":
            return mock_movements
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post(f"/inventory/documents/{doc_id}/process")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    # Verify stock update subtracts 12.0 from 15.0 (result 3.0)
    stock_update_calls = mock_stock.update.call_args_list
    assert len(stock_update_calls) == 1
    assert stock_update_calls[0][0][0]["qty_base"] == 3.0


def test_process_transfer_document_in_transit_and_receive(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    doc_id = str(uuid4())
    origin_wh = str(uuid4())
    dest_wh = str(uuid4())
    item_id = str(uuid4())
    line_id = str(uuid4())

    mock_documents = MagicMock()
    
    draft_doc = make_mock_doc(doc_id, org_id, "transfer", "TRA-0001", "draft", origin_wh, mock_user.id, dest_wh)
    in_transit_doc = make_mock_doc(doc_id, org_id, "transfer", "TRA-0001", "in_transit", origin_wh, mock_user.id, dest_wh)
    confirmed_doc = make_mock_doc(doc_id, org_id, "transfer", "TRA-0001", "confirmed", origin_wh, mock_user.id, dest_wh)
    
    mock_documents.select.return_value.eq.return_value.execute.side_effect = [
        # First process call: read as draft
        MagicMock(data=[draft_doc]),
        # First process call: return at the end of handler as in_transit
        MagicMock(data=[in_transit_doc]),
        # Second receive call: read as in_transit
        MagicMock(data=[in_transit_doc]),
        # Second receive call: return at the end of handler as confirmed
        MagicMock(data=[confirmed_doc])
    ]
    mock_documents.update.return_value.eq.return_value.execute.return_value.data = []

    mock_lines = MagicMock()
    # For process:
    mock_lines.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": line_id, "document_id": doc_id, "item_id": item_id, "qty_base": 10.0}]),
        # For receive:
        MagicMock(data=[{"id": line_id, "document_id": doc_id, "item_id": item_id, "qty_base": 10.0, "presentation_id": None, "unit_cost_base": 3.0}])
    ]
    mock_lines.update.return_value.eq.return_value.execute.return_value.data = []

    mock_lots = MagicMock()
    # FIFO query at origin
    mock_lots.select.return_value.eq.return_value.eq.return_value.filter.return_value.order.return_value.execute.return_value.data = [
        {"id": "lot-orig", "qty_base": 20.0, "unit_cost_base": 3.0}
    ]
    mock_lots.update.return_value.eq.return_value.execute.return_value.data = []
    # Insert lot at destination
    mock_lots.insert.return_value.execute.return_value.data = [{"id": "lot-dest"}]

    mock_stock = MagicMock()
    # Side effects for select stock:
    # 1. origin stock select during process
    # 2. destination stock select during receive
    mock_stock.select.return_value.eq.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[{"id": "st-orig", "qty_base": 25.0}]),
        MagicMock(data=[{"id": "st-dest", "qty_base": 5.0}])
    ]
    mock_stock.update.return_value.eq.return_value.execute.return_value.data = []

    mock_movements = MagicMock()
    mock_movements.insert.return_value.execute.return_value.data = []

    def side_effect(name):
        if name == "inventory_documents":
            return mock_documents
        elif name == "inventory_document_lines":
            return mock_lines
        elif name == "stock_lots":
            return mock_lots
        elif name == "stock":
            return mock_stock
        elif name == "stock_movements":
            return mock_movements
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    # 1. Test /process (transitions to in_transit)
    with patch("permissions.resolve_permission", return_value=True):
        response1 = client.post(f"/inventory/documents/{doc_id}/process")

    assert response1.status_code == 200
    # Origin stock should be reduced by 10 (from 25 to 15)
    origin_stock_calls = list(mock_stock.update.call_args_list)
    assert len(origin_stock_calls) == 1
    assert origin_stock_calls[0][0][0]["qty_base"] == 15.0

    # 2. Test /receive (transitions to confirmed)
    payload_receive = {
        "notes": "All received",
        "lines": [
            {
                "id": line_id,
                "qty_received_presentation": 10.0
            }
        ]
    }

    with patch("permissions.resolve_permission", return_value=True):
        response2 = client.post(f"/inventory/documents/{doc_id}/receive", json=payload_receive)

    app.dependency_overrides.clear()

    assert response2.status_code == 200
    # Destination stock should be incremented by 10 (from 5 to 15)
    assert len(mock_stock.update.call_args_list) == 2
    assert mock_stock.update.call_args_list[1][0][0]["qty_base"] == 15.0


def test_cancel_receipt_document(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    doc_id = str(uuid4())
    warehouse_id = str(uuid4())
    item_id = str(uuid4())
    lot_id = str(uuid4())

    mock_documents = MagicMock()
    
    confirmed_doc = make_mock_doc(doc_id, org_id, "receipt", "ING-0001", "confirmed", warehouse_id, mock_user.id)
    cancelled_doc = make_mock_doc(doc_id, org_id, "receipt", "ING-0001", "cancelled", warehouse_id, mock_user.id)
    
    mock_documents.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[confirmed_doc]),
        MagicMock(data=[cancelled_doc])
    ]
    mock_documents.update.return_value.eq.return_value.execute.return_value.data = []

    # Mocking purchase movement of 15.0 units at cost 4.5
    mock_movements = MagicMock()
    mock_movements.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "id": str(uuid4()),
        "item_id": item_id,
        "lot_id": lot_id,
        "qty_base": 15.0,
        "unit_cost_base": 4.5
    }]
    mock_movements.insert.return_value.execute.return_value.data = []

    mock_lots = MagicMock()
    mock_lots.select.return_value.eq.return_value.execute.return_value.data = [{"qty_base": 15.0}]
    mock_lots.update.return_value.eq.return_value.execute.return_value.data = []

    mock_stock = MagicMock()
    mock_stock.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": "st-id", "qty_base": 20.0}]
    mock_stock.update.return_value.eq.return_value.execute.return_value.data = []

    def side_effect(name):
        if name == "inventory_documents":
            return mock_documents
        elif name == "stock_movements":
            return mock_movements
        elif name == "stock_lots":
            return mock_lots
        elif name == "stock":
            return mock_stock
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post(f"/inventory/documents/{doc_id}/cancel")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    # Check that stock was reduced by 15.0 (from 20.0 to 5.0)
    stock_updates = mock_stock.update.call_args_list
    assert len(stock_updates) == 1
    assert stock_updates[0][0][0]["qty_base"] == 5.0

    # Check that lot quantity was reduced by 15.0 (from 15.0 to 0.0)
    lot_updates = mock_lots.update.call_args_list
    assert len(lot_updates) == 1
    assert lot_updates[0][0][0]["qty_base"] == 0.0
