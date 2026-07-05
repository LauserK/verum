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
    # Patch resolve_permission in permissions module to bypass auth checks in test context
    with patch("permissions.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        yield client
    app.dependency_overrides.clear()

def test_purchase_receipt_flow(authorized_client, mock_supabase):
    receipt_id = str(uuid.uuid4())

    def mock_table(table_name):
        mock_query = MagicMock()
        if table_name == "uom_presentations":
            mock_query.select().eq().execute.return_value = MagicMock(data=[{"conversion_factor": 1.0}])
        elif table_name == "inventory_document_sequences":
            mock_query.select().eq().eq().execute.return_value = MagicMock(data=[{"last_value": 0}])
        elif table_name == "inventory_documents":
            # Handles insert and select
            mock_query.insert().execute.return_value = MagicMock(data=[{
                "id": receipt_id,
                "status": "draft",
                "warehouse_id": WAREHOUSE_ID,
                "document_type": "receipt"
            }])
            mock_query.select().eq().execute.return_value = MagicMock(data=[{
                "id": receipt_id,
                "status": "draft",
                "warehouse_id": WAREHOUSE_ID,
                "document_type": "receipt"
            }])
        elif table_name == "inventory_document_lines":
            # For insert, then for select in process_inventory_document
            mock_query.insert().execute.return_value = MagicMock(data=[])
            mock_query.select().eq().execute.return_value = MagicMock(data=[{
                "id": str(uuid.uuid4()),
                "item_id": ITEM_ID,
                "qty_presentation": 10.0,
                "presentation_id": UOM_ID,
                "qty_base": 10.0,
                "unit_cost_base": 100.0,
                "lot_number": "L1",
                "expiry_date": None
            }])
        elif table_name == "stock":
            mock_query.select().eq().eq().execute.return_value = MagicMock(data=[])
            mock_query.insert().execute.return_value = MagicMock(data=[])
        elif table_name == "stock_lots":
            mock_query.insert().execute.return_value = MagicMock(data=[{"id": str(uuid.uuid4())}])
        elif table_name == "stock_movements":
            mock_query.insert().execute.return_value = MagicMock(data=[])
        elif table_name == "items":
            mock_query.update().eq().execute.return_value = MagicMock(data=[])
        
        # Default chain mocks
        mock_query.update().eq().execute.return_value = MagicMock(data=[])
        return mock_query

    mock_supabase.table.side_effect = mock_table

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
    issue_id = str(uuid.uuid4())

    def mock_table(table_name):
        mock_query = MagicMock()
        if table_name == "uom_presentations":
            mock_query.select().eq().execute.return_value = MagicMock(data=[{"conversion_factor": 1.0}])
        elif table_name == "inventory_document_sequences":
            mock_query.select().eq().eq().execute.return_value = MagicMock(data=[{"last_value": 0}])
        elif table_name == "inventory_documents":
            mock_query.insert().execute.return_value = MagicMock(data=[{
                "id": issue_id,
                "status": "draft",
                "warehouse_id": WAREHOUSE_ID,
                "document_type": "issue",
                "reason": "sale",
                "notes": "Test notes"
            }])
            mock_query.select().eq().execute.return_value = MagicMock(data=[{
                "id": issue_id,
                "status": "draft",
                "warehouse_id": WAREHOUSE_ID,
                "document_type": "issue",
                "reason": "sale",
                "notes": "Test notes"
            }])
        elif table_name == "inventory_document_lines":
            mock_query.insert().execute.return_value = MagicMock(data=[])
            mock_query.select().eq().execute.return_value = MagicMock(data=[{
                "id": str(uuid.uuid4()),
                "item_id": ITEM_ID,
                "qty_presentation": 15.0,
                "presentation_id": UOM_ID,
                "qty_base": 15.0
            }])
        elif table_name == "stock_lots":
            # For query in issue consumption
            mock_query.select().eq().eq().filter().order().execute.return_value = MagicMock(data=[
                {"id": LOT_1_ID, "qty_base": 10.0, "unit_cost_base": 1.0, "item_id": ITEM_ID, "warehouse_id": WAREHOUSE_ID},
                {"id": LOT_2_ID, "qty_base": 20.0, "unit_cost_base": 1.2, "item_id": ITEM_ID, "warehouse_id": WAREHOUSE_ID}
            ])
            mock_query.insert().execute.return_value = MagicMock(data=[])
        elif table_name == "items":
            mock_query.select().eq().single().execute.return_value = MagicMock(data={"org_id": ORG_ID, "id": ITEM_ID})
        elif table_name == "stock":
            mock_query.select().eq().eq().execute.return_value = MagicMock(data=[
                {"id": str(uuid.uuid4()), "qty_base": 50.0}
            ])
        elif table_name == "stock_movements":
            mock_query.insert().execute.return_value = MagicMock(data=[])

        # Default chain mocks
        mock_query.update().eq().execute.return_value = MagicMock(data=[])
        return mock_query

    mock_supabase.table.side_effect = mock_table

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
