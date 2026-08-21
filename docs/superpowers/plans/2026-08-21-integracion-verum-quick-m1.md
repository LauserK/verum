# Integración Verum-Quick Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure HMAC secrets on both ends, ensure the base category exists in VerumQuick, and create the integration user/workstation in VERUM.

**Architecture:** We are creating a setup script on the VERUM side (FastAPI) and a Django management command on the VerumQuick side. Environment variables will hold the shared HMAC secret for future communication.

**Tech Stack:** FastAPI, Supabase, Django, Python.

---

### Task 1: Add HMAC Secret Config to VerumQuick

**Files:**
- Modify: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\core\settings.py`

- [ ] **Step 1: Add VERUM_INTEGRATION_HMAC_SECRET to settings.py**

Modify `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\core\settings.py` to read the HMAC secret from environment variables. Find the `SECRET_KEY` definition and add `VERUM_INTEGRATION_HMAC_SECRET` right after it.

```python
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key-change-me')
VERUM_INTEGRATION_HMAC_SECRET = os.getenv('VERUM_INTEGRATION_HMAC_SECRET', 'dev-hmac-secret-change-me')
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\dmj-travel\proyectos\VerumOnlineOrdering
git add core/settings.py
git commit -m "feat(integration): add VERUM_INTEGRATION_HMAC_SECRET setting"
```

### Task 2: Add HMAC Secret Config to VERUM

**Files:**
- Modify: `C:\Users\dmj-travel\proyectos\verum\backend\config.py`

- [ ] **Step 1: Add VERUM_QUICK_HMAC_SECRET to config.py**

Modify `C:\Users\dmj-travel\proyectos\verum\backend\config.py` to add the integration secret to the `Settings` class.

```python
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    REDIS_URL: Optional[str] = None
    VERUM_QUICK_HMAC_SECRET: str = "dev-hmac-secret-change-me"
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

settings = Settings()
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\dmj-travel\proyectos\verum
git add backend/config.py
git commit -m "feat(integration): add VERUM_QUICK_HMAC_SECRET config"
```

### Task 3: Base Category Initialization Command in VerumQuick

**Files:**
- Create: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\catalog\management\__init__.py`
- Create: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\catalog\management\commands\__init__.py`
- Create: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\catalog\management\commands\init_verum_integration.py`

- [ ] **Step 1: Create directories and __init__.py files**

```bash
cd C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\catalog
mkdir management\commands
type nul > management\__init__.py
type nul > management\commands\__init__.py
```

- [ ] **Step 2: Create the Django management command**

Create `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\catalog\management\commands\init_verum_integration.py` with the following content:

```python
from django.core.management.base import BaseCommand
from apps.tenancy.models import Company
from apps.catalog.models import Category

class Command(BaseCommand):
    help = 'Initializes the base category for VERUM integration.'

    def add_arguments(self, parser):
        parser.add_argument('company_id', type=int, help='The ID of the Company to initialize')

    def handle(self, *args, **options):
        company_id = options['company_id']
        
        try:
            company = Company.objects.get(id=company_id)
        except Company.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Company with ID {company_id} does not exist.'))
            return

        category_name = 'Importados de VERUM'
        category, created = Category.objects.get_or_create(
            company=company,
            name=category_name,
            defaults={
                'is_active': True,
                'position': 9999,
            }
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f'Successfully created base category "{category_name}" for Company ID {company_id}.'))
        else:
            self.stdout.write(self.style.WARNING(f'Base category "{category_name}" already exists for Company ID {company_id}.'))
```

- [ ] **Step 3: Test the command**

```bash
cd C:\Users\dmj-travel\proyectos\VerumOnlineOrdering
python manage.py help init_verum_integration
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\dmj-travel\proyectos\VerumOnlineOrdering
git add apps/catalog/management
git commit -m "feat(catalog): add init_verum_integration management command"
```

### Task 4: Initialization Script in VERUM

**Files:**
- Create: `C:\Users\dmj-travel\proyectos\verum\backend\scripts\init_quick_integration.py`

- [ ] **Step 1: Create the initialization script**

Create `C:\Users\dmj-travel\proyectos\verum\backend\scripts\init_quick_integration.py` with the following content:

```python
import sys
import os
import uuid

# Append backend directory to path to import database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import get_db

def init_integration(org_id: str):
    db = get_db()
    
    # 1. Create or get the Integration User
    user_email = "quick@verum.local"
    full_name = "VerumQuick System"
    
    res_user = db.table("profiles").select("id").eq("org_id", org_id).eq("email", user_email).execute()
    if res_user.data:
        user_id = res_user.data[0]["id"]
        print(f"User '{full_name}' already exists with ID: {user_id}")
    else:
        user_id = str(uuid.uuid4())
        db.table("profiles").insert({
            "id": user_id,
            "org_id": org_id,
            "email": user_email,
            "full_name": full_name,
            "role": "system"
        }).execute()
        print(f"Created user '{full_name}' with ID: {user_id}")

    # 2. Create or get the Virtual Workstation
    ws_name = "VerumQuick POS"
    res_ws = db.table("workstations").select("id").eq("org_id", org_id).eq("name", ws_name).execute()
    if res_ws.data:
        ws_id = res_ws.data[0]["id"]
        print(f"Workstation '{ws_name}' already exists with ID: {ws_id}")
    else:
        ws_id = str(uuid.uuid4())
        db.table("workstations").insert({
            "id": ws_id,
            "org_id": org_id,
            "name": ws_name,
            "is_active": True
        }).execute()
        print(f"Created workstation '{ws_name}' with ID: {ws_id}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python init_quick_integration.py <org_id>")
        sys.exit(1)
    
    target_org_id = sys.argv[1]
    init_integration(target_org_id)
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\dmj-travel\proyectos\verum
git add backend/scripts/init_quick_integration.py
git commit -m "feat(integration): add init_quick_integration script"
```
