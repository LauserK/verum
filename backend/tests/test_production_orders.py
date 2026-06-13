import pytest
from uuid import uuid4
from decimal import Decimal
from unittest.mock import patch, MagicMock
from main import app, get_active_org_id
from auth_deps import get_current_user

def test_update_order_status(client, mock_supabase, authenticated_user_mock):
    # Setup
    order_id = str(uuid4())
    mock_user = MagicMock()
    mock_user.id = str(uuid4())
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    # Mock update response
    mock_supabase.table().update().eq().eq().execute.return_value.data = [{
        "id": order_id, 
        "status": "in_progress",
        "order_number": "OP-TEST-001",
        "item_id": str(uuid4()),
        "recipe_id": str(uuid4()),
        "warehouse_id": str(uuid4()),
        "qty_ordered_base": 10.0,
        "priority": "normal",
        "scheduled_date": "2026-06-12",
        "created_at": "2026-06-12T00:00:00Z"
    }]
    
    with patch("main.require_permission", return_value=lambda x: None):
        with patch("main.check_restriction", return_value=False):
            with patch("main.resolve_permission", return_value=True):
                response = client.patch(f"/production/orders/{order_id}/status", json={"status": "in_progress"})
    
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"

def test_get_kds_orders(client, mock_supabase, authenticated_user_mock):
    warehouse_id = str(uuid4())
    
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    mock_supabase.table().select().eq().eq().in_().order().order().execute.return_value.data = []
    
    with patch("main.require_permission", return_value=lambda x: None):
        with patch("main.check_restriction", return_value=False):
            with patch("main.resolve_permission", return_value=True):
                response = client.get(f"/production/orders/kds?warehouse_id={warehouse_id}")
    
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_complete_order_variance_block(client, mock_supabase, authenticated_user_mock):
    order_id = str(uuid4())
    
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[get_active_org_id] = lambda: str(uuid4())
    
    # Mock order fetch
    mock_supabase.table().select().eq().execute.return_value.data = [{
        "id": order_id,
        "qty_ordered_base": 100.0,
        "items": {
            "yield_alert_enabled": True,
            "yield_alert_threshold_pct": 5.0
        }
    }]
    
    with patch("main.require_permission", return_value=lambda x: None):
        with patch("main.check_restriction", return_value=False):
            with patch("main.resolve_permission", return_value=True):
                # 40 produced vs 100 ordered = -60% variance. Threshold is 5%.
                response = client.post(f"/production/orders/{order_id}/complete", json={"qty_produced_base": 40.0, "ignore_variance": False})
    
    app.dependency_overrides.clear()
    
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "VARIANCE_EXCEEDED"
