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
    mock.in_.return_value = mock
    mock.order.return_value = mock
    mock.insert.return_value = mock
    mock.update.return_value = mock
    mock.execute.return_value = MagicMock(data=data or [])
    return mock

def test_calculate_metrics_success(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    supplier_id = str(uuid4())
    po_id = str(uuid4())
    
    # Mocks para metrics
    mock_suppliers = mock_table_helper([{"id": supplier_id}])
    
    mock_pos_promised = mock_table_helper([
        {"id": "po1", "promised_date": "2026-07-02"},
        {"id": "po2", "promised_date": "2026-07-06"}
    ])
    
    mock_po_lines = mock_table_helper([
        {"id": "pol1", "po_id": "po1", "qty_ordered_base": 10, "qty_received_base": 10}, 
        {"id": "pol2", "po_id": "po2", "qty_ordered_base": 20, "qty_received_base": 20}
    ])
    
    mock_receipts = mock_table_helper([
        {"id": "rec1", "po_id": "po1", "created_at": "2026-07-01T00:00:00Z"},
        {"id": "rec2", "po_id": "po2", "created_at": "2026-07-05T00:00:00Z"}
    ])
    
    mock_receipt_lines = mock_table_helper([
        {"document_id": "rec1", "qty_base": 10, "po_line_id": "pol1", "discrepancy_base": 0.0},
        {"document_id": "rec2", "qty_base": 20, "po_line_id": "pol2", "discrepancy_base": 0.0}
    ])
    
    mock_returns = mock_table_helper([])

    def side_effect(name):
        if name == "suppliers": return mock_suppliers
        if name == "purchase_orders": return mock_pos_promised
        if name == "purchase_order_lines": return mock_po_lines
        if name == "inventory_documents": return mock_receipts
        if name == "inventory_document_lines": return mock_receipt_lines
        if name == "supplier_returns": return mock_returns
        return mock_table_helper()

    mock_supabase.table.side_effect = side_effect

    with patch('main.resolve_permission', return_value=True):
        response = client.get(f"/suppliers/{supplier_id}/metrics")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert data["auto_on_time_pct"] == 100.0
    assert data["auto_qty_accuracy_pct"] == 100.0
    assert data["auto_return_rate_pct"] == 0.0
    assert data["auto_score"] == 5.0

def test_create_evaluation_success(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    supplier_id = str(uuid4())
    
    # Simular calculo de métricas
    mock_suppliers = mock_table_helper([{"id": supplier_id}])
    mock_pos_promised = mock_table_helper([])
    mock_po_lines = mock_table_helper([])
    mock_receipts = mock_table_helper([])
    mock_receipt_lines = mock_table_helper([])
    mock_returns = mock_table_helper([])
    
    mock_insert = mock_table_helper([{
        "id": str(uuid4()),
        "supplier_id": supplier_id,
        "period_start": "2026-06-01",
        "period_end": "2026-06-30",
        "auto_on_time_pct": 100.0,
        "auto_qty_accuracy_pct": 100.0,
        "auto_return_rate_pct": 0.0,
        "auto_score": 5.0,
        "manual_quality": 5,
        "manual_communication": 4,
        "manual_flexibility": 5,
        "manual_score": 4.7,
        "final_score": 4.9,
        "evaluator_id": mock_user.id,
        "notes": "Good supplier",
        "created_at": "2026-07-22T00:00:00Z"
    }])
    mock_supplier_update = mock_table_helper()
    
    def side_effect(name):
        if name == "suppliers": return mock_suppliers
        if name == "purchase_orders": return mock_pos_promised
        if name == "purchase_order_lines": return mock_po_lines
        if name == "inventory_documents": return mock_receipts
        if name == "inventory_document_lines": return mock_receipt_lines
        if name == "supplier_returns": return mock_returns
        if name == "supplier_evaluations": return mock_insert
        return mock_table_helper()
        
    mock_supabase.table.side_effect = side_effect

    payload = {
        "period_start": "2026-06-01",
        "period_end": "2026-06-30",
        "manual_quality": 5,
        "manual_communication": 4,
        "manual_flexibility": 5,
        "notes": "Good supplier"
    }
    
    with patch('main.resolve_permission', return_value=True):
        response = client.post(f"/suppliers/{supplier_id}/evaluations", json=payload)
        
    app.dependency_overrides.clear()
    
    assert response.status_code == 201
    assert "id" in response.json()
    assert mock_insert.insert.called
