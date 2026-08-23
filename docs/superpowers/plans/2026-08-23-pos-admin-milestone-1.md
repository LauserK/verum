# POS Admin Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the database migrations, backend API endpoints, and admin UI for managing Floor Plans (zones and tables) and Workstation sales modes in VERUM.

**Architecture:**
- **Database:** Supabase PostgreSQL migration `070_pos_floor_plans.sql` creating `floor_plans` and `tables` tables, plus adding `allowed_modes` to `workstations`.
- **Backend (FastAPI):** Add Pydantic schemas in `app/sales/schemas.py`, business logic in `app/sales/service.py`, and endpoints in `app/sales/router.py` with pytest test coverage in `tests/test_sales_floor_plans.py`.
- **Frontend (Next.js):** Add API calls to `lib/api/sales.ts`, React Query hooks in `hooks/useSales.ts`, and an interactive visual Floor Plan Builder in `app/admin/sales/floor-plans/page.tsx`.

**Tech Stack:** Supabase (PostgreSQL 15), Python 3.11 (FastAPI, Pytest), Next.js 16 (React 19, Tailwind CSS v4, Lucide Icons, `@dnd-kit`, `@tanstack/react-query`).

---

### Task 1: Supabase Migration for Floor Plans, Tables & Workstations

**Files:**
- Create: `backend/migrations/070_pos_floor_plans.sql`

- [ ] **Step 1: Write SQL migration file**

```sql
-- backend/migrations/070_pos_floor_plans.sql

-- 1. Floor Plans (Zones)
CREATE TABLE IF NOT EXISTS public.floor_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    width INTEGER DEFAULT 800,
    height INTEGER DEFAULT 600,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_floor_plans_venue ON public.floor_plans(venue_id);

-- 2. Tables within Floor Plans
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    shape TEXT CHECK (shape IN ('rectangle', 'circle')) DEFAULT 'rectangle',
    x INTEGER NOT NULL DEFAULT 0,
    y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 60,
    height INTEGER NOT NULL DEFAULT 60,
    capacity INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tables_plan ON public.tables(floor_plan_id, is_active);

-- 3. Add allowed_modes to workstations
ALTER TABLE public.workstations
ADD COLUMN IF NOT EXISTS allowed_modes TEXT[] DEFAULT ARRAY['dine_in', 'takeout', 'delivery', 'pickup', 'bar']::TEXT[];

-- 4. RLS Security Setup
ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY['floor_plans', 'tables'];
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Org members full access" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Org members full access" ON public.%I '
            'FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
        );
    END LOOP;
END $$;
```

- [ ] **Step 2: Commit**

```bash
git add backend/migrations/070_pos_floor_plans.sql
git commit -m "feat(db): add floor_plans, tables, and workstation allowed_modes migration"
```

---

### Task 2: Backend Schemas, Service & API Endpoints for Floor Plans

**Files:**
- Create: `backend/tests/test_sales_floor_plans.py`
- Modify: `backend/app/sales/schemas.py`
- Modify: `backend/app/sales/service.py`
- Modify: `backend/app/sales/router.py`

- [ ] **Step 1: Write failing tests for Floor Plans and Tables endpoints**

Create `backend/tests/test_sales_floor_plans.py`:
```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

MOCK_ORG_ID = "00000000-0000-0000-0000-000000000001"
MOCK_VENUE_ID = "00000000-0000-0000-0000-000000000002"
MOCK_AUTH_HEADERS = {"Authorization": "Bearer mock-token"}

@pytest.fixture
def mock_sales_permissions():
    with patch("permissions.resolve_permission", return_value=True), \
         patch("app.deps.get_active_org_id", return_value=MOCK_ORG_ID), \
         patch("auth_deps.get_current_user", return_value={"id": "user-1", "email": "test@verum.com"}):
        yield

def test_create_and_list_floor_plans(mock_sales_permissions):
    mock_plan = {
        "id": "plan-1",
        "org_id": MOCK_ORG_ID,
        "venue_id": MOCK_VENUE_ID,
        "name": "Terraza",
        "width": 800,
        "height": 600,
        "tables": []
    }
    with patch("app.sales.service.list_floor_plans", new_callable=AsyncMock) as mock_list, \
         patch("app.sales.service.create_floor_plan", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = mock_plan
        mock_list.return_value = [mock_plan]

        create_res = client.post(
            "/sales/floor-plans",
            json={"venue_id": MOCK_VENUE_ID, "name": "Terraza", "width": 800, "height": 600},
            headers=MOCK_AUTH_HEADERS
        )
        assert create_res.status_code == 200
        assert create_res.json()["name"] == "Terraza"

        list_res = client.get("/sales/floor-plans", headers=MOCK_AUTH_HEADERS)
        assert list_res.status_code == 200
        assert len(list_res.json()) == 1
        assert list_res.json()[0]["id"] == "plan-1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_sales_floor_plans.py -v`
Expected: FAIL (404 or missing endpoints/schemas)

- [ ] **Step 3: Implement Schemas in `backend/app/sales/schemas.py`**

Add:
```python
class TableBase(BaseModel):
    name: str
    shape: str = "rectangle"
    x: int = 0
    y: int = 0
    width: int = 60
    height: int = 60
    capacity: int = 2
    is_active: bool = True

class TableCreate(TableBase):
    pass

class TableUpdate(BaseModel):
    name: Optional[str] = None
    shape: Optional[str] = None
    x: Optional[int] = None
    y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None

class TableOut(TableBase):
    id: UUID
    floor_plan_id: UUID
    created_at: datetime

class FloorPlanBase(BaseModel):
    name: str
    venue_id: UUID
    width: int = 800
    height: int = 600

class FloorPlanCreate(FloorPlanBase):
    pass

class FloorPlanUpdate(BaseModel):
    name: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None

class FloorPlanOut(FloorPlanBase):
    id: UUID
    org_id: UUID
    created_at: datetime
    updated_at: datetime
    tables: List[TableOut] = []
```

- [ ] **Step 4: Implement Service logic in `backend/app/sales/service.py`**

Add functions for:
- `list_floor_plans(org_id, venue_id, db)`
- `create_floor_plan(org_id, payload, db)`
- `update_floor_plan(org_id, plan_id, payload, db)`
- `delete_floor_plan(org_id, plan_id, db)`
- `create_table(org_id, plan_id, payload, db)`
- `update_table(org_id, table_id, payload, db)`
- `delete_table(org_id, table_id, db)`

- [ ] **Step 5: Implement Router endpoints in `backend/app/sales/router.py`**

Add endpoints for:
- `GET /sales/floor-plans`
- `POST /sales/floor-plans`
- `PATCH /sales/floor-plans/{plan_id}`
- `DELETE /sales/floor-plans/{plan_id}`
- `POST /sales/floor-plans/{plan_id}/tables`
- `PATCH /sales/tables/{table_id}`
- `DELETE /sales/tables/{table_id}`

- [ ] **Step 6: Run tests and verify they pass**

Run: `pytest backend/tests/test_sales_floor_plans.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/sales/schemas.py backend/app/sales/service.py backend/app/sales/router.py backend/tests/test_sales_floor_plans.py
git commit -m "feat(api): add floor plans and tables endpoints"
```

---

### Task 3: Frontend API Client & React Query Hooks for Floor Plans

**Files:**
- Modify: `frontend/src/lib/api/sales.ts`
- Modify: `frontend/src/hooks/useSales.ts`

- [ ] **Step 1: Add types and API functions to `frontend/src/lib/api/sales.ts`**

```typescript
export interface TableItem {
    id: string
    floor_plan_id: string
    name: string
    shape: 'rectangle' | 'circle'
    x: number
    y: number
    width: number
    height: number
    capacity: number
    is_active: boolean
    created_at?: string
}

export interface FloorPlan {
    id: string
    org_id?: string
    venue_id: string
    name: string
    width: number
    height: number
    tables?: TableItem[]
    created_at?: string
    updated_at?: string
}
```
Add to `salesApi`:
- `getFloorPlans(venueId?: string)`
- `createFloorPlan(data: Partial<FloorPlan>)`
- `updateFloorPlan(id: string, data: Partial<FloorPlan>)`
- `deleteFloorPlan(id: string)`
- `createTable(planId: string, data: Partial<TableItem>)`
- `updateTable(tableId: string, data: Partial<TableItem>)`
- `deleteTable(tableId: string)`

- [ ] **Step 2: Add hooks to `frontend/src/hooks/useSales.ts`**

- `useFloorPlans(venueId?: string)`
- `useCreateFloorPlan()`
- `useUpdateFloorPlan()`
- `useDeleteFloorPlan()`
- `useCreateTable()`
- `useUpdateTable()`
- `useDeleteTable()`

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd frontend && npm run build` (or check types)
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api/sales.ts frontend/src/hooks/useSales.ts
git commit -m "feat(frontend): add sales floor plans api client and hooks"
```

---

### Task 4: Interactive Admin Floor Plan Builder Page

**Files:**
- Create: `frontend/src/app/admin/sales/floor-plans/page.tsx`
- Modify: `frontend/src/app/admin/sales/page.tsx` (add navigation card/link)

- [ ] **Step 1: Create Floor Plan Builder Page with Zones and Draggable Tables**

Implement `frontend/src/app/admin/sales/floor-plans/page.tsx`:
- List and switch between Floor Plan Zones (e.g. Salón Principal, Terraza, Barra).
- Modal to create / rename zones.
- Interactive canvas where tables can be added, positioned (dragged), resized, assigned shape (rectangle/circle), and given seat capacity.
- Save positions with `useUpdateTable`.

- [ ] **Step 2: Add Floor Plans link to `frontend/src/app/admin/sales/page.tsx`**

- [ ] **Step 3: Verify frontend build and linting**

Run: `cd frontend && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/sales/floor-plans/page.tsx frontend/src/app/admin/sales/page.tsx
git commit -m "feat(ui): add visual floor plan builder in sales admin"
```
