import pytest
import uuid
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app

# Generar UUIDs válidos para los tests
ORG_ID = str(uuid.uuid4())
WAREHOUSE_ID = str(uuid.uuid4())
BASE_UOM_ID = str(uuid.uuid4())

@pytest.fixture
def authorized_client(client, authenticated_user_mock):
    # Mockear la dependencia get_current_user para que devuelva el usuario autenticado
    from auth_deps import get_current_user
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    
    # También mockeamos get_active_org_id
    from main import get_active_org_id
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    
    with patch("main.resolve_permission", return_value=True):
        yield client
    
    app.dependency_overrides.clear()

def test_create_warehouse(authorized_client, mock_supabase):
    # Configurar el mock de supabase para simular una inserción exitosa
    mock_supabase.table().insert().execute.return_value = MagicMock(data=[{
        "id": WAREHOUSE_ID,
        "org_id": ORG_ID,
        "venue_id": None,
        "name": "Almacén Central",
        "type": "storage",
        "is_active": True
    }])

    response = authorized_client.post("/inventory/warehouses", json={
        "name": "Almacén Central",
        "type": "storage"
    }, headers={"X-Org-ID": ORG_ID})

    assert response.status_code == 200
    assert response.json()["name"] == "Almacén Central"
    assert response.json()["id"] == WAREHOUSE_ID

def test_list_warehouses(authorized_client, mock_supabase):
    mock_supabase.table().select().eq().execute.return_value = MagicMock(data=[
        {"id": WAREHOUSE_ID, "name": "WH 1", "type": "storage", "org_id": ORG_ID, "is_active": True, "venue_id": None}
    ])

    response = authorized_client.get("/inventory/warehouses", headers={"X-Org-ID": ORG_ID})

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "WH 1"
    assert response.json()[0]["id"] == WAREHOUSE_ID

def test_create_item(authorized_client, mock_supabase):
    item_id = str(uuid.uuid4())
    mock_supabase.table().insert().execute.return_value = MagicMock(data=[{
        "id": item_id,
        "org_id": ORG_ID,
        "code": "ITEM-001",
        "name": "Harina de Trigo",
        "type": "raw_material",
        "base_uom_id": BASE_UOM_ID,
        "is_active": True,
        "created_at": "2026-06-10T12:00:00Z"
    }])

    response = authorized_client.post("/inventory/items", json={
        "code": "ITEM-001",
        "name": "Harina de Trigo",
        "type": "raw_material",
        "base_uom_id": BASE_UOM_ID
    }, headers={"X-Org-ID": ORG_ID})

    assert response.status_code == 200
    assert response.json()["name"] == "Harina de Trigo"
    assert response.json()["id"] == item_id

def test_list_items(authorized_client, mock_supabase):
    item_id = str(uuid.uuid4())
    mock_supabase.table().select().eq().execute.return_value = MagicMock(data=[
        {
            "id": item_id,
            "org_id": ORG_ID,
            "code": "ITEM-001",
            "name": "Harina de Trigo",
            "type": "raw_material",
            "base_uom_id": BASE_UOM_ID,
            "is_active": True,
            "created_at": "2026-06-10T12:00:00Z"
        }
    ])

    response = authorized_client.get("/inventory/items", headers={"X-Org-ID": ORG_ID})

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Harina de Trigo"

def test_create_item_category(authorized_client, mock_supabase):
    category_id = str(uuid.uuid4())
    mock_supabase.table().insert().execute.return_value = MagicMock(data=[{
        "id": category_id,
        "org_id": ORG_ID,
        "name": "Harinas",
        "description": "Todo tipo de harinas",
        "is_active": True
    }])

    response = authorized_client.post("/inventory/item-categories", json={
        "name": "Harinas",
        "description": "Todo tipo de harinas"
    }, headers={"X-Org-ID": ORG_ID})

    assert response.status_code == 200
    assert response.json()["name"] == "Harinas"
    assert response.json()["id"] == category_id
