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


def _split_checkout_payload(ws_id, session_id, venue_id, table_id, item_id, pm_id, payment_amount=10.0, is_partial=True, seat_label="Asiento 1", covered_items=None):
    return {
        "workstation_id": ws_id,
        "pos_session_id": session_id,
        "venue_id": venue_id,
        "mode": "tables",
        "table_id": table_id,
        "items": [{
            "sale_item_id": item_id,
            "quantity": 3,
            "unit_price": 10.0,
            "discount_pct": 0,
        }],
        "payments": [{
            "payment_method_id": pm_id,
            "amount": payment_amount,
            "currency_code": "USD",
            "exchange_rate": 1.0,
            "seat_label": seat_label,
            "covered_items": covered_items or ["item-uuid-1"]
        }],
        "document_type": "invoice",
        "is_partial": is_partial,
        "split_mode": "seats",
        "seat_label": seat_label,
        "covered_item_ids": covered_items or ["item-uuid-1"]
    }


def test_first_partial_checkout_creates_partial_invoice(client, mock_supabase, mock_user):
    """First partial payment creates an invoice in status='partial' and does NOT close table order."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    session_id = str(uuid4())
    venue_id = str(uuid4())
    table_id = str(uuid4())
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

            with patch("app.sales.checkout_service.release_session_reservations", new_callable=AsyncMock) as mock_release, \
                 patch("app.sales.inventory_deduction.deduct_inventory_for_invoice", new_callable=AsyncMock) as mock_deduct, \
                 patch("app.cache.invalidate_table_orders", new_callable=AsyncMock):

                mock_session = MagicMock()
                mock_session.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id": session_id, "status": "open"}
                ]

                mock_pm = MagicMock()
                mock_pm.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id": pm_id, "name": "Efectivo USD", "method_type": "cash", "currency_code": "USD"}
                ]

                mock_table_order = MagicMock()
                mock_table_order.select.return_value.eq.return_value.eq.return_value.in_.return_value.limit.return_value.execute.return_value.data = [
                    {"id": table_id, "table_id": table_id, "status": "active"}
                ]
                mock_table_order.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{}]

                mock_inv = MagicMock()
                mock_inv.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []
                mock_inv.insert.return_value.execute.return_value.data = [{
                    "id": invoice_id,
                    "document_number": "INV-00000001",
                    "status": "partial",
                    "total": 30.0,
                    "amount_paid": 10.0,
                    "balance_due": 20.0,
                    "currency_code": "USD",
                    "table_order_id": table_id
                }]

                mock_pay = MagicMock()
                mock_pay.insert.return_value.execute.return_value.data = [{}]

                mock_items = MagicMock()
                mock_items.insert.return_value.execute.return_value.data = [{}]

                def table_router(name):
                    if name == "pos_sessions":
                        return mock_session
                    elif name == "payment_methods":
                        return mock_pm
                    elif name == "pos_table_orders":
                        return mock_table_order
                    elif name == "invoices":
                        return mock_inv
                    elif name == "invoice_items":
                        return mock_items
                    elif name == "payments":
                        return mock_pay
                    return MagicMock()

                mock_supabase.table.side_effect = table_router
                mock_supabase.rpc.return_value.execute.return_value.data = "INV-00000001"

                payload = _split_checkout_payload(ws_id, session_id, venue_id, table_id, item_id, pm_id, payment_amount=10.0, is_partial=True)
                response = client.post("/sales/checkout", json=payload)

                assert response.status_code == 200
                data = response.json()
                assert data["invoice"]["status"] == "partial"
                assert data["invoice"]["amount_paid"] == 10.0
                assert data["invoice"]["balance_due"] == 20.0

                insert_pay_call = mock_pay.insert.call_args[0][0]
                assert insert_pay_call["seat_label"] == "Asiento 1"
                assert insert_pay_call["covered_items"] == ["item-uuid-1"]

                mock_deduct.assert_not_called()
                mock_release.assert_not_called()

    app.dependency_overrides.clear()


def test_subsequent_partial_checkout_reuses_invoice_and_finishes_on_zero_balance(client, mock_supabase, mock_user):
    """Subsequent partial payment reuses existing invoice. When balance reaches 0, order closes and inventory is deducted."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    session_id = str(uuid4())
    venue_id = str(uuid4())
    table_id = str(uuid4())
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

            with patch("app.sales.checkout_service.release_session_reservations", new_callable=AsyncMock) as mock_release, \
                 patch("app.sales.inventory_deduction.deduct_inventory_for_invoice", new_callable=AsyncMock) as mock_deduct, \
                 patch("app.cache.invalidate_table_orders", new_callable=AsyncMock):

                mock_session = MagicMock()
                mock_session.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id": session_id, "status": "open"}
                ]

                mock_pm = MagicMock()
                mock_pm.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id": pm_id, "name": "Tarjeta", "method_type": "card", "currency_code": "USD"}
                ]

                mock_table_order = MagicMock()
                mock_table_order.select.return_value.eq.return_value.eq.return_value.in_.return_value.limit.return_value.execute.return_value.data = [
                    {"id": table_id, "table_id": table_id, "status": "active"}
                ]
                mock_table_order.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{}]

                mock_inv = MagicMock()
                mock_inv.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [{
                    "id": invoice_id,
                    "document_number": "INV-00000001",
                    "status": "partial",
                    "total": 30.0,
                    "amount_paid": 10.0,
                    "balance_due": 20.0,
                    "currency_code": "USD",
                    "table_order_id": table_id
                }]
                mock_inv.update.return_value.eq.return_value.execute.return_value.data = [{}]

                mock_pay = MagicMock()
                mock_pay.insert.return_value.execute.return_value.data = [{}]

                def table_router(name):
                    if name == "pos_sessions":
                        return mock_session
                    elif name == "payment_methods":
                        return mock_pm
                    elif name == "pos_table_orders":
                        return mock_table_order
                    elif name == "invoices":
                        return mock_inv
                    elif name == "payments":
                        return mock_pay
                    return MagicMock()

                mock_supabase.table.side_effect = table_router

                payload = _split_checkout_payload(ws_id, session_id, venue_id, table_id, item_id, pm_id, payment_amount=20.0, is_partial=True, seat_label="Asiento 2", covered_items=["item-uuid-2", "item-uuid-3"])
                response = client.post("/sales/checkout", json=payload)

                assert response.status_code == 200
                data = response.json()
                assert data["invoice"]["status"] == "paid"
                assert data["invoice"]["amount_paid"] == 30.0
                assert data["invoice"]["balance_due"] == 0.0

                update_call = mock_inv.update.call_args[0][0]
                assert update_call["status"] == "paid"
                assert update_call["balance_due"] == 0.0
                assert update_call["amount_paid"] == 30.0

                update_order_call = mock_table_order.update.call_args[0][0]
                assert update_order_call["status"] == "billed"

                mock_deduct.assert_called_once()
                mock_release.assert_called_once()

    app.dependency_overrides.clear()


def test_get_invoice_by_table_order_endpoint(client, mock_supabase, mock_user):
    """GET /sales/invoices/by-table-order/{table_order_id} returns partial invoice and associated payments."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    table_order_id = str(uuid4())
    invoice_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        mock_inv = MagicMock()
        mock_inv.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [{
            "id": invoice_id,
            "table_order_id": table_order_id,
            "status": "partial",
            "total": 50.0,
            "amount_paid": 20.0,
            "balance_due": 30.0,
            "invoice_items": [{"id": str(uuid4()), "description": "Burger", "total": 20.0}],
            "invoice_tax_summary": []
        }]

        mock_pay = MagicMock()
        mock_pay.select.return_value.eq.return_value.execute.return_value.data = [{
            "id": str(uuid4()),
            "invoice_id": invoice_id,
            "amount": 20.0,
            "seat_label": "Asiento 1",
            "covered_items": ["item-1"]
        }]

        def table_router(name):
            if name == "invoices":
                return mock_inv
            elif name == "payments":
                return mock_pay
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.get(f"/sales/invoices/by-table-order/{table_order_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["invoice"]["id"] == invoice_id
        assert data["invoice"]["status"] == "partial"
        assert len(data["payments"]) == 1
        assert data["payments"][0]["seat_label"] == "Asiento 1"

    app.dependency_overrides.clear()


def test_get_invoice_by_table_order_not_found(client, mock_supabase, mock_user):
    """GET /sales/invoices/by-table-order/{table_order_id} returns null if no active partial invoice exists."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    table_order_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        mock_inv = MagicMock()
        mock_inv.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []

        mock_table_order = MagicMock()
        mock_table_order.select.return_value.eq.return_value.eq.return_value.in_.return_value.limit.return_value.execute.return_value.data = []

        def table_router(name):
            if name == "invoices":
                return mock_inv
            elif name == "pos_table_orders":
                return mock_table_order
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.get(f"/sales/invoices/by-table-order/{table_order_id}")
        assert response.status_code == 200
        assert response.json() is None

    app.dependency_overrides.clear()
