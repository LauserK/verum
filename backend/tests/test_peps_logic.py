import pytest
import uuid
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app

# Valid UUIDs for testing
ORG_ID = str(uuid.uuid4())
WAREHOUSE_ID = str(uuid.uuid4())
ITEM_ID = str(uuid.uuid4())
LOT_1_ID = str(uuid.uuid4())
LOT_2_ID = str(uuid.uuid4())
UOM_ID = str(uuid.uuid4())

@pytest.fixture
def authorized_client(client, authenticated_user_mock):
    from auth_deps import get_current_user
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    from main import get_active_org_id
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        yield client
    app.dependency_overrides.clear()

def test_purchase_receipt_flow(authorized_client, mock_supabase):
    receipt_id = str(uuid.uuid4())
    # Mock for successful receipt creation and confirmation
    mock_supabase.table().insert().execute.return_value = MagicMock(data=[{
        "id": receipt_id,
        "status": "confirmed",
        "warehouse_id": WAREHOUSE_ID,
        "created_at": "2026-06-10T12:00:00Z"
    }])
    
    # Mock presentation lookup
    mock_supabase.table().select().eq().execute.return_value = MagicMock(data=[{"conversion_factor": 1.0}])
    
    # Mock other inserts
    mock_supabase.table().update().eq().execute.return_value = MagicMock(data=[])
    
    response = authorized_client.post("/inventory/purchase-receipts", json={
        "warehouse_id": WAREHOUSE_ID,
        "supplier": "Proveedor Test",
        "receipt_number": "FAC-001",
        "lines": [
            {
                "item_id": ITEM_ID,
                "qty_presentation": 10,
                "presentation_id": UOM_ID,
                "unit_cost_presentation": 100.0
            }
        ]
    })

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"

def test_fifo_issue_logic(authorized_client, mock_supabase):
    # Mocking FIFO logic: 
    # Lot 1: 10 units @ $1
    # Lot 2: 20 units @ $1.2
    # Issue: 15 units -> Should consume 10 from Lot 1 and 5 from Lot 2
    
    # Mock issue document creation (header)
    issue_id = str(uuid.uuid4())
    mock_supabase.table().insert().execute.return_value = MagicMock(data=[{
        "id": issue_id,
        "org_id": ORG_ID,
        "warehouse_id": WAREHOUSE_ID,
        "reason": "sale",
        "status": "confirmed",
        "created_at": "2026-06-10T12:00:00Z"
    }])
    
    # Mock presentation lookup
    mock_supabase.table().select().eq().execute.return_value = MagicMock(data=[{"conversion_factor": 1.0}])
    
    # Mock lots query
    mock_supabase.table().select().eq().eq().filter().order().execute.return_value = MagicMock(data=[
        {"id": LOT_1_ID, "qty_base": 10.0, "unit_cost_base": 1.0, "item_id": ITEM_ID, "warehouse_id": WAREHOUSE_ID},
        {"id": LOT_2_ID, "qty_base": 20.0, "unit_cost_base": 1.2, "item_id": ITEM_ID, "warehouse_id": WAREHOUSE_ID}
    ])
    
    # Mock item info lookup (single)
    mock_supabase.table().select().eq().single().execute.return_value = MagicMock(data={"org_id": ORG_ID, "id": ITEM_ID})

    # Mock stock query (2 eq's)
    mock_supabase.table().select().eq().eq().execute.return_value = MagicMock(data=[
        {"id": str(uuid.uuid4()), "qty_base": 50.0}
    ])

    # Mock RPC and other updates
    mock_supabase.rpc().execute.return_value = MagicMock(data=[])
    mock_supabase.table().update().eq().execute.return_value = MagicMock(data=[])

    response = authorized_client.post("/inventory/issue-documents", json={
        "warehouse_id": WAREHOUSE_ID,
        "reason": "sale",
        "lines": [
            {
                "item_id": ITEM_ID,
                "qty_presentation": 15,
                "presentation_id": UOM_ID # Assuming 1:1 for simplicity in this test
            }
        ]
    })

    assert response.status_code == 200
    # The actual updates to DB are handled by the endpoint, we just verify it completes
