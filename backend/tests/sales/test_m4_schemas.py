from decimal import Decimal
from uuid import UUID
import pytest
from pydantic import ValidationError

from app.sales.schemas import (
    SeatSchema,
    CartItemSchema,
    TableOrderUpdate,
    SplitCheckoutCreate,
    TransferRequest,
    MergeRequest,
)


def test_seat_schema():
    seat = SeatSchema(id="seat-1", label="Asiento 1")
    assert seat.id == "seat-1"
    assert seat.label == "Asiento 1"

    # Test label max length
    with pytest.raises(ValidationError):
        SeatSchema(id="seat-2", label="x" * 51)


def test_cart_item_schema_accepts_seats_and_sent_to_kitchen():
    item = CartItemSchema(
        cartItemId="123",
        id="prod-1",
        name="Burger",
        price=Decimal("10.0"),
        quantity=1,
        seat="seat-1",
        sentToKitchen=True,
    )
    assert item.seat == "seat-1"
    assert item.sentToKitchen is True
    assert item.cartItemId == "123"
    assert item.name == "Burger"
    assert item.price == Decimal("10.0")


def test_cart_item_schema_defaults_and_optional_fields():
    item = CartItemSchema(
        cartItemId="item-2",
        id="prod-2",
        name="Soda",
        price=Decimal("2.50"),
        quantity=2,
    )
    assert item.seat is None
    assert item.sentToKitchen is False
    assert item.tax_included is True
    assert item.notes is None


def test_table_order_update_schema():
    order_update = TableOrderUpdate(
        cart=[
            CartItemSchema(
                cartItemId="item-1",
                id="prod-1",
                name="Burger",
                price=Decimal("10.0"),
                quantity=1,
                seat="seat-1",
                sentToKitchen=True,
            )
        ],
        seats=[SeatSchema(id="seat-1", label="Mesa Principal")],
        assigned_to=UUID("123e4567-e89b-12d3-a456-426614174000"),
        status="active",
        customer_id=UUID("123e4567-e89b-12d3-a456-426614174001"),
        customer_name="John Doe",
        customer_tax_id="V-12345678",
        payment_pending=False,
    )
    assert len(order_update.cart) == 1
    assert len(order_update.seats) == 1
    assert order_update.status == "active"
    assert order_update.payment_pending is False
    assert order_update.customer_name == "John Doe"


def test_split_checkout_create_schema():
    checkout = SplitCheckoutCreate(
        workstation_id=UUID("123e4567-e89b-12d3-a456-426614174000"),
        pos_session_id=UUID("123e4567-e89b-12d3-a456-426614174000"),
        venue_id=UUID("123e4567-e89b-12d3-a456-426614174000"),
        mode="tables",
        items=[],
        payments=[],
        change={"amount": 0, "currency_code": "USD", "method": "cash"},
        document_type="invoice",
        discount_amount=Decimal("0"),
        split_mode="seats",
        is_partial=True,
        seat_label="Pedro",
        covered_item_ids=["cart-1"],
    )
    assert checkout.is_partial is True
    assert checkout.seat_label == "Pedro"
    assert checkout.split_mode == "seats"
    assert checkout.covered_item_ids == ["cart-1"]


def test_transfer_request_schema():
    req = TransferRequest(
        source_table_id="table-1",
        target_table_id="table-2",
        transfer_type="items",
        item_ids=["item-1", "item-2"],
        seat_id="seat-1",
    )
    assert req.source_table_id == "table-1"
    assert req.target_table_id == "table-2"
    assert req.transfer_type == "items"
    assert req.item_ids == ["item-1", "item-2"]
    assert req.seat_id == "seat-1"


def test_merge_request_schema():
    req = MergeRequest(
        source_table_id="table-1",
        target_table_id="table-2",
    )
    assert req.source_table_id == "table-1"
    assert req.target_table_id == "table-2"
