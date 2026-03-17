# Count Schedules Implementation Plan (M11.2)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Inventory Order" system where admins can schedule specific counts (all items, by category, or custom items), assign them to a venue or user, and have them appear as pending tasks for the staff.

**Architecture:**
- **Database (Supabase SQL):** New tables `count_schedules` and `count_schedule_items`. Link existing `utensil_counts` to `count_schedules` to track fulfillment.
- **Backend (FastAPI):** CRUD endpoints for schedules. A special `GET /count-schedules/due` endpoint for the staff to see their assigned tasks.
- **Frontend Admin:** New page `/admin/inventory/utensils/schedules` to create and manage these orders.
- **Frontend Staff:** Update `/inventory/utensils` (or dashboard) to list pending schedules. Clicking one opens the counting interface filtered by the schedule's scope.

---

## Chunk 1: Database Schema for Schedules

### Task 1: Create SQL Migration
Create the tables that define a counting schedule.

**Files:**
- Create: `backend/migrations/017_count_schedules.sql`

- [ ] **Step 1: Write migration SQL**
```sql
create table if not exists count_schedules (
  id            uuid default uuid_generate_v4() primary key,
  org_id        uuid references organizations(id) on delete cascade,
  venue_id      uuid references venues(id),
  assigned_to   uuid references profiles(id), -- If null, anyone in the venue can do it
  name          text not null,
  frequency     text check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'one_time')) not null,
  scope         text check (scope in ('all', 'category', 'custom')) not null,
  category_id   uuid references utensil_categories(id),
  next_due      date not null,
  last_completed_at timestamp with time zone,
  is_active     boolean default true,
  created_by    uuid references profiles(id),
  created_at    timestamp with time zone default now()
);

create table if not exists count_schedule_items (
  schedule_id   uuid references count_schedules(id) on delete cascade,
  item_id       uuid references utensils(id) on delete cascade,
  primary key (schedule_id, item_id)
);

-- Add schedule_id to utensil_counts to link the execution back to the order
alter table utensil_counts add column schedule_id uuid references count_schedules(id) on delete set null;

create index if not exists idx_count_schedules_venue on count_schedules(venue_id);
```

- [ ] **Step 2: Commit**
```bash
git add backend/migrations/017_count_schedules.sql
git commit -m "feat(db): add schema for utensil count schedules (M11.2)"
```

---

## Chunk 2: Backend Endpoints

### Task 2: Implement Schedules API
Add the necessary models and endpoints to `backend/main.py`.

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add Pydantic Models**
```python
class CreateCountScheduleRequest(BaseModel):
    venue_id: str
    assigned_to: Optional[str] = None
    name: str
    frequency: str
    scope: str
    category_id: Optional[str] = None
    next_due: str  # YYYY-MM-DD
    item_ids: Optional[list[str]] = None
```

- [ ] **Step 2: Add Endpoints**
  - `POST /count-schedules`: Creates header and inserts into `count_schedule_items` if scope is 'custom'.
  - `GET /count-schedules`: Lists active schedules for the org/venue.
  - `GET /count-schedules/due`: Returns schedules where `next_due <= today` for the current user's venue/assignment.
- [ ] **Step 3: Update `POST /utensil-counts`**
  - Accept an optional `schedule_id` in `CreateUtensilCountRequest`.
  - When saving the count, if `schedule_id` is present, update the `count_schedules.last_completed_at` and calculate the new `next_due` date (or mark `is_active = false` if `one_time`).

- [ ] **Step 4: Commit**
```bash
git add backend/main.py
git commit -m "feat(api): add endpoints for count schedules (M11.2)"
```

---

## Chunk 3: Admin UI - Schedule Management

### Task 3: Create Schedules Management Page
Build the UI where admins create the "inventory orders".

**Files:**
- Create: `frontend/src/app/admin/inventory/utensils/schedules/page.tsx`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add API methods to frontend**
  - `adminApi.createSchedule(data)`, `adminApi.getSchedules()`
- [ ] **Step 2: Build the UI**
  - Add to the inventory submenu (Lista, Categorías, Historial, **Programación**).
  - List existing schedules.
  - "New Schedule" modal:
    - Name, Frequency (Select), Venue (Select), Assignee (Select User or Any).
    - Scope (Radio: All, Category, Custom).
    - Dynamic fields based on scope (Select category, or multi-select items).
    - Start Date.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/lib/api.ts frontend/src/app/admin/inventory/utensils/schedules/
git commit -m "feat(ui): implement admin schedules management page (M11.2)"
```

---

## Chunk 4: Staff UI - Pending Tasks & Execution

### Task 4: Connect Staff View to Schedules
Update the staff flow so they select an order before counting.

**Files:**
- Create: `frontend/src/app/inventory/utensils/page.tsx`
- Modify: `frontend/src/app/inventory/utensils/count/page.tsx`

- [ ] **Step 1: Create Staff Pending Tasks Page**
  - `frontend/src/app/inventory/utensils/page.tsx`.
  - Calls `GET /count-schedules/due`.
  - Displays a list of cards: "Conteo Semanal Cubertería - Vence hoy".
  - Clicking a card navigates to `/inventory/utensils/count?schedule_id=XYZ`.
- [ ] **Step 2: Update Count Page Logic**
  - Read `schedule_id` from URL search params.
  - Fetch schedule details to know the scope.
  - Filter the `utensils` list to only show items dictated by the schedule's scope (All, specific Category, or specific Item IDs).
  - Include `schedule_id` in the submit payload.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/app/inventory/utensils/
git commit -m "feat(ui): connect staff count flow to assigned schedules (M11.2)"
```

---
*End of Plan*
