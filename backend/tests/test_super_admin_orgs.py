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
async def test_list_all_organizations(override_super_admin):
    db = MagicMock()
    db.table().select().execute.return_value.data = [{"id": "org-1", "name": "Org 1"}]
    
    with patch("main.get_db", return_value=db):
        response = client.get("/super-admin/organizations")
        assert response.status_code == 200
        assert response.json() == [{"id": "org-1", "name": "Org 1"}]

@pytest.mark.asyncio
async def test_update_organization_status(override_super_admin):
    db = MagicMock()
    db.table().update().eq().execute.return_value.data = [{"id": "org-1", "is_active": False}]
    
    with patch("main.get_db", return_value=db):
        response = client.patch("/super-admin/organizations/org-1", json={"is_active": False})
        assert response.status_code == 200
        assert response.json()["is_active"] == False
