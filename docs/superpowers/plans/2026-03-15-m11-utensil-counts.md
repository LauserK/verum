# Milestone 11 Plan: Utensil Counts & Inventory Movements

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full operational flow for utensils, including physical counts (INV-U-2), supervisor auditing (INV-U-3), and real-time movements (Income, Exit, Transfers).

**Architecture:**
- **Database (Supabase SQL):** Tables for `utensil_counts`, `utensil_count_items`, and `utensil_movements`.
- **Backend (FastAPI):** Endpoints for submitting counts, recording movements, and performing transfers.
- **Frontend (Admin/Staff):** UI for recording entries/exits/transfers and the mobile counting interface.

---

## Chunk 1: Database Foundation (Counts & Movements)

### Task 1: Create Database Migration
Set up tables for both periodic counts and real-time transactions.

- [ ] **Step 1: Write migration SQL**
  - Create `backend/migrations/016_utensil_ops.sql`.
  - Tables: `utensil_counts`, `utensil_count_items`, `utensil_movements`.

```sql
-- periodic counts
create table if not exists utensil_counts (
  id            uuid default uuid_generate_v4() primary key,
  venue_id      uuid references venues(id) on delete cascade,
  created_by    uuid references profiles(id),
  status        text check (status in ('pending', 'confirmed')) default 'pending',
  created_at    timestamp with time zone default now(),
  confirmed_at  timestamp with time zone,
  confirmed_by  uuid references profiles(id)
);

create table if not exists utensil_count_items (
  count_id      uuid references utensil_counts(id) on delete cascade,
  utensil_id    uuid references utensils(id) on delete cascade,
  initial_count integer not null,
  confirmed_count integer,
  primary key (count_id, utensil_id)
);

-- real-time movements (Income, Exit, Transfers)
create table if not exists utensil_movements (
  id            uuid default uuid_generate_v4() primary key,
  org_id        uuid references organizations(id) on delete cascade,
  utensil_id    uuid references utensils(id) on delete cascade,
  from_venue_id uuid references venues(id) on delete set null,
  to_venue_id   uuid references venues(id) on delete set null,
  quantity      integer not null,
  type          text check (type in ('entry', 'exit', 'transfer', 'adjustment')),
  created_by    uuid references profiles(id),
  created_at    timestamp with time zone default now(),
  notes         text
);
```

- [ ] **Step 2: Commit**
  ```bash
  git add backend/migrations/016_utensil_ops.sql
  git commit -m "feat(db): add schema for utensil counts and movements (M11)"
  ```

---

## Chunk 2: Backend API Development

### Task 2: Implement Count and Movement Endpoints
Add logic to manage counts and log inventory transactions.

- [ ] **Step 1: Add Pydantic Models**
  - `UtensilMovementRequest`, `UtensilCountRequest`.
- [ ] **Step 2: Implement Movements API**
  - `POST /utensil-movements`: Handle logic for entry, exit, and transfers.
- [ ] **Step 3: Implement Counts API**
  - `POST /utensil-counts`, `PATCH /utensil-counts/{id}/confirm`.
- [ ] **Step 4: Commit**
  ```bash
  git add backend/main.py
  git commit -m "feat(api): add utensil movements and counts endpoints (M11)"
  ```

---

## Chunk 3: Frontend - Inventory Movements UI

### Task 3: Implement Entries, Exits, and Transfers
Create the interface for real-time inventory adjustments.

- [ ] **Step 1: Create Movement Modal**
  - Add "Record Movement" button to `UtensilsPage`.
  - Form fields: Type (Income/Exit/Transfer), Quantity, Origin/Destination Venue (for transfers), Notes.
- [ ] **Step 2: Integrate with adminApi**
  - Create `adminApi.recordUtensilMovement`.
- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/app/admin/inventory/utensils/
  git commit -m "feat(ui): implement utensil movement recording (M11)"
  ```

---

## Chunk 4: Frontend - Counting & Auditing

### Task 4: Implement Count Flow
Create the staff counting interface and supervisor audit dashboard.

- [ ] **Step 1: Create Mobile Counting Interface**
  - `/inventory/utensils/count`.
- [ ] **Step 2: Create Audit Detail View**
  - `/admin/inventory/utensils/counts/[id]`.
- [ ] **Step 3: Update Navigation**
  - Add "Movimientos" and "Historial de Conteos" to inventory submenu.
- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/app/admin/inventory/utensils/
  git commit -m "feat(ui): implement counting and auditing screens (M11)"
  ```

---
*End of Plan*
