# Milestone 10 Plan: Utensil Catalog (Registration and Categories)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the management system for smallwares/utensils (INV-U), including category definitions and item catalog with minimum stock thresholds.

**Architecture:**
- **Database (Supabase SQL):** New tables `utensil_categories` and `utensils`.
- **Backend (FastAPI):** CRUD endpoints for both tables, protected by `inventory_utensils.manage_items` permission.
- **Frontend (Next.js):** Admin views at `/admin/inventory/utensils` and `/admin/inventory/utensils/categories`. Navigation updates to include these in the Inventory submenu.
- **i18n:** Full support for ES/EN.

---

## Chunk 1: Database Foundation

### Task 1: Create Database Migration for Utensils
Create the SQL migration file to set up the utensil management tables.

- [ ] **Step 1: Write migration SQL**
  - Create `backend/migrations/015_inventory_utensils.sql`.
  - Table `utensil_categories`: `id`, `org_id`, `name`, `description`.
  - Table `utensils`: `id`, `org_id`, `category_id`, `name`, `unit` (e.g., 'units', 'packs'), `min_stock`, `is_active`, `created_at`.
  - Add indexes for performance.

```sql
create table if not exists utensil_categories (
  id          uuid default uuid_generate_v4() primary key,
  org_id      uuid references organizations(id) on delete cascade,
  name        text not null,
  description text
);

create table if not exists utensils (
  id          uuid default uuid_generate_v4() primary key,
  org_id      uuid references organizations(id) on delete cascade,
  category_id uuid references utensil_categories(id) on delete set null,
  name        text not null,
  unit        text default 'unidades', -- 'unidades', 'docenas', 'cajas'
  min_stock   integer default 0,
  is_active   boolean default true,
  created_at  timestamp with time zone default now()
);

create index if not exists idx_utensils_org on utensils(org_id);
create index if not exists idx_utensils_category on utensils(category_id);
```

- [ ] **Step 2: Commit**
  ```bash
  git add backend/migrations/015_inventory_utensils.sql
  git commit -m "feat(db): add schema for utensil management (M10)"
  ```

---

## Chunk 2: Backend API Endpoints

### Task 2: Implement Utensil CRUD in FastAPI
Add the necessary models and endpoints to `backend/main.py`.

- [ ] **Step 1: Add Pydantic Models**
  - `CreateUtensilCategoryRequest`, `CreateUtensilRequest`, etc.
- [ ] **Step 2: Implement Endpoints**
  - `GET /utensil-categories`, `POST /utensil-categories`, `PATCH /utensil-categories/{id}`.
  - `GET /utensils`, `POST /utensils`, `PATCH /utensils/{id}`.
  - Protect with `require_permission("inventory_utensils.manage_items")`.
- [ ] **Step 3: Verify syntax**
  ```bash
  python -m py_compile backend/main.py
  ```
- [ ] **Step 4: Commit**
  ```bash
  git add backend/main.py
  git commit -m "feat(api): add utensil and category endpoints (M10)"
  ```

---

## Chunk 3: Frontend Foundations & i18n

### Task 3: Setup i18n and Navigation
Prepare the translations and update the submenu to include Utensils.

- [ ] **Step 1: Add translations**
  - Update `frontend/src/messages/es.json` and `en.json` with `inventory.utensils` namespace.
- [ ] **Step 2: Update Inventory Submenu**
  - Modify `AssetsPage` and `CategoriesPage` headers to include a third link for "Utensilios".
- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/messages/*.json
  git commit -m "feat(i18n): add utensil catalog translations"
  ```

---

## Chunk 4: Frontend Admin UI

### Task 4: Implement Utensil Management Views
Create the management screens for items and categories.

- [ ] **Step 1: Create Utensil Categories Page**
  - `frontend/src/app/admin/inventory/utensils/categories/page.tsx`.
  - List and Create categories (similar to asset categories).
- [ ] **Step 2: Create Utensil Catalog Page**
  - `frontend/src/app/admin/inventory/utensils/page.tsx`.
  - Searchable table of items with status toggles and min_stock indicators.
- [ ] **Step 3: Run Linter**
  ```bash
  npm run lint --prefix frontend
  ```
- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/app/admin/inventory/utensils
  git commit -m "feat(ui): implement utensil management screens (M10)"
  ```

---
*End of Plan*
