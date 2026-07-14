# backend/tests/test_purchase_orders.py

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
    user.full_name = "Purchasing Officer"
    return user

def test_create_purchase_order_draft(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    po_id = str(uuid4())
    supplier_id = str(uuid4())
    warehouse_id = str(uuid4())
    item_id = str(uuid4())

    # Mock select to check for next po number (no POs exist)
    mock_po_select = MagicMock()
    mock_po_select.select.return_value.eq.return_value.execute.return_value.data = []

    # Mock insert on purchase_orders
    mock_po_insert = MagicMock()
    mock_po_insert.insert.return_value.execute.return_value.data = [{
        "id": po_id,
        "org_id": org_id,
        "po_number": f"PO-{date.today().year}-0001",
        "supplier_id": supplier_id,
        "price_list_id": None,
        "origin_type": "manual",
        "requested_date": "2026-07-20",
        "currency": "USD",
        "subtotal": 100.0,
        "tax_amount": 16.0,
        "total": 116.0,
        "payment_terms_days": 15,
        "status": "draft",
        "warehouse_id": warehouse_id,
        "created_by": mock_user.id,
        "created_at": "2026-07-14T00:00:00Z"
    }]

    # Mock insert on purchase_order_lines
    mock_lines_insert = MagicMock()
    mock_lines_insert.insert.return_value.execute.return_value.data = [{
        "id": str(uuid4()),
        "po_id": po_id,
        "item_id": item_id,
        "qty_ordered_base": 10.0,
        "unit_cost_base": 10.0,
        "qty_pending_base": 10.0,
        "qty_received_base": 0.0,
        "line_total": 100.0,
        "status": "pending"
    }]

    def side_effect(name):
        if name == "purchase_orders":
            return mock_po_insert
        elif name == "purchase_order_lines":
            return mock_lines_insert
        return MagicMock()

    mock_supabase.table.side_effect = side_effect
    mock_supabase.table.return_value = mock_po_select  # Fallback for SELECT

    payload = {
        "supplier_id": supplier_id,
        "requested_date": "2026-07-20",
        "payment_terms_days": 15,
        "warehouse_id": warehouse_id,
        "lines": [
            {
                "item_id": item_id,
                "qty_ordered_base": 10.0,
                "unit_cost_base": 10.0
            }
        ]
    }

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post("/purchase-orders", json=payload)

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["po_number"] == f"PO-{date.today().year}-0001"
    assert response.json()["status"] == "draft"
    assert response.json()["total"] == 116.0
    assert mock_po_insert.insert.called
    assert mock_lines_insert.insert.called

def test_submit_purchase_order_pending(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    po_id = str(uuid4())
    creator_id = str(uuid4())

    # Mock PO select returns: first "draft" for status check, second "pending" for final get
    mock_po_execute = MagicMock()
    mock_po_execute.execute.side_effect = [
        MagicMock(data=[{
            "id": po_id,
            "org_id": org_id,
            "po_number": "PO-2026-0001",
            "total": 1500.0,
            "status": "draft",
            "created_by": creator_id,
            "supplier_id": str(uuid4()),
            "warehouse_id": str(uuid4()),
            "created_at": "2026-07-14T00:00:00Z"
        }]),
        MagicMock(data=[{
            "id": po_id,
            "org_id": org_id,
            "po_number": "PO-2026-0001",
            "total": 1500.0,
            "status": "pending",
            "created_by": creator_id,
            "supplier_id": str(uuid4()),
            "warehouse_id": str(uuid4()),
            "created_at": "2026-07-14T00:00:00Z"
        }])
    ]

    mock_po_table = MagicMock()
    mock_po_table.select.return_value.eq.return_value.eq.return_value = mock_po_execute

    # Mock PO update
    mock_po_table.update.return_value.eq.return_value.execute.return_value.data = [{
        "id": po_id,
        "status": "pending"
    }]

    # Mock config retrieval
    mock_config_table = MagicMock()
    mock_config_table.select.return_value.eq.return_value.execute.return_value.data = [{
        "org_id": org_id,
        "creator_can_approve_own": False,
        "require_approval_above": 0.0
    }]

    # Mock lines & approvals queries returning empty
    mock_sub_queries = MagicMock()
    mock_sub_queries.select.return_value.eq.return_value.execute.return_value.data = []

    def side_effect(name):
        if name == "purchase_orders":
            return mock_po_table
        elif name == "po_approval_config":
            return mock_config_table
        elif name in ["purchase_order_lines", "po_approvals", "suppliers", "warehouses"]:
            return mock_sub_queries
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post(f"/purchase-orders/{po_id}/submit")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "pending"

def test_approve_purchase_order_insufficient_limit(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    po_id = str(uuid4())
    creator_id = str(uuid4())

    # Mock PO retrieval
    mock_po_table = MagicMock()
    mock_po_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "id": po_id,
        "org_id": org_id,
        "po_number": "PO-2026-0001",
        "total": 1500.0,
        "status": "pending",
        "created_by": creator_id,
        "supplier_id": str(uuid4()),
        "warehouse_id": str(uuid4()),
        "created_at": "2026-07-14T00:00:00Z"
    }]

    # Mock custom roles/profiles to retrieve approver role
    mock_profile_roles = MagicMock()
    mock_profile_roles.select.return_value.eq.return_value.execute.return_value.data = [{
        "role_id": "role-manager"
    }]

    # Mock limit retrieval: limit is 1000.0 (less than 1500.0)
    mock_limits_table = MagicMock()
    mock_limits_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "max_amount": 1000.0
    }]

    def side_effect(name):
        if name == "purchase_orders":
            return mock_po_table
        elif name == "profile_roles":
            return mock_profile_roles
        elif name == "po_approval_limits":
            return mock_limits_table
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post(f"/purchase-orders/{po_id}/approve")

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert "supera el límite" in response.json()["detail"]

def test_approve_purchase_order_sufficient_limit(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    po_id = str(uuid4())
    creator_id = str(uuid4())

    # Mock PO select returns: first "pending" for check, second "approved" for final get
    mock_po_execute = MagicMock()
    mock_po_execute.execute.side_effect = [
        MagicMock(data=[{
            "id": po_id,
            "org_id": org_id,
            "po_number": "PO-2026-0001",
            "total": 1500.0,
            "status": "pending",
            "created_by": creator_id,
            "supplier_id": str(uuid4()),
            "warehouse_id": str(uuid4()),
            "created_at": "2026-07-14T00:00:00Z"
        }]),
        MagicMock(data=[{
            "id": po_id,
            "org_id": org_id,
            "po_number": "PO-2026-0001",
            "total": 1500.0,
            "status": "approved",
            "created_by": creator_id,
            "supplier_id": str(uuid4()),
            "warehouse_id": str(uuid4()),
            "created_at": "2026-07-14T00:00:00Z"
        }])
    ]

    mock_po_table = MagicMock()
    mock_po_table.select.return_value.eq.return_value.eq.return_value = mock_po_execute

    # Mock PO update
    mock_po_table.update.return_value.eq.return_value.execute.return_value.data = [{
        "id": po_id,
        "status": "approved"
    }]

    # Mock custom roles/profiles
    mock_profile_roles = MagicMock()
    mock_profile_roles.select.return_value.eq.return_value.execute.return_value.data = [{
        "role_id": "role-admin"
    }]

    # Mock limit retrieval: limit is 2000.0 (greater than 1500.0)
    mock_limits_table = MagicMock()
    mock_limits_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "max_amount": 2000.0
    }]

    # Mock po_approvals insert
    mock_approvals_table = MagicMock()
    mock_approvals_table.insert.return_value.execute.return_value.data = []

    # Mock lines & approvals queries returning empty
    mock_sub_queries = MagicMock()
    mock_sub_queries.select.return_value.eq.return_value.execute.return_value.data = []

    def side_effect(name):
        if name == "purchase_orders":
            return mock_po_table
        elif name == "profile_roles":
            return mock_profile_roles
        elif name == "po_approval_limits":
            return mock_limits_table
        elif name == "po_approvals":
            return mock_approvals_table
        elif name in ["purchase_order_lines", "suppliers", "warehouses"]:
            return mock_sub_queries
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    payload = {"notes": "Aprobación verificada"}

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post(f"/purchase-orders/{po_id}/approve", json=payload)

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    assert mock_approvals_table.insert.called

def test_reject_purchase_order(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    po_id = str(uuid4())
    creator_id = str(uuid4())

    # Mock PO select returns: first "pending" for check, second "draft" for final get
    mock_po_execute = MagicMock()
    mock_po_execute.execute.side_effect = [
        MagicMock(data=[{
            "id": po_id,
            "org_id": org_id,
            "po_number": "PO-2026-0001",
            "total": 1500.0,
            "status": "pending",
            "created_by": creator_id,
            "supplier_id": str(uuid4()),
            "warehouse_id": str(uuid4()),
            "created_at": "2026-07-14T00:00:00Z"
        }]),
        MagicMock(data=[{
            "id": po_id,
            "org_id": org_id,
            "po_number": "PO-2026-0001",
            "total": 1500.0,
            "status": "draft",
            "created_by": creator_id,
            "supplier_id": str(uuid4()),
            "warehouse_id": str(uuid4()),
            "created_at": "2026-07-14T00:00:00Z"
        }])
    ]

    mock_po_table = MagicMock()
    mock_po_table.select.return_value.eq.return_value.eq.return_value = mock_po_execute

    # Mock PO update
    mock_po_table.update.return_value.eq.return_value.execute.return_value.data = [{
        "id": po_id,
        "status": "draft"
    }]

    # Mock po_approvals insert
    mock_approvals_table = MagicMock()
    mock_approvals_table.insert.return_value.execute.return_value.data = []

    # Mock lines & approvals queries returning empty
    mock_sub_queries = MagicMock()
    mock_sub_queries.select.return_value.eq.return_value.execute.return_value.data = []

    def side_effect(name):
        if name == "purchase_orders":
            return mock_po_table
        elif name == "po_approvals":
            return mock_approvals_table
        elif name in ["purchase_order_lines", "suppliers", "warehouses"]:
            return mock_sub_queries
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    payload = {"notes": "Falta especificar la presentación exacta."}

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post(f"/purchase-orders/{po_id}/reject", json=payload)

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "draft"
    assert mock_approvals_table.insert.called
