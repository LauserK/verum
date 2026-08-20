import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from main import app, get_active_org_id
from auth_deps import get_current_user

@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    user.full_name = "Cashier"
    return user

def test_add_payment_with_surcharges(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)
        
        invoice_id = str(uuid4())
        pm_id = str(uuid4())
        
        # Mock invoice fetch
        mock_inv_select = MagicMock()
        mock_inv_select.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "id": invoice_id, "org_id": org_id, "status": "confirmed",
            "subtotal": 100.0, "total_tax": 16.0, "total": 116.0, "amount_paid": 0.0, "balance_due": 116.0
        }]
        
        # Mock payment method fetch
        mock_pm_select = MagicMock()
        mock_pm_select.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "id": pm_id, "org_id": org_id, "name": "Credit Card", "method_type": "card"
        }]
        
        # Mock billing config fetch
        mock_cfg_select = MagicMock()
        mock_cfg_select.select.return_value.eq.return_value.execute.return_value.data = [{
            "id": str(uuid4()), "org_id": org_id, "rounding_mode": "none", "rounding_precision": 2,
            "surcharges": [
                {
                    "name": "Card Surcharge 5%",
                    "rate": 0.05,
                    "apply_to_payment_methods": [pm_id],
                    "is_active": True
                }
            ]
        }]
        
        # Mock payment insert
        mock_pay_insert = MagicMock()
        mock_pay_insert.insert.return_value.execute.return_value.data = [{
            "id": str(uuid4()), "invoice_id": invoice_id, "payment_method_id": pm_id,
            "method_name": "Credit Card", "method_type": "card", "amount": 100.0,
            "currency_code": "USD", "exchange_rate": 1.0, "amount_in_invoice_currency": 100.0,
            "surcharges_applied": [{"name": "Card Surcharge 5%", "rate": 0.05, "base_amount": 100.0, "surcharge_amount": 5.0}],
            "total_surcharges": 5.0, "reference": "REF123", "cash_tendered": None, "cash_change": None,
            "status": "completed", "notes": "Paid by CC", "recorded_by": mock_user.id,
            "created_at": "2026-08-20T12:00:00Z"
        }]
        
        # Mock select all payments (to recalculate balance)
        mock_pays_select = MagicMock()
        mock_pays_select.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "amount_in_invoice_currency": 100.0, "total_surcharges": 5.0
        }]
        
        # Mock update invoice
        mock_inv_update = MagicMock()
        mock_inv_update.update.return_value.eq.return_value.execute.return_value.data = [{}]
        
        def side_effect(table_name):
            if table_name == "invoices":
                # For update and select
                m = MagicMock()
                m.select.return_value.eq.return_value.eq.return_value.execute = mock_inv_select.select.return_value.eq.return_value.eq.return_value.execute
                m.update = mock_inv_update.update
                return m
            elif table_name == "payment_methods":
                return mock_pm_select
            elif table_name == "tenant_billing_config":
                return mock_cfg_select
            elif table_name == "payments":
                m = MagicMock()
                m.insert = mock_pay_insert.insert
                m.select = mock_pays_select.select
                return m
            return MagicMock()
            
        mock_supabase.table.side_effect = side_effect
        
        payload = {
            "payment_method_id": pm_id,
            "amount": 100.0,
            "currency_code": "USD",
            "reference": "REF123",
            "notes": "Paid by CC"
        }
        
        response = client.post(f"/sales/invoices/{invoice_id}/payments", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["method_name"] == "Credit Card"
        assert float(data["total_surcharges"]) == 5.0
        assert len(data["surcharges_applied"]) == 1
        
        app.dependency_overrides.clear()
