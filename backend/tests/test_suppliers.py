# backend/tests/test_suppliers.py

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
    user.full_name = "Purchasing Manager"
    return user

def test_create_supplier(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    supplier_id = str(uuid4())

    mock_suppliers = MagicMock()
    mock_suppliers.insert.return_value.execute.return_value.data = [{
        "id": supplier_id,
        "org_id": org_id,
        "code": "SUP-001",
        "name": "Distribuidora XYZ",
        "tax_id": "RIF-12345",
        "email": "xyz@example.com",
        "phone": "+12345678",
        "address": "Calle Falsa 123",
        "payment_terms_days": 30,
        "credit_limit": 1000.0,
        "currency": "USD",
        "status": "active",
        "score": None,
        "notes": "Proveedor preferido de harina",
        "created_at": "2026-07-05T00:00:00Z"
    }]

    mock_contacts = MagicMock()
    mock_contacts.insert.return_value.execute.return_value.data = []

    def side_effect(name):
        if name == "suppliers":
            return mock_suppliers
        elif name == "supplier_contacts":
            return mock_contacts
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    payload = {
        "name": "Distribuidora XYZ",
        "tax_id": "RIF-12345",
        "email": "xyz@example.com",
        "phone": "+12345678",
        "address": "Calle Falsa 123",
        "payment_terms_days": 30,
        "credit_limit": 1000.0,
        "currency": "USD",
        "status": "active",
        "notes": "Proveedor preferido de harina",
        "contacts": [
            {
                "name": "Juan Perez",
                "role": "ventas",
                "email": "juan@example.com",
                "phone": "+12345679",
                "is_primary": True
            }
        ]
    }

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post("/suppliers", json=payload)

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["name"] == "Distribuidora XYZ"
    assert response.json()["code"] == "SUP-001"
    assert mock_suppliers.insert.called
    assert mock_contacts.insert.called

def test_create_price_list_overlap(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    supplier_id = str(uuid4())
    item_id = str(uuid4())

    # Simulate existing active price lists for this supplier
    mock_price_lists = MagicMock()
    # When querying existing lists for this supplier, return one that runs from 2026-07-01 to 2026-07-31
    mock_price_lists.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": str(uuid4()),
            "supplier_id": supplier_id,
            "name": "List Julio",
            "valid_from": "2026-07-01",
            "valid_until": "2026-07-31",
            "is_active": True
        }
    ]

    def side_effect(name):
        if name == "supplier_price_lists":
            return mock_price_lists
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    # New price list overlaps (2026-07-15 to 2026-08-15)
    payload = {
        "name": "List Julio-Agosto",
        "valid_from": "2026-07-15",
        "valid_until": "2026-08-15",
        "is_active": True,
        "items": [
            {
                "item_id": item_id,
                "unit_cost_base": 12.5,
                "min_qty_base": 1.0
            }
        ]
    }

    with patch("permissions.resolve_permission", return_value=True):
        response = client.post(f"/suppliers/{supplier_id}/price-lists", json=payload)

    app.dependency_overrides.clear()

    # Should fail due to overlap validation
    assert response.status_code == 400
    assert "overlaps" in response.json()["detail"].lower()

def test_po_approval_limits_owner(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    role_id = str(uuid4())
    limit_id = str(uuid4())

    mock_limits = MagicMock()
    mock_limits.upsert.return_value.execute.return_value.data = [{
        "id": limit_id,
        "org_id": org_id,
        "role_id": role_id,
        "max_amount": None
    }]

    mock_roles = MagicMock()
    # Mock finding the custom role to make sure it exists and checking if it's "owner" or "dueño"
    mock_roles.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "id": role_id,
        "org_id": org_id,
        "name": "dueño",
        "is_admin": True
    }]

    def side_effect(name):
        if name == "po_approval_limits":
            return mock_limits
        elif name == "custom_roles":
            return mock_roles
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    # Try setting limit for owner role. Standard roles might have limits, but owner should remain NULL.
    # If the user tries to send a number for owner, the business logic should override or validate.
    payload = {
        "role_id": role_id,
        "max_amount": 5000.0  # Even if sent, backend should validate or fail if it's owner.
    }

    with patch("permissions.resolve_permission", return_value=True):
        response = client.put("/po-approval-limits", json=payload)

    app.dependency_overrides.clear()

    # The backend should enforce that owner roles max_amount must be null or throw bad request if trying to set it.
    # In our plan, "Validar que el rol 'dueño' quede con null"
    assert response.status_code == 400
    assert "owner" in response.json()["detail"].lower() or "dueño" in response.json()["detail"].lower()

def test_list_po_approval_limits(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    mock_limits = MagicMock()
    mock_limits.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": str(uuid4()),
            "org_id": org_id,
            "role_id": str(uuid4()),
            "max_amount": 1000.0
        }
    ]

    def side_effect(name):
        if name == "po_approval_limits":
            return mock_limits
        return MagicMock()

    mock_supabase.table.side_effect = side_effect

    with patch("permissions.resolve_permission", return_value=True):
        response = client.get("/po-approval-limits")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["max_amount"] == 1000.0

