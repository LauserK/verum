# M17-PRD Movimientos de Stock y Kardex PEPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core inventory movement engine using PEPS (First-In, First-Out) logic, allowing registration of purchases (entry), issues (exit), and tracking the history through a Kardex.

**Architecture:** Introduction of `stock_lots` for cost tracking and `stock_movements` for audit logs. The backend will implement a FIFO consumption algorithm for exits.

**Tech Stack:** FastAPI, Supabase (PostgreSQL), Next.js, Lucide Icons.

---

### Task 1: Database Schema (Lots & Movements)

**Files:**
- Create: `backend/migrations/030_stock_movements_peps.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/migrations/030_stock_movements_peps.sql

-- Lotes de inventario (para PEPS/FIFO y trazabilidad)
create table if not exists stock_lots (
  id              uuid default uuid_generate_v4() primary key,
  warehouse_id    uuid references warehouses(id) on delete cascade,
  item_id         uuid references items(id) on delete cascade,
  lot_number      text,
  qty_base        numeric(18, 6) not null,
  unit_cost_base  numeric(18, 6) not null,
  production_date date,
  expiry_date     date,
  received_at     timestamp with time zone default now(),
  is_exhausted    boolean default false
);

create index if not exists idx_stock_lots_fifo on stock_lots(item_id, warehouse_id, received_at) where not is_exhausted;

-- Kardex de movimientos
create table if not exists stock_movements (
  id                  uuid default uuid_generate_v4() primary key,
  org_id              uuid references organizations(id) on delete cascade,
  movement_type       text check (movement_type in (
    'purchase', 'production_in', 'production_out', 'sale', 'transfer_out', 'transfer_in', 'adjustment_in', 'adjustment_out', 'initial'
  )),
  warehouse_id        uuid references warehouses(id) on delete cascade,
  item_id             uuid references items(id) on delete cascade,
  lot_id              uuid references stock_lots(id) on delete set null,
  qty_base            numeric(18, 6) not null,
  unit_cost_base      numeric(18, 6),
  total_cost          numeric(18, 6),
  reference_id        uuid,
  reference_type      text,
  notes               text,
  created_by          uuid references profiles(id),
  created_at          timestamp with time zone default now()
);

-- Documentos de Ingreso (Compras)
create table if not exists purchase_receipts (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  warehouse_id    uuid references warehouses(id) on delete cascade,
  supplier        text,
  receipt_number  text,
  status          text check (status in ('draft', 'confirmed')) default 'draft',
  created_by      uuid references profiles(id),
  confirmed_at    timestamp with time zone,
  created_at      timestamp with time zone default now()
);

create table if not exists purchase_receipt_lines (
  id              uuid default uuid_generate_v4() primary key,
  receipt_id      uuid references purchase_receipts(id) on delete cascade,
  item_id         uuid references items(id) on delete cascade,
  qty_base        numeric(18, 6) not null,
  presentation_id uuid references uom_presentations(id),
  qty_presentation numeric(18, 6),
  unit_cost_base  numeric(18, 6) not null,
  expiry_date     date,
  lot_number      text
);
```

- [ ] **Step 2: Commit**
```bash
git add backend/migrations/030_stock_movements_peps.sql
git commit -m "feat(db): add schema for stock lots and movements (M17)"
```

---

### Task 2: Backend Schemas (Pydantic Models)

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Add movement and receipt schemas**

```python
# Add at the end of backend/schemas.py

class StockMovementResponse(BaseModel):
    id: UUID
    movement_type: str
    warehouse_id: UUID
    item_id: UUID
    qty_base: float
    unit_cost_base: Optional[float]
    total_cost: Optional[float]
    created_at: datetime

class PurchaseReceiptLineCreate(BaseModel):
    item_id: UUID
    qty_presentation: float
    presentation_id: UUID
    unit_cost_presentation: float # Cost per presentation unit
    expiry_date: Optional[str] = None
    lot_number: Optional[str] = None

class PurchaseReceiptCreate(BaseModel):
    warehouse_id: UUID
    supplier: Optional[str] = None
    receipt_number: Optional[str] = None
    lines: List[PurchaseReceiptLineCreate]

class PurchaseReceiptResponse(BaseModel):
    id: UUID
    status: str
    warehouse_id: UUID
    created_at: datetime
```

- [ ] **Step 2: Commit**
```bash
git add backend/schemas.py
git commit -m "feat(backend): add schemas for stock movements and receipts"
```

---

### Task 3: Backend PEPS Engine & Endpoints

**Files:**
- Modify: `backend/main.py`
- Create: `backend/tests/test_peps_logic.py`

- [ ] **Step 1: Write TDD test for FIFO consumption**

```python
# Create backend/tests/test_peps_logic.py
import pytest
from unittest.mock import MagicMock, patch
import uuid

def test_fifo_consumption_logic():
    # This is a conceptual test for the logic we'll implement in the endpoint
    # We will simulate having 2 lots and consuming a quantity that spans both
    pass # To be implemented during execution
```

- [ ] **Step 2: Implement Purchase Receipt confirmation**
Update `backend/main.py` to handle `/inventory/purchase-receipts`. Upon confirmation, it must create `stock_lots`, update `stock.qty_base`, and log to `stock_movements`.

- [ ] **Step 3: Implement Issue Documents (PEPS)**
Implement a FIFO algorithm:
1. Find oldest non-exhausted lots.
2. Consume until requested quantity is met.
3. Update each lot's `qty_base`.
4. Log each consumption as a movement.

- [ ] **Step 4: Implement Kardex endpoint**
`GET /inventory/kardex?item_id=&warehouse_id=`

- [ ] **Step 5: Run tests**
`pytest backend/tests/test_peps_logic.py`

- [ ] **Step 6: Commit**
```bash
git add backend/main.py backend/tests/test_peps_logic.py
git commit -m "feat(backend): implement FIFO stock movement engine"
```

---

### Task 4: Frontend Integration (Kardex & Receipts)

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/admin/inventory/movements/receipts/page.tsx`
- Create: `frontend/src/app/admin/inventory/kardex/page.tsx`

- [ ] **Step 1: Update adminApi**
Add `getKardex`, `createPurchaseReceipt`, `confirmPurchaseReceipt`.

- [ ] **Step 2: Create Purchase Receipt view**
A form to select warehouse, items, quantities, and costs.

- [ ] **Step 3: Create Kardex view**
A table showing history: Date | Type | In | Out | Lot | Balance.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/lib/api.ts frontend/src/app/admin/inventory/
git commit -m "feat(frontend): add Kardex and Purchase Receipts views"
```
