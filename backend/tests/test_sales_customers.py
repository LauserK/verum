import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from main import app, get_active_org_id
from auth_deps import get_current_user

@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    user.full_name = "Admin User"
    return user

def test_create_customer(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)
        
        customer_id = str(uuid4())
        mock_insert = MagicMock()
        mock_insert.insert.return_value.execute.return_value.data = [{
            "id": customer_id, "org_id": org_id, "name": "Cliente General",
            "tax_id": "V-12345678-9", "customer_type": "individual",
            "email": "cliente@verum.com", "phone": "0412-1234567",
            "address": "Caracas", "credit_limit": 500.0, "credit_days": 15,
            "current_balance": 0.0, "is_tax_exempt": False,
            "is_withholding_agent": False, "withholding_rate": 0.0,
            "is_active": True, "notes": "No notes",
            "created_at": "2026-08-20T12:00:00Z", "updated_at": "2026-08-20T12:00:00Z"
        }]
        mock_supabase.table.return_value = mock_insert
        
        payload = {
            "name": "Cliente General",
            "tax_id": "V-12345678-9",
            "customer_type": "individual",
            "email": "cliente@verum.com",
            "phone": "0412-1234567",
            "address": "Caracas",
            "credit_limit": 500.0,
            "credit_days": 15
        }
        
        response = client.post("/sales/customers", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Cliente General"
        assert data["tax_id"] == "V-12345678-9"
        assert float(data["credit_limit"]) == 500.0
        app.dependency_overrides.clear()

def test_create_document_sequence(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)
        
        sequence_id = str(uuid4())
        mock_insert = MagicMock()
        mock_insert.insert.return_value.execute.return_value.data = [{
            "id": sequence_id, "org_id": org_id, "document_type": "invoice",
            "prefix": "FAC-", "next_number": 1, "padding": 8
        }]
        mock_supabase.table.return_value = mock_insert
        
        payload = {
            "document_type": "invoice",
            "prefix": "FAC-",
            "next_number": 1,
            "padding": 8
        }
        
        response = client.post("/sales/sequences", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["document_type"] == "invoice"
        assert data["prefix"] == "FAC-"
        app.dependency_overrides.clear()
