import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock
from main import app, get_active_org_id
from auth_deps import get_current_user
from datetime import date

@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    user.full_name = "Test User"
    return user

def mock_table_helper(data=None):
    """Helper para crear un mock de tabla de Supabase que soporta encadenamiento ilimitado."""
    mock = MagicMock()
    mock.select.return_value = mock
    mock.eq.return_value = mock
    mock.gt.return_value = mock
    mock.order.return_value = mock
    mock.insert.return_value = mock
    mock.update.return_value = mock
    mock.execute.return_value = MagicMock(data=data or [])
    return mock

def test_create_return_success(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    receipt_id = str(uuid4())
    supplier_id = str(uuid4())
    po_id = str(uuid4())
    item_id = str(uuid4())
    lot_id = str(uuid4())
    return_id = str(uuid4())

    mock_doc = mock_table_helper([{
        "id": receipt_id,
        "document_type": "receipt",
        "status": "confirmed",
        "supplier_id": supplier_id,
        "warehouse_id": str(uuid4()),
        "po_id": po_id,
        "document_number": "ING-0001"
    }])

    mock_doc_lines = mock_table_helper([{
        "item_id": item_id,
        "qty_base": 10.0
    }])

    mock_sequences = mock_table_helper([])

    mock_returns = mock_table_helper([{
        "id": return_id,
        "org_id": org_id,
        "return_number": "DEV-0001",
        "receipt_id": receipt_id,
        "supplier_id": supplier_id,
        "po_id": po_id,
        "reason": "damaged",
        "status": "pending",
        "notes": "some notes",
        "created_by": mock_user.id,
        "created_at": "2026-07-22T00:00:00Z"
    }])

    mock_return_lines = mock_table_helper([{
        "id": str(uuid4()),
        "return_id": return_id,
        "item_id": item_id,
        "lot_id": lot_id,
        "qty_base": 2.0,
        "reason": "damaged"
    }])

    mock_stock_lots = mock_table_helper([{
        "id": lot_id,
        "qty_base": 5.0
    }])

    mock_movements = mock_table_helper([])

    mock_po_lines = mock_table_helper([{
        "id": str(uuid4()),
        "qty_received_base": 10.0,
        "qty_ordered_base": 10.0
    }])

    mock_suppliers = mock_table_helper([{"name": "Supplier Test"}])
    mock_items = mock_table_helper([{"name": "Item Test"}])

    def side_effect(name):
        if name == "inventory_documents": return mock_doc
        elif name == "inventory_document_lines": return mock_doc_lines
        elif name == "inventory_document_sequences": return mock_sequences
        elif name == "supplier_returns": return mock_returns
        elif name == "supplier_return_lines": return mock_return_lines
        elif name == "stock_lots": return mock_stock_lots
        elif name == "stock_movements": return mock_movements
        elif name == "purchase_order_lines": return mock_po_lines
        elif name == "suppliers": return mock_suppliers
        elif name == "items": return mock_items
        elif name == "purchase_orders": return mock_table_helper([{"status": "received"}])
        return mock_table_helper()

    mock_supabase.table.side_effect = side_effect

    payload = {
        "receipt_id": receipt_id,
        "supplier_id": supplier_id,
        "po_id": po_id,
        "reason": "damaged",
        "lines": [{
            "item_id": item_id,
            "qty_base": 2.0,
            "lot_id": lot_id,
            "reason": "damaged"
        }]
    }

    with patch('main.resolve_permission', return_value=True):
        response = client.post("/supplier-returns", json=payload)

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["return_number"] == "DEV-0001"
    assert mock_stock_lots.update.called
    assert mock_movements.insert.called
    assert mock_po_lines.update.called

def test_create_return_receipt_not_confirmed(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())

    mock_doc = mock_table_helper([{
        "id": str(uuid4()),
        "document_type": "receipt",
        "status": "draft"
    }])
    
    def side_effect(name):
        if name == "inventory_documents": return mock_doc
        return mock_table_helper()
    mock_supabase.table.side_effect = side_effect

    payload = {
        "receipt_id": str(uuid4()),
        "supplier_id": str(uuid4()),
        "reason": "damaged",
        "lines": [{"item_id": str(uuid4()), "qty_base": 2.0}]
    }

    with patch('main.resolve_permission', return_value=True):
        response = client.post("/supplier-returns", json=payload)

    app.dependency_overrides.clear()
    assert response.status_code == 400

def test_create_return_qty_exceeds_received(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())

    item_id = str(uuid4())
    mock_doc = mock_table_helper([{"id": str(uuid4()), "status": "confirmed"}])
    mock_doc_lines = mock_table_helper([{"item_id": item_id, "qty_base": 5.0}])

    def side_effect(name):
        if name == "inventory_documents": return mock_doc
        elif name == "inventory_document_lines": return mock_doc_lines
        return mock_table_helper()
    mock_supabase.table.side_effect = side_effect

    payload = {
        "receipt_id": str(uuid4()),
        "supplier_id": str(uuid4()),
        "reason": "damaged",
        "lines": [{"item_id": item_id, "qty_base": 10.0}]
    }

    with patch('main.resolve_permission', return_value=True):
        response = client.post("/supplier-returns", json=payload)

    app.dependency_overrides.clear()
    assert response.status_code == 400
    assert "exceeds received" in response.json()["detail"].lower()

def test_create_return_item_not_in_receipt(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())

    mock_doc = mock_table_helper([{"id": str(uuid4()), "status": "confirmed"}])
    mock_doc_lines = mock_table_helper([{"item_id": str(uuid4()), "qty_base": 5.0}])

    def side_effect(name):
        if name == "inventory_documents": return mock_doc
        elif name == "inventory_document_lines": return mock_doc_lines
        return mock_table_helper()
    mock_supabase.table.side_effect = side_effect

    payload = {
        "receipt_id": str(uuid4()),
        "supplier_id": str(uuid4()),
        "reason": "damaged",
        "lines": [{"item_id": str(uuid4()), "qty_base": 2.0}]
    }

    with patch('main.resolve_permission', return_value=True):
        response = client.post("/supplier-returns", json=payload)

    app.dependency_overrides.clear()
    assert response.status_code == 400

def test_send_return_success(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    return_id = str(uuid4())
    supplier_id = str(uuid4())
    receipt_id = str(uuid4())

    return_data = [{
        "id": return_id,
        "org_id": org_id,
        "return_number": "DEV-0001",
        "reason": "damaged",
        "status": "pending",
        "supplier_id": supplier_id,
        "receipt_id": receipt_id,
        "created_at": "2026-07-22T00:00:00Z"
    }]

    mock_returns = mock_table_helper(return_data)
    
    def mock_update(vals):
        for k, v in vals.items():
            return_data[0][k] = v
        return mock_returns
    mock_returns.update.side_effect = mock_update

    mock_suppliers = mock_table_helper([{"name": "Supplier Test"}])
    mock_docs = mock_table_helper([{"document_number": "ING-0001"}])
    mock_lines = mock_table_helper([])

    def side_effect(name):
        if name == "supplier_returns": return mock_returns
        elif name == "suppliers": return mock_suppliers
        elif name == "inventory_documents": return mock_docs
        elif name == "supplier_return_lines": return mock_lines
        return mock_table_helper()
    mock_supabase.table.side_effect = side_effect

    with patch('main.resolve_permission', return_value=True):
        response = client.patch(f"/supplier-returns/{return_id}/send")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["status"] == "sent"

def test_send_return_already_sent(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())

    mock_returns = mock_table_helper([{"status": "sent"}])

    def side_effect(name):
        if name == "supplier_returns": return mock_returns
        return mock_table_helper()
    mock_supabase.table.side_effect = side_effect

    with patch('main.resolve_permission', return_value=True):
        response = client.patch(f"/supplier-returns/{uuid4()}/send")

    app.dependency_overrides.clear()
    assert response.status_code == 400

def test_create_credit_note_success(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    return_id = str(uuid4())
    supplier_id = str(uuid4())

    mock_returns = mock_table_helper([{"id": return_id, "supplier_id": supplier_id, "status": "sent"}])
    mock_cn = mock_table_helper([{"id": str(uuid4()), "return_id": return_id, "supplier_id": supplier_id, "amount": 100.0, "status": "pending", "created_at": "2026-07-22T00:00:00Z"}])

    def side_effect(name):
        if name == "supplier_returns": return mock_returns
        elif name == "supplier_credit_notes": return mock_cn
        return mock_table_helper()
    mock_supabase.table.side_effect = side_effect

    payload = {"amount": 100.0, "credit_note_number": "CN-01"}
    with patch('main.resolve_permission', return_value=True):
        response = client.post(f"/supplier-returns/{return_id}/credit-note", json=payload)

    app.dependency_overrides.clear()
    assert response.status_code == 201

def test_create_credit_note_applied_to_invoice(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    return_id = str(uuid4())
    supplier_id = str(uuid4())
    invoice_id = str(uuid4())

    mock_returns = mock_table_helper([{"id": return_id, "supplier_id": supplier_id, "status": "sent"}])
    mock_cn = mock_table_helper([{"id": str(uuid4()), "return_id": return_id, "supplier_id": supplier_id, "amount": 50.0, "status": "applied", "created_at": "2026-07-22T00:00:00Z", "applied_to_invoice_id": invoice_id}])
    mock_inv = mock_table_helper([{"id": invoice_id, "total": 200.0}])

    def side_effect(name):
        if name == "supplier_returns": return mock_returns
        elif name == "supplier_credit_notes": return mock_cn
        elif name == "supplier_invoices": return mock_inv
        return mock_table_helper()
    mock_supabase.table.side_effect = side_effect

    payload = {"amount": 50.0, "applied_to_invoice_id": invoice_id}
    with patch('main.resolve_permission', return_value=True):
        response = client.post(f"/supplier-returns/{return_id}/credit-note", json=payload)

    app.dependency_overrides.clear()
    assert response.status_code == 201
    assert mock_inv.update.called
    # total original 200.0, amount cn 50.0 -> result 150.0
    assert mock_inv.update.call_args[0][0]["total"] == 150.0

def test_list_returns(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    return_id = str(uuid4())
    supplier_id = str(uuid4())
    receipt_id = str(uuid4())

    mock_returns = mock_table_helper([
        {
            "id": return_id,
            "org_id": str(uuid4()),
            "return_number": "DEV-0001",
            "supplier_id": supplier_id,
            "receipt_id": receipt_id,
            "reason": "damaged",
            "status": "pending",
            "created_at": "2026-07-22T00:00:00Z"
        }
    ])
    mock_suppliers = mock_table_helper([{"name": "Supplier Test"}])
    mock_docs = mock_table_helper([{"document_number": "ING-0001"}])
    mock_lines = mock_table_helper([])

    def side_effect(name):
        if name == "supplier_returns": return mock_returns
        elif name == "suppliers": return mock_suppliers
        elif name == "inventory_documents": return mock_docs
        elif name == "supplier_return_lines": return mock_lines
        return mock_table_helper()
    mock_supabase.table.side_effect = side_effect

    with patch('main.resolve_permission', return_value=True):
        response = client.get("/supplier-returns")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert len(response.json()) == 1
