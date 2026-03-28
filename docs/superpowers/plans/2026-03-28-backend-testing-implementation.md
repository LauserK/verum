# Backend Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar una suite de pruebas robusta para el backend (FastAPI), incluyendo pruebas unitarias para lógica de negocio y pruebas de integración para los endpoints principales, asegurando la estabilidad y facilitando futuras refactorizaciones.

**Architecture:** Se utilizará `pytest` con `httpx` para pruebas asíncronas. Se implementará una estrategia de "mocking" para Supabase para evitar dependencias externas durante los tests. Se realizará una refactorización quirúrgica inicial para extraer modelos Pydantic y facilitar la importación en los tests.

**Tech Stack:** pytest, pytest-asyncio, httpx, unittest.mock.

---

### Task 1: Configuración del Entorno de Pruebas

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/pytest.ini`

- [ ] **Step 1: Añadir dependencias de testing**

Añadir al final de `backend/requirements.txt`:
```text
pytest==8.3.4
pytest-asyncio==0.25.3
httpx==0.28.1
pytest-mock==3.14.0
```

- [ ] **Step 2: Instalar dependencias**

Run: `pip install -r backend/requirements.txt`

- [ ] **Step 3: Crear configuración de pytest**

Crear `backend/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
```

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini
git commit -m "test: setup pytest environment and dependencies"
```

---

### Task 2: Refactorización Quirúrgica - Extracción de Schemas

**Files:**
- Create: `backend/schemas.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Extraer modelos Pydantic a schemas.py**

Mover todas las clases `BaseModel` de `main.py` a `backend/schemas.py`.

```python
from pydantic import BaseModel
from typing import Optional, List

class SyncResponse(BaseModel):
    id: str
    role: str

class VenueInfo(BaseModel):
    id: str
    name: str

class ProfileResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    role: str
    organization_id: Optional[str] = None
    venues: List[VenueInfo] = []
    venue_id: Optional[str] = None
    shift_id: Optional[str] = None
    shift_name: Optional[str] = None

# ... (todas las demás modelos: ChecklistItem, CreateSubmissionRequest, etc.)
```

- [ ] **Step 2: Actualizar imports en main.py**

```python
from schemas import (
    SyncResponse, VenueInfo, ProfileResponse, ChecklistItem,
    CreateSubmissionRequest, SubmissionQuestion, SubmissionDetail,
    PatchSubmissionRequest, HistoryItem
)
# Eliminar las definiciones de clases en main.py
```

- [ ] **Step 3: Verificar que la API sigue funcionando**

Run: `uvicorn main:app --reload` (Verificar que no hay errores de sintaxis/importación)

- [ ] **Step 4: Commit**

```bash
git add backend/schemas.py backend/main.py
git commit -m "refactor: extract pydantic models to schemas.py"
```

---

### Task 3: Base de Pruebas y Fixtures

**Files:**
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Implementar fixtures base y mocks de Supabase**

Crear `backend/tests/conftest.py`:
```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "test: add base fixtures and supabase mocks"
```

---

### Task 4: Unit Tests para Funciones de Utilidad

**Files:**
- Create: `backend/tests/test_utils.py`

- [ ] **Step 1: Probar get_current_shift**

```python
from main import get_current_shift
from datetime import datetime
from unittest.mock import patch
import pytz

CARACAS_TZ = pytz.timezone("America/Caracas")

def test_get_current_shift_morning():
    # Mock datetime para que sean las 8 AM en Caracas
    with patch("main.datetime") as mock_date:
        mock_date.now.return_value = datetime(2024, 1, 1, 8, 0, tzinfo=CARACAS_TZ)
        assert get_current_shift() == "morning"

def test_get_current_shift_mid():
    with patch("main.datetime") as mock_date:
        mock_date.now.return_value = datetime(2024, 1, 1, 15, 0, tzinfo=CARACAS_TZ)
        assert get_current_shift() == "mid"
```

- [ ] **Step 2: Ejecutar tests**

Run: `pytest backend/tests/test_utils.py`

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_utils.py
git commit -m "test: unit tests for utility functions"
```

---

### Task 5: Integration Tests para Endpoints Críticos

**Files:**
- Create: `backend/tests/test_endpoints.py`

- [ ] **Step 1: Probar endpoint root y /me**

```python
def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "VERUM API is running"}

@patch("main.get_current_user")
@patch("main.get_db")
def test_get_profile_success(mock_get_db, mock_get_user, client, authenticated_user_mock):
    # Setup
    mock_get_user.return_value = authenticated_user_mock
    mock_db_instance = MagicMock()
    mock_get_db.return_value = mock_db_instance
    
    mock_db_instance.table().select().eq().execute.return_value.data = [{
        "id": "test-user-id",
        "full_name": "Test User",
        "role": "admin",
        "organization_id": "org-123"
    }]
    
    mock_db_instance.table().select().eq().execute.return_value.data = [] # Para venues
    
    # Act
    response = client.get("/me", headers={"Authorization": "Bearer fake-token"})
    
    # Assert
    assert response.status_code == 200
    assert response.json()["id"] == "test-user-id"
```

- [ ] **Step 2: Ejecutar todos los tests**

Run: `pytest backend`

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_endpoints.py
git commit -m "test: integration tests for core endpoints"
```
