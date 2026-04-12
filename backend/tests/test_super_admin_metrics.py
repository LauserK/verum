import pytest
from unittest.mock import MagicMock, patch
from main import app, get_db
from permissions import get_super_admin
from fastapi.testclient import TestClient

client = TestClient(app)

# Mock user for super admin
mock_super_admin = MagicMock()
mock_super_admin.id = "super-123"

@pytest.fixture
def override_super_admin():
    app.dependency_overrides[get_super_admin] = lambda: mock_super_admin
    yield
    app.dependency_overrides = {}

@pytest.mark.asyncio
async def test_get_global_metrics(override_super_admin):
    db = MagicMock()
    
    # Configure mock for each table
    orgs_mock = MagicMock()
    orgs_mock.select().execute.return_value.count = 10
    
    venues_mock = MagicMock()
    venues_mock.select().execute.return_value.count = 50
    
    users_mock = MagicMock()
    users_mock.select().execute.return_value.count = 200
    
    def table_side_effect(name):
        if name == "organizations": return orgs_mock
        if name == "venues": return venues_mock
        if name == "profiles": return users_mock
        return MagicMock()
        
    db.table.side_effect = table_side_effect
    
    with patch("main.get_db", return_value=db):
        response = client.get("/super-admin/metrics")
        assert response.status_code == 200
        data = response.json()
        assert data["total_organizations"] == 10
        assert data["total_venues"] == 50
        assert data["total_users"] == 200
