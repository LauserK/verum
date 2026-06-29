import pytest
import uuid
from unittest.mock import MagicMock, patch
from main import app

# Generate valid UUIDs for testing
ORG_ID = str(uuid.uuid4())
VENUE_ID = str(uuid.uuid4())
TEMPLATE_ID = str(uuid.uuid4())
PREREQ_TEMPLATE_ID = str(uuid.uuid4())
SUBMISSION_ID = str(uuid.uuid4())
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
        action = ["select"]
        is_single = [False]
        
        def set_action(act):
            def wrapper(*args, **kwargs):
                action[0] = act
                return mock_t
            return wrapper
            
        mock_t.select.side_effect = set_action("select")
        mock_t.insert.side_effect = set_action("insert")
        mock_t.update.side_effect = set_action("update")
        mock_t.upsert.side_effect = set_action("upsert")
        
        mock_t.eq.return_value = mock_t
        mock_t.in_.return_value = mock_t
        mock_t.gte.return_value = mock_t
        mock_t.lte.return_value = mock_t
        mock_t.order.return_value = mock_t
        mock_t.limit.return_value = mock_t
        
        def set_single():
            is_single[0] = True
            return mock_t
        mock_t.single.side_effect = set_single
        
        def execute_side_effect():
            act = action[0]
            key = f"{table_name}_{act}"
            if key in registry:
                res = registry[key]
            else:
                res = registry.get(table_name, [])
            
            if is_single[0]:
                data = res[0] if (isinstance(res, list) and len(res) > 0) else res
            else:
                data = res
            return MagicMock(data=data)
            
        mock_t.execute.side_effect = execute_side_effect
        return mock_t

    mock_supabase.table.side_effect = mock_table
    return registry

def test_auth_sync_new_user(authorized_client, mock_supabase_registry):
    mock_supabase_registry["profiles_select"] = []
    mock_supabase_registry["profiles_insert"] = []
    
    response = authorized_client.post("/auth/sync")
    assert response.status_code == 200
    assert response.json()["role"] == "staff"
    assert response.json()["is_superadmin"] is False

def test_auth_sync_existing_user(authorized_client, mock_supabase_registry):
    mock_supabase_registry["profiles_select"] = [{
        "id": "test-user-id",
        "role": "admin",
        "is_superadmin": True,
        "organization_id": None
    }]
    response = authorized_client.post("/auth/sync")
    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    assert response.json()["is_superadmin"] is True

def test_get_checklists_unlocked(authorized_client, mock_supabase_registry):
    mock_supabase_registry["venues"] = [{"org_id": ORG_ID}]
    mock_supabase_registry["profile_venues"] = [{"venue_id": VENUE_ID}]
    mock_supabase_registry["employee_shifts"] = []
    mock_supabase_registry["checklist_templates"] = [{
        "id": TEMPLATE_ID,
        "title": "Apertura Cocina",
        "description": "Tareas iniciales",
        "frequency": "daily",
        "prerequisite_template_id": None
    }]
    mock_supabase_registry["questions"] = []
    mock_supabase_registry["submissions"] = []

    response = authorized_client.get(f"/checklists/{VENUE_ID}")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Apertura Cocina"
    assert response.json()[0]["status"] == "pending"

def test_get_checklists_locked(authorized_client, mock_supabase_registry):
    mock_supabase_registry["venues"] = [{"org_id": ORG_ID}]
    mock_supabase_registry["profile_venues"] = [{"venue_id": VENUE_ID}]
    mock_supabase_registry["employee_shifts"] = []
    mock_supabase_registry["checklist_templates"] = [
        {
            "id": PREREQ_TEMPLATE_ID,
            "title": "Checklist Previo",
            "description": "Debe completarse primero",
            "frequency": "daily",
            "prerequisite_template_id": None
        },
        {
            "id": TEMPLATE_ID,
            "title": "Checklist Bloqueado",
            "description": "Esperando el previo",
            "frequency": "daily",
            "prerequisite_template_id": PREREQ_TEMPLATE_ID
        }
    ]
    mock_supabase_registry["questions"] = []
    mock_supabase_registry["submissions"] = []

    response = authorized_client.get(f"/checklists/{VENUE_ID}")
    assert response.status_code == 200
    templates = response.json()
    locked_item = next(t for t in templates if t["id"] == TEMPLATE_ID)
    assert locked_item["status"] == "locked"

def test_create_submission_idempotency(authorized_client, mock_supabase_registry):
    mock_supabase_registry["profile_venues"] = [{"venue_id": VENUE_ID}]
    mock_supabase_registry["employee_shifts"] = []
    mock_supabase_registry["checklist_templates"] = [{"frequency": "daily"}]
    mock_supabase_registry["submissions_select"] = []
    mock_supabase_registry["submissions_insert"] = [{
        "id": SUBMISSION_ID,
        "template_id": TEMPLATE_ID,
        "user_id": "test-user-id",
        "venue_id": VENUE_ID,
        "shift": "morning",
        "status": "draft"
    }]

    response = authorized_client.post("/submissions", json={
        "template_id": TEMPLATE_ID,
        "venue_id": VENUE_ID,
        "shift": "morning"
    })
    assert response.status_code == 200
    assert response.json()["id"] == SUBMISSION_ID
    assert response.json()["status"] == "draft"

def test_auto_save_answers(authorized_client, mock_supabase_registry):
    payload = {
        "answers": [
            {
                "question_id": QUESTION_ID,
                "value": "85.5",
                "photo_label": None,
                "is_critical_failure": False,
                "is_non_critical_issue": False
            }
        ]
    }
    response = authorized_client.put(f"/submissions/{SUBMISSION_ID}/answers", json=payload)
    assert response.status_code == 200
    assert response.json()["ok"] is True

def test_submit_checklist_completed(authorized_client, mock_supabase_registry):
    mock_supabase_registry["submissions_select"] = [{
        "template_id": TEMPLATE_ID
    }]
    mock_supabase_registry["answers_select"] = []
    mock_supabase_registry["submissions_update"] = [{
        "id": SUBMISSION_ID,
        "template_id": TEMPLATE_ID,
        "status": "completed"
    }]

    response = authorized_client.patch(f"/submissions/{SUBMISSION_ID}", json={
        "status": "completed",
        "auditor_notes": "Todo en orden",
        "auditor_confirmed": True
    })
    assert response.status_code == 200
    assert response.json() == {"ok": True}
