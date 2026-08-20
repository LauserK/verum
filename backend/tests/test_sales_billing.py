import pytest
from uuid import uuid4
from decimal import Decimal
from unittest.mock import patch, MagicMock, AsyncMock
from main import app, get_active_org_id
from auth_deps import get_current_user

@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    user.full_name = "Admin User"
    return user

def test_create_and_confirm_invoice(client, mock_supabase, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    
    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)
        
        invoice_id = str(uuid4())
        tax_id = str(uuid4())
        
        # Mock tax response
        mock_tax_execute = MagicMock()
        mock_tax_execute.execute.return_value.data = [{
            "id": tax_id, "name": "IVA 16%", "rate": 0.16
        }]
        
        # Mock invoice inserts
        mock_inv_insert = MagicMock()
        mock_inv_insert.insert.return_value.execute.return_value.data = [{
            "id": invoice_id, "org_id": org_id, "document_number": "FAC-00000001"
        }]
        
        # Mock get_invoice_detail
        mock_get_detail = MagicMock()
        mock_get_detail.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
            "id": invoice_id, "org_id": org_id, "document_type": "invoice",
            "document_number": "FAC-00000001", "fiscal_number": None,
            "numbering_source": "external", "customer_name": "Cliente General",
            "customer_tax_id": None, "customer_address": None,
            "date": "2026-08-20", "due_date": None, "status": "draft",
            "currency_code": "USD", "exchange_rate": 1.0,
            "subtotal": 10.0, "discount_amount": 0.0, "total_taxable": 10.0,
            "total_exempt": 0.0, "total_tax": 1.6, "total_surcharges": 0.0,
            "total": 11.6, "amount_paid": 0.0, "balance_due": 11.6,
            "related_invoice_id": None, "pos_session_id": None,
            "notes": None, "internal_notes": None,
            "created_by": None, "voided_by": None, "voided_at": None, "void_reason": None,
            "created_at": "2026-08-20T12:00:00Z", "updated_at": "2026-08-20T12:00:00Z",
            "invoice_items": [
                {
                    "id": str(uuid4()), "invoice_id": invoice_id, "description": "Hamburguesa",
                    "quantity": 1.0, "unit_price": 10.0, "discount_pct": 0.0, "discount_amount": 0.0,
                    "tax_id": tax_id, "tax_name": "IVA 16%", "tax_rate": 0.16, "is_exempt": False,
                    "subtotal": 10.0, "tax_amount": 1.6, "total": 11.6, "unit_food_cost": 0.0,
                    "modifiers": [], "position": 0
                }
            ],
            "invoice_tax_summary": [
                {
                    "id": str(uuid4()), "invoice_id": invoice_id, "tax_id": tax_id,
                    "tax_name": "IVA 16%", "tax_rate": 0.16, "taxable_base": 10.0, "tax_amount": 1.6
                }
            ]
        }]
        
        def side_effect(table_name):
            if table_name == "taxes":
                return mock_tax_execute
            elif table_name == "invoices":
                # For inserts, return mock_inv_insert. For selects, return mock_get_detail
                return mock_get_detail
            elif table_name == "invoice_items":
                return MagicMock()
            elif table_name == "invoice_tax_summary":
                return MagicMock()
            elif table_name == "tenant_billing_config":
                m = MagicMock()
                m.select.return_value.eq.return_value.execute.return_value.data = [{
                    "id": str(uuid4()), "org_id": org_id, "rounding_mode": "round_half_up", "rounding_precision": 2
                }]
                return m
            return MagicMock()
            
        mock_supabase.table.side_effect = side_effect
        mock_supabase.table.return_value = mock_get_detail # Fallback
        mock_get_detail.insert = mock_inv_insert.insert
        
        payload = {
            "document_number": "FAC-00000001",
            "numbering_source": "external",
            "currency_code": "USD",
            "items": [
                {
                    "description": "Hamburguesa",
                    "quantity": 1.0,
                    "unit_price": 10.0,
                    "tax_id": tax_id
                }
            ]
        }
        
        response = client.post("/sales/invoices", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["document_number"] == "FAC-00000001"
        assert float(data["total"]) == 11.6
        assert len(data["items"]) == 1
        assert float(data["tax_summary"][0]["tax_amount"]) == 1.6
        
        # Test Confirm
        mock_confirm_execute = MagicMock()
        mock_confirm_execute.execute.return_value.data = [{
            "id": invoice_id, "status": "confirmed"
        }]
        
        # Add update mock to existing mock_get_detail (which already handles select)
        mock_get_detail.update.return_value.eq.return_value = mock_confirm_execute
        
        confirm_resp = client.post(f"/sales/invoices/{invoice_id}/confirm")
        assert confirm_resp.status_code == 200
        assert confirm_resp.json()["status"] == "confirmed"
        
        app.dependency_overrides.clear()
