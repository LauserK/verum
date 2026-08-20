import pytest
from unittest.mock import MagicMock
from app.sales.schemas import CurrencyCreate, ExchangeRateCreate
import app.sales.service as sales_svc

@pytest.mark.asyncio
async def test_create_and_list_currencies():
    mock_db = MagicMock()
    org_id = "00000000-0000-0000-0000-000000000001"
    
    currency_payload = CurrencyCreate(
        code="USD",
        name="Dólar Estadounidense",
        symbol="$",
        is_base=True
    )
    
    # Mock insert
    mock_db.table().insert().execute.return_value.data = [{
        "id": "11111111-1111-1111-1111-111111111111",
        "org_id": org_id,
        "code": "USD",
        "name": "Dólar Estadounidense",
        "symbol": "$",
        "is_base": True,
        "is_active": True,
        "created_at": "2026-08-20T00:00:00Z"
    }]
    
    created = await sales_svc.create_currency(org_id, currency_payload, mock_db)
    assert created["code"] == "USD"
    assert created["is_base"] is True

@pytest.mark.asyncio
async def test_register_and_get_exchange_rate():
    mock_db = MagicMock()
    org_id = "00000000-0000-0000-0000-000000000001"
    user_id = "22222222-2222-2222-2222-222222222222"
    
    rate_payload = ExchangeRateCreate(
        from_currency="USD",
        to_currency="VES",
        rate=40.50
    )
    
    mock_db.table().insert().execute.return_value.data = [{
        "id": "33333333-3333-3333-3333-333333333333",
        "org_id": org_id,
        "from_currency": "USD",
        "to_currency": "VES",
        "rate": 40.50,
        "created_by": user_id
    }]
    
    created_rate = await sales_svc.create_exchange_rate(org_id, rate_payload, user_id, mock_db)
    assert created_rate["from_currency"] == "USD"
    assert created_rate["to_currency"] == "VES"
    assert float(created_rate["rate"]) == 40.50
