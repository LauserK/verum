# Multi-Tenant Admin Role Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition the Admin UI to use organization-specific role assignments via the `profile_organizations` table.

**Architecture:** 
1. **Backend:** Update `create_user` and `update_user` to ensure users are linked to organizations in the join table with their respective roles.
2. **Frontend:** Update `UserPermissions` and `TeamPage` to read/write roles from `profile_organizations` using the active organization context.

**Tech Stack:** FastAPI, Supabase, React (Next.js).

---

### Task 1: Backend - Unified User-Org-Role Logic

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update `create_user` endpoint**
When a user is created, insert/upsert into `profile_organizations` instead of just `profile_roles`.

```python
# In create_user:
# 1. After creating the profile...
# 2. Assign to profile_organizations
db.table("profile_organizations").upsert({
    "profile_id": new_user.id,
    "organization_id": body.organization_id,
    "role_id": role_id, # resolved from body.role name
    "is_default": True
}).execute()
```

- [ ] **Step 2: Update `update_user` endpoint**
Allow updating the role within the organization context.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(admin): update user creation to use profile_organizations"
```

---

### Task 2: Frontend - Update User Permissions Screen

**Files:**
- Modify: `frontend/src/app/admin/settings/users/[id]/UserPermissions.tsx`

- [ ] **Step 1: Use `activeOrgId` from context**
The component should now be aware of which organization we are assigning the role for.

- [ ] **Step 2: Update data fetching**
Fetch the current role from `profile_organizations` where `organization_id = activeOrgId`.

- [ ] **Step 3: Update saving logic**
Upsert to `profile_organizations` instead of `profile_roles`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/settings/users/[id]/UserPermissions.tsx
git commit -m "feat(admin): transition user permissions to multi-tenant model"
```

---

### Task 3: Frontend - Update Team Management List

**Files:**
- Modify: `frontend/src/app/admin/team/page.tsx`

- [ ] **Step 1: Ensure user creation uses active org**
Verify that the `organization_id` sent in `createUser` call comes from the active context.

- [ ] **Step 2: Refresh logic**
Ensure that when a role is changed, the UI reflects the new organization-specific role.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/team/page.tsx
git commit -m "feat(admin): ensure team management uses active organization context"
```
