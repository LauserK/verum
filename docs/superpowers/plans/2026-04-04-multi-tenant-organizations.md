# Multi-Tenant Organization & Venue Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-tenant user structure into a full multi-tenant SaaS model where users can belong to multiple organizations and select their context upon login.

**Architecture:** 
1. **DB:** Migrate from `profiles.organization_id` to a many-to-many `profile_organizations` table.
2. **Backend:** Update `/me` to return all associated organizations and venues grouped by organization.
3. **Frontend:** Create a two-step selection screen (Organizations -> Venues) after login.
4. **State:** Persist `activeOrgId` and `selectedVenueId` in the application context.

**Tech Stack:** FastAPI, Supabase (PostgreSQL), React (Next.js), Tailwind CSS.

---

### Task 1: Database Migration - Many-to-Many Organizations

**Files:**
- Create: `backend/migrations/025_multi_tenant_organizations.sql`

- [ ] **Step 1: Create the migration script**
Create a new migration to introduce `profile_organizations` and move existing data.

```sql
-- Create join table for Users and Organizations
CREATE TABLE IF NOT EXISTS profile_organizations (
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    role_id uuid REFERENCES custom_roles(id) ON DELETE SET NULL, -- Optional: role per org
    is_default boolean default false,
    created_at timestamp with time zone default now(),
    PRIMARY KEY (profile_id, organization_id)
);

-- Migrate existing data from profiles.organization_id
INSERT INTO profile_organizations (profile_id, organization_id, is_default)
SELECT id, organization_id, true FROM profiles 
WHERE organization_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Note: We keep profiles.organization_id for now to avoid breaking existing queries, 
-- but it will be deprecated in favor of the join table.
```

- [ ] **Step 2: Apply the migration**
Run the SQL in Supabase dashboard or via CLI.

---

### Task 2: Backend - Update Profile Endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/schemas.py`

- [ ] **Step 1: Update ProfileResponse schema**
Include an array of organizations, each with its name and associated venues.

- [ ] **Step 2: Update `get_profile` endpoint**
Fetch all organizations the user belongs to via `profile_organizations`.
Fetch all venues the user has access to via `profile_venues`.
Group venues by organization in the response.

```python
# Logic pseudo-code for get_profile:
# 1. Fetch profile_organizations -> list of org_ids
# 2. Fetch profile_venues -> list of venue_ids
# 3. Fetch venues with their org_id
# 4. Construct a response like:
# {
#   "id": "...",
#   "organizations": [
#     { 
#       "id": "org1", "name": "Empresa A", 
#       "venues": [{"id": "v1", "name": "Sede 1"}, ...] 
#     },
#     { "id": "org2", "name": "Empresa B", "venues": [...] }
#   ]
# }
```

---

### Task 3: Frontend - Update API Client & Context

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/VenueContext.tsx`

- [ ] **Step 1: Update TypeScript interfaces**
Reflect the new multi-organization structure in `Profile` and `VenueInfo`.

- [ ] **Step 2: Update VenueContext**
Add `activeOrgId` and `setActiveOrgId` to the context. This will be used to filter dashboard data.

---

### Task 4: Frontend - Two-Step Selection Screen

**Files:**
- Modify: `frontend/src/app/venue-selection/page.tsx`

- [ ] **Step 1: Implement Step 1: Organization Selection**
Show cards for each organization. Use a grid layout.
Card shows organization name and number of accessible venues.

- [ ] **Step 2: Implement Step 2: Venue Selection**
When an organization is clicked, "slide in" or switch the view to show venues *only* for that organization.
Add a "Back" button to return to organization selection.

- [ ] **Step 3: Update redirection logic**
If the user only has 1 organization and 1 venue, skip the selection and go to dashboard.
If the user has 1 organization but multiple venues, show the venue selection directly for that org.

---

### Task 5: Backend - Organization-Aware Permissions

**Files:**
- Modify: `backend/permissions.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Update `require_permission`**
The backend needs to know which organization context the user is in.
Expect an `X-Org-ID` header from the frontend.
Validate that the user actually belongs to this `org_id` before checking permissions.

- [ ] **Step 2: Update Admin queries**
Endpoints like `/admin/users` or `/admin/reports` should use the `X-Org-ID` header instead of the static `organization_id` from the profile.

---

### Task 6: Final Integration & Polish

- [ ] **Step 1: Testing**
Verify a user can log in, see two companies, select Company B, see only Company B's venues, and enter the dashboard.
Verify that switching companies (by going back to `/venue-selection`) correctly updates the dashboard data.
