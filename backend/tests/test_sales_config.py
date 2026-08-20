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

def test_get_billing_config_auto_create(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)
        
        # Scenario: DB returns empty for GET
        mock_select = MagicMock()
        mock_select.select.return_value.eq.return_value.execute.return_value.data = []
        
        # DB returns created config for INSERT
        mock_insert = MagicMock()
        mock_insert.insert.return_value.execute.return_value.data = [{
            "id": str(uuid4()), "org_id": org_id, "surcharges": [], 
            "withholding_enabled": False, "rounding_mode": "round_half_up",
            "rounding_precision": 2, "created_at": "2026-08-20T12:00:00Z", "updated_at": "2026-08-20T12:00:00Z"
        }]
        
        mock_supabase.table.return_value = mock_select
        mock_select.insert = mock_insert.insert
        
        response = client.get("/sales/config")
        
        assert response.status_code == 200
        data = response.json()
        assert data["org_id"] == org_id
        assert data["rounding_mode"] == "round_half_up"
        app.dependency_overrides.clear()

def test_create_payment_method(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)
        
        mock_insert = MagicMock()
        mock_insert.insert.return_value.execute.return_value.data = [{
            "id": str(uuid4()), "org_id": org_id, "name": "Zelle",
            "method_type": "digital_wallet", "currency_code": "USD",
            "instructions": "Send to admin@zelle.com", "is_active": True,
            "requires_reference": True, "position": 0, "created_at": "2026-08-20T12:00:00Z"
        }]
        mock_supabase.table.return_value = mock_insert
        
        payload = {
            "name": "Zelle",
            "method_type": "digital_wallet",
            "currency_code": "USD"
        }
        response = client.post("/sales/payment-methods", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Zelle"
        assert data["method_type"] == "digital_wallet"
        app.dependency_overrides.clear()


