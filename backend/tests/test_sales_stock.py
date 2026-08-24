import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from main import app, get_active_org_id
from auth_deps import get_current_user


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    user.full_name = "Test User"
    return user


def test_reserve_stock_success(client, mock_supabase, mock_user):
    """Reserve stock when available."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    item_id = str(uuid4())
    wh_id = str(uuid4())

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.sales.stock_service.cache") as mock_cache:
            mock_cache.hgetall = AsyncMock(return_value={})
            mock_cache.hset = AsyncMock()
            mock_cache.expire = AsyncMock()

            def table_router(name):
                mock_t = MagicMock()
                if name == "sale_items":
                    mock_t.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                        {"allow_negative_stock": False}
                    ]
                elif name == "stock_lots":
                    mock_t.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                        {"qty_base": 10.0}
                    ]
                return mock_t

            mock_supabase.table.side_effect = table_router

            response = client.post("/sales/stock/reserve", json={
                "sale_item_id": item_id,
                "cart_line_id": "line-1",
                "quantity": 2,
                "warehouse_id": wh_id,
                "session_id": "sess-1"
            })

            assert response.status_code == 200
    app.dependency_overrides.clear()


def test_reserve_stock_insufficient(client, mock_supabase, mock_user):
    """Reject reservation when stock insufficient and allow_negative_stock=false."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    item_id = str(uuid4())
    wh_id = str(uuid4())

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.sales.stock_service.cache") as mock_cache:
            mock_cache.hgetall = AsyncMock(return_value={"other:line": "8"})
            mock_cache.hset = AsyncMock()
            mock_cache.expire = AsyncMock()

            def table_router(name):
                mock_t = MagicMock()
                if name == "sale_items":
                    mock_t.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                        {"allow_negative_stock": False}
                    ]
                elif name == "stock_lots":
                    mock_t.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                        {"qty_base": 10.0}
                    ]
                return mock_t

            mock_supabase.table.side_effect = table_router

            response = client.post("/sales/stock/reserve", json={
                "sale_item_id": item_id,
                "cart_line_id": "line-2",
                "quantity": 5,
                "warehouse_id": wh_id,
                "session_id": "sess-1"
            })

            assert response.status_code == 400
            assert "OUT_OF_STOCK" in response.json().get("detail", "")
    app.dependency_overrides.clear()

