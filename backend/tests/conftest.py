import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app, get_db

@pytest.fixture
def mock_supabase():
    with patch("database.supabase") as mock:
        yield mock

@pytest.fixture
def client(mock_supabase):
    return TestClient(app)

@pytest.fixture
def mock_db():
    mock = MagicMock()
    # Configurar retornos por defecto para consultas comunes
    return mock

@pytest.fixture
def authenticated_user_mock():
    user = MagicMock()
    user.id = "test-user-id"
    user.email = "test@example.com"
    user.user_metadata = {"full_name": "Test User"}
    return user
