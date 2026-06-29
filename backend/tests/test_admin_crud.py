import pytest
import uuid
from unittest.mock import MagicMock, patch
from main import app

# Generate valid UUIDs for testing
ORG_ID = str(uuid.uuid4())
VENUE_ID = str(uuid.uuid4())
SHIFT_ID = str(uuid.uuid4())
TEMPLATE_ID = str(uuid.uuid4())
QUESTION_ID = str(uuid.uuid4())

@pytest.fixture
def authorized_client(client, authenticated_user_mock):
    # Mock FastAPI dependencies
    from auth_deps import get_current_user
    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    
    from main import get_active_org_id
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    
    with patch("main.resolve_permission", return_value=True), \
         patch("main.check_restriction", return_value=False):
        yield client
    
    app.dependency_overrides.clear()

@pytest.fixture
def mock_supabase_registry(mock_supabase):
    registry = {}
    
    def mock_table(table_name):
        mock_t = MagicMock()
        mock_t.select.return_value = mock_t
        mock_t.insert.return_value = mock_t
        mock_t.update.return_value = mock_t
        mock_t.upsert.return_value = mock_t
        mock_t.eq.return_value = mock_t
        mock_t.in_.return_value = mock_t
        mock_t.gte.return_value = mock_t
        mock_t.order.return_value = mock_t
        mock_t.single.return_value = mock_t
        
        def execute_side_effect():
            res = registry.get(table_name, [])
            return MagicMock(data=res)
            
        mock_t.execute.side_effect = execute_side_effect
        return mock_t

    mock_supabase.table.side_effect = mock_table
    return registry

def test_create_venue(authorized_client, mock_supabase_registry):
    mock_supabase_registry["venues"] = [{
        "id": VENUE_ID,
        "org_id": ORG_ID,
        "name": "Sede Las Mercedes",
        "address": "Calle Paris"
    }]

    payload = {
        "org_id": ORG_ID,
        "name": "Sede Las Mercedes",
        "address": "Calle Paris"
    }
    response = authorized_client.post("/admin/venues", json=payload)
    assert response.status_code == 200
    assert response.json()["name"] == "Sede Las Mercedes"
    assert response.json()["id"] == VENUE_ID

def test_create_shift(authorized_client, mock_supabase_registry):
    mock_supabase_registry["shifts"] = [{
        "id": SHIFT_ID,
        "venue_id": VENUE_ID,
        "name": "Turno Mañana",
        "start_time": "08:00:00",
        "end_time": "16:00:00"
    }]

    payload = {
        "venue_id": VENUE_ID,
        "name": "Turno Mañana",
        "start_time": "08:00:00",
        "end_time": "16:00:00"
    }
    response = authorized_client.post("/admin/shifts", json=payload)
    assert response.status_code == 200
    assert response.json()["name"] == "Turno Mañana"
    assert response.json()["id"] == SHIFT_ID

def test_create_template(authorized_client, mock_supabase_registry):
    mock_supabase_registry["checklist_templates"] = [{
        "id": TEMPLATE_ID,
        "venue_id": VENUE_ID,
        "title": "Apertura de Salón",
        "description": "Lista diaria",
        "frequency": "daily",
        "prerequisite_template_id": None
    }]

    payload = {
        "venue_id": VENUE_ID,
        "title": "Apertura de Salón",
        "description": "Lista diaria",
        "frequency": "daily",
        "prerequisite_template_id": None
    }
    response = authorized_client.post("/admin/templates", json=payload)
    assert response.status_code == 200
    assert response.json()["title"] == "Apertura de Salón"
    assert response.json()["id"] == TEMPLATE_ID

def test_create_question(authorized_client, mock_supabase_registry):
    mock_supabase_registry["questions"] = [{
        "id": QUESTION_ID,
        "template_id": TEMPLATE_ID,
        "label": "¿Mesas limpias?",
        "type": "check",
        "is_required": True,
        "config": None
    }]

    payload = {
        "template_id": TEMPLATE_ID,
        "label": "¿Mesas limpias?",
        "type": "check",
        "is_required": True,
        "config": None
    }
    response = authorized_client.post("/admin/questions", json=payload)
    assert response.status_code == 200
    assert response.json()["label"] == "¿Mesas limpias?"
    assert response.json()["id"] == QUESTION_ID

def test_reorder_questions(authorized_client, mock_supabase_registry):
    mock_supabase_registry["questions"] = []

    payload = {
        "questions": [
            {"id": QUESTION_ID, "sort_order": 1}
        ]
    }
    response = authorized_client.put(f"/admin/templates/{TEMPLATE_ID}/questions/reorder", json=payload)
    assert response.status_code == 200
    assert response.json()["ok"] is True
