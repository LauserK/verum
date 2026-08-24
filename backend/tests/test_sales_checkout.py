import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from main import app, get_active_org_id
from auth_deps import get_current_user


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    user.full_name = "Cashier User"
    return user


def _checkout_payload(ws_id, session_id, venue_id, item_id, pm_id):
    return {
        "workstation_id": ws_id,
        "pos_session_id": session_id,
        "venue_id": venue_id,
        "mode": "takeout",
        "items": [{
            "sale_item_id": item_id,
            "quantity": 2,
            "unit_price": 10.0,
            "discount_pct": 0,
        }],
        "payments": [{
            "payment_method_id": pm_id,
            "amount": 20.0,
            "currency_code": "USD",
            "exchange_rate": 1.0,
            "cash_tendered": 25.0
        }],
        "change": {
            "amount": 5.0,
            "currency_code": "USD",
            "method": "cash"
        },
        "document_type": "invoice"
    }


def test_checkout_success(client, mock_supabase, mock_user):
    """Full checkout flow: create invoice + payment + confirm."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    session_id = str(uuid4())
    venue_id = str(uuid4())
    item_id = str(uuid4())
    pm_id = str(uuid4())
    invoice_id = str(uuid4())
    wh_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.sales.checkout_service.resolve_pos_config") as mock_config:
            mock_config.return_value = {
                "customer_requirement": "optional",
                "warehouse_id": wh_id,
                "resolved_from": "default"
            }

            with patch("app.sales.checkout_service.release_session_reservations", new_callable=AsyncMock):
                # Mock session check
                mock_session = MagicMock()
                mock_session.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id": session_id, "status": "open"}
                ]

                # Mock doc number
                mock_supabase.rpc.return_value.execute.return_value.data = "FAC-000001"

                # Mock payment method
                mock_pm = MagicMock()
                mock_pm.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id": pm_id, "name": "Efectivo USD", "method_type": "cash", "currency_code": "USD"}
                ]

                # Mock invoice insert
                mock_inv = MagicMock()
                mock_inv.insert.return_value.execute.return_value.data = [{
                    "id": invoice_id, "document_number": "FAC-000001",
                    "status": "paid", "total": 20.0, "amount_paid": 20.0,
                    "balance_due": 0, "currency_code": "USD",
                    "customer_name": "Cliente General"
                }]

                # Mock invoice items insert
                mock_items = MagicMock()
                mock_items.insert.return_value.execute.return_value.data = [{}]

                # Mock payment insert
                mock_pay = MagicMock()
                mock_pay.insert.return_value.execute.return_value.data = [{}]

                def table_router(name):
                    if name == "pos_sessions":
                        return mock_session
                    elif name == "payment_methods":
                        return mock_pm
                    elif name == "invoices":
                        return mock_inv
                    elif name == "invoice_items":
                        return mock_items
                    elif name == "payments":
                        return mock_pay
                    return MagicMock()

                mock_supabase.table.side_effect = table_router

                payload = _checkout_payload(ws_id, session_id, venue_id, item_id, pm_id)
                response = client.post("/sales/checkout", json=payload)

                assert response.status_code == 200
                data = response.json()
                assert data["invoice"]["status"] == "paid"
    app.dependency_overrides.clear()


def test_checkout_customer_required_missing(client, mock_supabase, mock_user):
    """Reject checkout when customer is required but not provided."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    wh_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.sales.checkout_service.resolve_pos_config") as mock_config:
            mock_config.return_value = {
                "customer_requirement": "required",
                "warehouse_id": wh_id,
                "resolved_from": "tenant_billing_config"
            }

            payload = _checkout_payload(ws_id, str(uuid4()), str(uuid4()), str(uuid4()), str(uuid4()))
            response = client.post("/sales/checkout", json=payload)

            assert response.status_code == 400
            assert "CUSTOMER_REQUIRED" in response.json().get("detail", "")
    app.dependency_overrides.clear()
