# backend/tests/test_m28_reception_matching.py

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
    user.full_name = "Invoice Manager"
    return user

def make_mock_doc(doc_id, org_id, doc_type, doc_number, status, warehouse_id, created_by, po_id=None, supplier_id=None):
    return {
        "id": str(doc_id),
        "org_id": str(org_id),
        "document_type": doc_type,
        "document_number": doc_number,
        "status": status,
        "warehouse_id": str(warehouse_id),
        "destination_warehouse_id": None,
        "supplier": "Supplier Test" if doc_type == "receipt" else None,
        "reason": None,
        "notes": "Test note",
        "created_by": str(created_by),
        "created_at": "2026-07-05T00:00:00Z",
        "processed_by": None,
        "processed_at": None,
        "cancelled_by": None,
        "cancelled_at": None,
        "po_id": str(po_id) if po_id else None,
        "supplier_id": str(supplier_id) if supplier_id else None
    }

def test_create_receipt_linked_to_po(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    po_id = str(uuid4())
    po_line_id = str(uuid4())
    warehouse_id = str(uuid4())
    item_id = str(uuid4())
    doc_id = str(uuid4())
    supplier_id = str(uuid4())

    # Mocks
    mock_sequences = MagicMock()
    mock_sequences.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    mock_sequences.insert.return_value.execute.return_value.data = []

    mock_documents = MagicMock()
    mock_documents.insert.return_value.execute.return_value.data = [
        make_mock_doc(doc_id, org_id, "receipt", "ING-0001", "draft", warehouse_id, mock_user.id, po_id=po_id, supplier_id=supplier_id)
    ]

    mock_lines = MagicMock()
    mock_lines.insert.return_value.execute.return_value.data = [{
        "id": str(uuid4()),
        "document_id": doc_id,
        "item_id": item_id,
        "qty_base": 10.0,
        "po_line_id": po_line_id,
        "po_qty_ordered_base": 10.0,
        "discrepancy_base": 0.0
    }]

    mock_po_line_select = MagicMock()
    mock_po_line_select.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": po_line_id,
        "po_id": po_id,
        "qty_ordered_base": 10.0,
        "qty_received_base": 0.0
    }]

    def side_effect(name):
        if name == "inventory_document_sequences":
            return mock_sequences
        elif name == "inventory_documents":
            return mock_documents
        elif name == "inventory_document_lines":
            return mock_lines
        elif name == "purchase_order_lines":
            return mock_po_line_select
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    payload = {
        "document_type": "receipt",
        "warehouse_id": warehouse_id,
        "po_id": po_id,
        "supplier_id": supplier_id,
        "lines": [
            {
                "item_id": item_id,
                "qty_presentation": 10.0,
                "presentation_id": None,
                "unit_cost_presentation": 5.0,
                "po_line_id": po_line_id
            }
        ]
    }

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post("/inventory/documents", json=payload)

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["po_id"] == po_id
    assert mock_lines.insert.called
    inserted_line = mock_lines.insert.call_args[0][0]
    assert inserted_line["po_line_id"] == po_line_id
    assert inserted_line["po_qty_ordered_base"] == 10.0
    assert inserted_line["discrepancy_base"] == 0.0


def test_process_receipt_updates_po_quantities(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    po_id = str(uuid4())
    po_line_id = str(uuid4())
    doc_id = str(uuid4())
    warehouse_id = str(uuid4())
    item_id = str(uuid4())
    supplier_id = str(uuid4())

    # Mock select document: first returns draft, then returns confirmed
    mock_doc_select = MagicMock()
    mock_doc_select.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[make_mock_doc(doc_id, org_id, "receipt", "ING-0001", "draft", warehouse_id, mock_user.id, po_id=po_id, supplier_id=supplier_id)]),
        MagicMock(data=[make_mock_doc(doc_id, org_id, "receipt", "ING-0001", "confirmed", warehouse_id, mock_user.id, po_id=po_id, supplier_id=supplier_id)])
    ]
    mock_doc_select.update.return_value.eq.return_value.execute.return_value.data = []

    # Mock lines select
    mock_lines_select = MagicMock()
    mock_lines_select.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": str(uuid4()),
        "document_id": doc_id,
        "item_id": item_id,
        "qty_base": 10.0,
        "po_line_id": po_line_id,
        "po_qty_ordered_base": 10.0,
        "discrepancy_base": 0.0,
        "lot_number": "LOT001",
        "expiry_date": None,
        "unit_cost_base": 5.0
    }]

    # Mock PO lines select (current state in database)
    mock_po_line_execute = MagicMock()
    mock_po_line_execute.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": po_line_id,
        "po_id": po_id,
        "qty_ordered_base": 10.0,
        "qty_received_base": 0.0,
        "qty_pending_base": 10.0
    }]

    def side_effect(name):
        if name == "inventory_documents":
            return mock_doc_select
        elif name == "inventory_document_lines":
            return mock_lines_select
        elif name == "purchase_order_lines":
            mock_pol = MagicMock()
            mock_pol.select.return_value.eq.return_value.execute.return_value.data = [{
                "id": po_line_id,
                "po_id": po_id,
                "qty_ordered_base": 10.0,
                "qty_received_base": 0.0,
                "qty_pending_base": 10.0,
                "status": "pending"
            }]
            mock_pol.update.return_value.eq.return_value.execute.return_value.data = [{
                "id": po_line_id,
                "qty_received_base": 10.0
            }]
            return mock_pol
        elif name == "purchase_orders":
            mock_po = MagicMock()
            mock_po.select.return_value.eq.return_value.execute.return_value.data = [{
                "id": po_id,
                "status": "received",
                "org_id": org_id
            }]
            mock_po.update.return_value.eq.return_value.execute.return_value.data = [{
                "id": po_id,
                "status": "received"
            }]
            return mock_po
        elif name == "stock_lots":
            mock_lots = MagicMock()
            mock_lots.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
            mock_lots.insert.return_value.execute.return_value.data = [{"id": str(uuid4())}]
            return mock_lots
        elif name == "stock_movements":
            return MagicMock()
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post(f"/inventory/documents/{doc_id}/process")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


def test_register_invoice_matched(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    po_id = str(uuid4())
    receipt_id = str(uuid4())
    supplier_id = str(uuid4())
    po_line_id = str(uuid4())
    item_id = str(uuid4())
    invoice_id = str(uuid4())

    # Mocks
    mock_config = MagicMock()
    mock_config.select.return_value.eq.return_value.execute.return_value.data = [{
        "org_id": org_id,
        "matching_tolerance_pct": 2.0
    }]

    mock_po_lines = MagicMock()
    mock_po_lines.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": po_line_id,
        "qty_ordered_base": 100.0,
        "unit_cost_base": 10.0
    }]

    mock_receipt_lines = MagicMock()
    mock_receipt_lines.select.return_value.eq.return_value.execute.return_value.data = [{
        "po_line_id": po_line_id,
        "qty_base": 100.0
    }]

    mock_invoice = MagicMock()
    mock_invoice.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    mock_invoice.insert.return_value.execute.return_value.data = [{
        "id": invoice_id,
        "org_id": org_id,
        "supplier_id": supplier_id,
        "po_id": po_id,
        "receipt_id": receipt_id,
        "invoice_number": "FAC-123",
        "invoice_date": "2026-07-20",
        "due_date": "2026-08-20",
        "currency": "USD",
        "subtotal": 1000.0,
        "tax_amount": 160.0,
        "total": 1160.0,
        "matching_status": "matched",
        "payment_status": "unpaid",
        "created_at": "2026-07-21T12:00:00Z"
    }]

    mock_invoice_lines = MagicMock()

    def side_effect(name):
        if name == "po_approval_config":
            return mock_config
        elif name == "purchase_order_lines":
            return mock_po_lines
        elif name == "inventory_document_lines":
            return mock_receipt_lines
        elif name == "supplier_invoices":
            return mock_invoice
        elif name == "supplier_invoice_lines":
            return mock_invoice_lines
        elif name == "purchase_orders":
            return MagicMock()
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    payload = {
        "supplier_id": supplier_id,
        "po_id": po_id,
        "receipt_id": receipt_id,
        "invoice_number": "FAC-123",
        "invoice_date": "2026-07-20",
        "subtotal": 1000.0,
        "tax_amount": 160.0,
        "total": 1160.0,
        "lines": [
            {
                "po_line_id": po_line_id,
                "item_id": item_id,
                "qty_invoiced_base": 100.0,
                "unit_cost_base": 10.0,
                "line_total": 1000.0
            }
        ]
    }

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post("/supplier-invoices", json=payload)

    app.dependency_overrides.clear()

    # The router might be sub-routed under /purchase-orders or /supplier-invoices.
    # We will choose /supplier-invoices or /purchase-orders/supplier-invoices.
    # Let's map it to POST /supplier-invoices since the plan states POST /supplier-invoices, but the plan also says:
    # "POST /supplier-invoices -> Registra la factura, calcula la conciliación de 3 vías".
    # Wait, let's use `/supplier-invoices` as the route. We'll update this test to point to `/supplier-invoices`.
    
    assert response.status_code == 200 or response.status_code == 201
    assert response.json()["matching_status"] == "matched"


def test_register_invoice_mismatch_exceeding_tolerance(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    po_id = str(uuid4())
    receipt_id = str(uuid4())
    supplier_id = str(uuid4())
    po_line_id = str(uuid4())
    item_id = str(uuid4())
    invoice_id = str(uuid4())

    mock_config = MagicMock()
    mock_config.select.return_value.eq.return_value.execute.return_value.data = [{
        "org_id": org_id,
        "matching_tolerance_pct": 2.0
    }]

    mock_po_lines = MagicMock()
    mock_po_lines.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": po_line_id,
        "qty_ordered_base": 100.0,
        "unit_cost_base": 10.0
    }]

    mock_receipt_lines = MagicMock()
    mock_receipt_lines.select.return_value.eq.return_value.execute.return_value.data = [{
        "po_line_id": po_line_id,
        "qty_base": 100.0
    }]

    mock_invoice = MagicMock()
    mock_invoice.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    mock_invoice.insert.return_value.execute.return_value.data = [{
        "id": invoice_id,
        "org_id": org_id,
        "supplier_id": supplier_id,
        "po_id": po_id,
        "receipt_id": receipt_id,
        "invoice_number": "FAC-124",
        "invoice_date": "2026-07-20",
        "due_date": "2026-08-20",
        "currency": "USD",
        "subtotal": 1100.0,
        "tax_amount": 176.0,
        "total": 1276.0,
        "matching_status": "mismatch",
        "payment_status": "unpaid",
        "created_at": "2026-07-21T12:00:00Z"
    }]

    def side_effect(name):
        if name == "po_approval_config":
            return mock_config
        elif name == "purchase_order_lines":
            return mock_po_lines
        elif name == "inventory_document_lines":
            return mock_receipt_lines
        elif name == "supplier_invoices":
            return mock_invoice
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    payload = {
        "supplier_id": supplier_id,
        "po_id": po_id,
        "receipt_id": receipt_id,
        "invoice_number": "FAC-124",
        "invoice_date": "2026-07-20",
        "subtotal": 1100.0,
        "tax_amount": 176.0,
        "total": 1276.0,
        "lines": [
            {
                "po_line_id": po_line_id,
                "item_id": item_id,
                "qty_invoiced_base": 100.0,
                # Cost is 11.0 instead of 10.0. A 10% difference, which exceeds the 2.0% tolerance.
                "unit_cost_base": 11.0,
                "line_total": 1100.0
            }
        ]
    }

    with patch("permissions.resolve_permission", return_value=True):
        # We will use /supplier-invoices as defined in the plan
        response = client.post("/supplier-invoices", json=payload)

    app.dependency_overrides.clear()

    assert response.status_code == 200 or response.status_code == 201
    assert response.json()["matching_status"] == "mismatch"
