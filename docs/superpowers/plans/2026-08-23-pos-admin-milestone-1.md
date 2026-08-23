# POS Admin Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the foundational database schemas, API routes, and admin UI for managing the POS Floor Plans (Tables/Zones), Workstations configurations, and Payment Methods.

**Architecture:**
- **Database:** Raw SQL migrations for `floor_plans` and `tables` adding them to Supabase PostgreSQL.
- **Backend:** Python FastAPI for admin endpoints serving Floor Plans and Payment Methods.
- **Frontend:** Next.js App Router for Admin UI using `@tanstack/react-query` to fetch from the backend API.

**Tech Stack:** Supabase (SQL), Python (FastAPI/pytest), Next.js (React/Tailwind), `@dnd-kit`, `@tanstack/react-query`

---

### Task 1: Supabase Migrations for Floor Plans and Tables

**Files:**
- Create: `backend/migrations/070_pos_floor_plans.sql`
- Modify: `backend/tests/test_pos_admin_db.py`

- [ ] **Step 1: Write the failing test for DB schema**

```python
# backend/tests/test_pos_admin_db.py
import pytest
from database import supabase
from conftest import MOCK_ORG_ID, MOCK_VENUE_ID

def test_insert_floor_plan_and_table():
    plan_resp = supabase.table("floor_plans").insert({
        "org_id": MOCK_ORG_ID,
        "venue_id": MOCK_VENUE_ID,
        "name": "Main Hall",
        "width": 800,
        "height": 600
    }).execute()
    
    assert len(plan_resp.data) == 1
    plan_id = plan_resp.data[0]["id"]
    
    table_resp = supabase.table("tables").insert({
        "floor_plan_id": plan_id,
        "name": "Mesa 1",
        "shape": "rectangle",
        "x": 100,
        "y": 100,
        "width": 60,
        "height": 60,
        "capacity": 4
    }).execute()
    
    assert len(table_resp.data) == 1
    
    # Cleanup
    supabase.table("tables").delete().eq("id", table_resp.data[0]["id"]).execute()
    supabase.table("floor_plans").delete().eq("id", plan_id).execute()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_pos_admin_db.py -v`
Expected: FAIL with Relation "floor_plans" does not exist

- [ ] **Step 3: Write the SQL migration**

```sql
-- backend/migrations/070_pos_floor_plans.sql

-- 1. Floor Plans
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

-- 2. Tables
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

-- 3. RLS Policies
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

- [ ] **Step 4: Apply migration and run test to verify it passes**

Apply the SQL migration to the Supabase database instance.
Run: `cd backend && python -m pytest tests/test_pos_admin_db.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/070_pos_floor_plans.sql backend/tests/test_pos_admin_db.py
git commit -m "feat(db): add floor_plans and tables schema for POS"
```

### Task 2: Backend API - Payment Methods and Floor Plans

**Files:**
- Create: `backend/app/sales/router.py`
- Modify: `backend/main.py`
- Modify: `backend/tests/test_pos_admin_api.py`

- [ ] **Step 1: Write the failing API test**

```python
# backend/tests/test_pos_admin_api.py
import pytest
from fastapi.testclient import TestClient
from main import app
from conftest import MOCK_AUTH_HEADERS, MOCK_ORG_ID

client = TestClient(app)

def test_get_payment_methods():
    response = client.get("/api/sales/payment-methods", headers=MOCK_AUTH_HEADERS)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_floor_plans():
    response = client.get("/api/sales/floor-plans", headers=MOCK_AUTH_HEADERS)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_pos_admin_api.py -v`
Expected: FAIL with 404 Not Found

- [ ] **Step 3: Write the API router and models**

```python
# backend/app/sales/router.py
from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from auth_deps import get_current_user
from database import supabase
from app.deps import get_active_org_id

router = APIRouter(tags=["Sales Config"])

@router.get("/payment-methods")
def list_payment_methods(
    org_id: str = Depends(get_active_org_id),
    user=Depends(get_current_user)
) -> List[Dict[str, Any]]:
    resp = supabase.table("payment_methods").select("*").eq("org_id", org_id).order("position").execute()
    return resp.data

@router.get("/floor-plans")
def list_floor_plans(
    org_id: str = Depends(get_active_org_id),
    user=Depends(get_current_user)
) -> List[Dict[str, Any]]:
    resp = supabase.table("floor_plans").select("*").eq("org_id", org_id).execute()
    return resp.data
```

```python
# Add to backend/main.py around line 46
from app.sales.router import router as sales_router
app.include_router(sales_router, prefix="/api/sales", tags=["Sales"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_pos_admin_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/sales/router.py backend/main.py backend/tests/test_pos_admin_api.py
git commit -m "feat(api): add pos admin endpoints for payment methods and floor plans"
```

### Task 3: Admin UI - Payment Methods Page

**Files:**
- Create: `frontend/src/app/[locale]/(app)/admin/pos/payment-methods/page.tsx`

- [ ] **Step 1: Write the UI Component using backend API**

```tsx
// frontend/src/app/[locale]/(app)/admin/pos/payment-methods/page.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react'; // Assuming standard auth

export default function PaymentMethodsPage() {
  const { data: session } = useSession();

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await fetch('/api/sales/payment-methods', {
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
          'x-org-id': session?.orgId || ''
        }
      });
      if (!res.ok) throw new Error('Failed to fetch payment methods');
      return res.json();
    },
    enabled: !!session?.accessToken
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Métodos de Pago</h1>
      {isLoading ? <p>Cargando...</p> : (
        <div className="bg-white rounded shadow">
          {methods.length === 0 && <p className="p-4">No hay métodos de pago configurados.</p>}
          {methods.map((m: any) => (
            <div key={m.id} className="border-b p-4 flex justify-between">
              <div>
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-gray-500">{m.method_type} - {m.currency_code}</p>
              </div>
              <div>{m.is_active ? 'Activo' : 'Inactivo'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the UI compiles**

Run: `cd frontend && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/[locale]/\(app\)/admin/pos/payment-methods/page.tsx
git commit -m "feat(ui): add payment methods admin page via api"
```

### Task 4: Admin UI - Floor Plan Builder

**Files:**
- Create: `frontend/src/app/[locale]/(app)/admin/pos/floor-plans/page.tsx`

- [ ] **Step 1: Write the basic Floor Plan Builder Component via API**

```tsx
// frontend/src/app/[locale]/(app)/admin/pos/floor-plans/page.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

export default function FloorPlansPage() {
  const { data: session } = useSession();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['floor-plans'],
    queryFn: async () => {
      const res = await fetch('/api/sales/floor-plans', {
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
          'x-org-id': session?.orgId || ''
        }
      });
      if (!res.ok) throw new Error('Failed to fetch floor plans');
      return res.json();
    },
    enabled: !!session?.accessToken
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Planos de Planta</h1>
      {isLoading ? <p>Cargando...</p> : (
        <div className="grid grid-cols-3 gap-4">
          {plans.map((p: any) => (
            <div key={p.id} className="border p-4 rounded shadow bg-white cursor-pointer hover:bg-gray-50">
              <h2 className="font-semibold">{p.name}</h2>
              <p className="text-sm text-gray-500">{p.width}x{p.height}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the UI compiles**

Run: `cd frontend && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/[locale]/\(app\)/admin/pos/floor-plans/page.tsx
git commit -m "feat(ui): add floor plans admin list via api"
```
