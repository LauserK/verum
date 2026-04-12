# Design Doc: Super Admin Panel

**Feature Name:** Super Admin Panel (Global Management)
**Goal:** Provide a central dashboard for system administrators to manage all organizations, users, and global metrics with high security and TDD.
**Tech Stack:** Next.js 14 (App Router), FastAPI, Supabase (PostgreSQL, Auth), Pytest.

---

## 1. Data Schema Changes

### 1.1 `profiles` Table
- Add `is_superadmin` (boolean, default false).
- Keep `organization_id` and `venue_id` as the "Primary/Default" context for the user.

### 1.2 `organizations` Table
- Add `is_active` (boolean, default true).
- This flag will determine if users of this organization can access the system.

---

## 2. Security & Access Control

### 2.1 Backend (FastAPI)
- **Super Admin Dependency:** A function `get_current_super_admin` that:
    1.  Validates the Supabase JWT.
    2.  Fetches the profile from the database.
    3.  Checks if `is_superadmin` is `true`.
    4.  Raises `403 Forbidden` if not authorized.
- **Global Endpoints:** All routes under `/api/super-admin/` will be protected by this dependency.

### 2.2 Frontend (Next.js)
- **Isolated Routes:** All pages under `/src/app/super-admin/*`.
- **Middleware:** Verify the user's `is_superadmin` status before allowing access to the `/super-admin` path.
- **Design Tokens:** Use consistent Verum styling (dark mode, accessibility) but with a distinct primary color (e.g., Indigo) to signal the global context.

---

## 3. Core Features

### 3.1 Global Dashboard
- **KPIs:** Total Organizations (Active/Inactive), Total Users, Recent Activity (last 24h).
- **Distribution:** Overview of user counts per organization.

### 3.2 Organization Management
- **CRUD Operations:** Create new organizations, edit names, and toggle `is_active` status.
- **Details:** View all venues and users associated with a specific organization.
- **Deactivation Logic:** If `is_active` is false, users attempting to login or access the dashboard will see a popup/modal indicating the organization is disabled and to contact support.

### 3.3 User Management (Multi-Tenant)
- **Global User List:** Searchable table of all users in the system.
- **Organization Association:**
    - Update `profiles.organization_id` and `profiles.venue_id` (Primary).
    - Manage `profile_organizations` and `profile_venues` (Additional associations).
- **Create Users:** Integrated with Supabase Auth Admin SDK to create users and assign them to one or multiple organizations.
- **Grant Super Admin:** Current Super Admins can promote other users to Super Admin status.

---

## 4. Implementation Strategy (TDD)

### 4.1 Backend
- **Test Setup:** Use `pytest` with a test database.
- **Unit Tests:** Verify the `get_current_super_admin` dependency.
- **Integration Tests:** 
    - Test that `/api/super-admin/*` endpoints return `403` for non-superadmin users.
    - Test CRUD operations for organizations and users.
    - Test the multi-tenant association logic.

### 4.2 Frontend
- **Component Tests:** Verify that the "Organization Deactivated" popup renders correctly when the flag is received from the API.
- **Route Protection:** Verify that non-superadmins are redirected away from `/super-admin`.

---

## 5. Endpoints (Under `/api/super-admin/`)

- `GET /stats`: Global totals.
- `GET /organizations`: List all organizations.
- `POST /organizations`: Create new organization.
- `PATCH /organizations/{id}`: Toggle status or update info.
- `GET /users`: List all users with their organizations.
- `POST /users`: Create new user (auth + profile).
- `PUT /users/{id}/organizations`: Sync multi-tenant associations.
- `PATCH /users/{id}/super-admin`: Promote/Demote.
