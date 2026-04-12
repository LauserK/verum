# Super Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a secure Super Admin Panel for global management of organizations and users with full TDD.

**Architecture:** A dedicated `/super-admin` route in the frontend and `/api/super-admin/` in the backend, protected by a global `is_superadmin` check. Uses Supabase Auth Admin SDK for cross-organization user management.

**Tech Stack:** Next.js 14, FastAPI, Supabase (PostgreSQL, Auth), Pytest.

---

### Phase 1: Database Schema

#### Task 1: Add is_superadmin and is_active columns

**Files:**
- Create: `backend/migrations/026_super_admin_fields.sql`

- [ ] **Step 1: Write migration SQL**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_superadmin boolean DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
```

- [ ] **Step 2: Apply migration**
Run: `psql $DATABASE_URL -f backend/migrations/026_super_admin_fields.sql` (or via Supabase dashboard)

- [ ] **Step 3: Commit**
```bash
git add backend/migrations/026_super_admin_fields.sql
git commit -m "db: add super_admin and organization activity fields"
```

---

### Phase 2: Backend Security & Infrastructure

#### Task 2: Implement Super Admin Dependency

**Files:**
- Modify: `backend/permissions.py`
- Test: `backend/tests/test_super_admin_security.py`

- [ ] **Step 1: Write failing test for super admin dependency**
```python
from fastapi import HTTPException
import pytest
from permissions import get_super_admin

def test_get_super_admin_raises_403_for_normal_user():
    user = {"id": "123", "is_superadmin": False}
    with pytest.raises(HTTPException) as excinfo:
        get_super_admin(user)
    assert excinfo.value.status_code == 403
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest backend/tests/test_super_admin_security.py`

- [ ] **Step 3: Implement `get_super_admin`**
```python
def get_super_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized as Super Admin")
    return current_user
```

- [ ] **Step 4: Verify test passes**

- [ ] **Step 5: Commit**
```bash
git add backend/permissions.py backend/tests/test_super_admin_security.py
git commit -m "feat: add super admin security dependency"
```

---

### Phase 3: Dashboard & Stats API

#### Task 3: Global Stats Endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/schemas.py`

- [ ] **Step 1: Define Stats Schema**
```python
class GlobalStats(BaseModel):
    total_organizations: int
    active_organizations: int
    total_users: int
```

- [ ] **Step 2: Implement GET /api/super-admin/stats**
```python
@app.get("/api/super-admin/stats", response_model=GlobalStats)
async def get_global_stats(admin=Depends(get_super_admin)):
    # Query organizations and profiles counts
    return {"total_organizations": orgs, "active_organizations": active, "total_users": users}
```

---

### Phase 4: Organization Management API

#### Task 4: Organization CRUD

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Implement GET /api/super-admin/organizations**
List all orgs with `is_active` status.

- [ ] **Step 2: Implement POST /api/super-admin/organizations**
Create org + initial admin profile.

- [ ] **Step 3: Implement PATCH /api/super-admin/organizations/{id}**
Toggle `is_active` or update name.

---

### Phase 5: User Management API (Multi-Tenant)

#### Task 5: Global User Management

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Implement GET /api/super-admin/users**
Return all users with their primary org and multi-tenant list.

- [ ] **Step 2: Implement POST /api/super-admin/users**
Use `supabase.auth.admin.create_user` to create user across organizations.

- [ ] **Step 3: Implement PUT /api/super-admin/users/{id}/organizations**
Sync `profile_organizations` and `profile_venues`.

---

### Phase 6: Frontend - Route Protection & Layout

#### Task 6: Super Admin Layout and Middleware

**Files:**
- Create: `frontend/src/app/super-admin/layout.tsx`
- Create: `frontend/src/app/super-admin/page.tsx`
- Modify: `frontend/src/middleware.ts`

- [ ] **Step 1: Update middleware to protect /super-admin**
Check `is_superadmin` claim or fetch profile.

- [ ] **Step 2: Create Super Admin Sidebar/Navigation**
Distinctive color (Indigo) for global context.

---

### Phase 7: Frontend - Management UI

#### Task 7: Organizations & Users Tables

**Files:**
- Create: `frontend/src/app/super-admin/organizations/page.tsx`
- Create: `frontend/src/app/super-admin/users/page.tsx`

- [ ] **Step 1: Implement Organizations Table with Toggle**
- [ ] **Step 2: Implement Users Table with Multi-Org Selector**

---

### Phase 8: Organization Deactivation Logic (Final)

#### Task 8: Deactivation Popup

**Files:**
- Modify: `frontend/src/app/layout.tsx` (or auth wrapper)
- Modify: `backend/main.py` (auth sync)

- [ ] **Step 1: Backend check during login/sync**
Include `organization_is_active` in the sync response.

- [ ] **Step 2: Frontend modal**
If `organization_is_active` is false, block UI with "Contact Support" message.
