# M7 Granular Permissions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a granular permissions system replacing fixed roles with custom roles, role permissions, and individual permission overrides.

**Architecture:** 
- **Database (Supabase SQL):** New tables for `custom_roles`, `permissions`, `role_permissions`, `profile_roles`, `profile_permission_overrides` replacing the legacy `role` enum.
- **Backend (FastAPI):** A new `permissions.py` for the dependency injection `require_permission`. Endpoints for CRUD roles, assigning permissions, and overriding permissions at the user level. 
- **Frontend (Next.js):** Two new admin screens: `/admin/settings/roles` for role creation and permission mapping, and `/admin/settings/users/[id]` for user overrides. 

**Tech Stack:** FastAPI, Supabase PostgreSQL, Next.js (App Router), Tailwind CSS.

---

## Chunk 1: Database and Backend Foundations

### Task 1: Create Database Migration for Permissions
Create the SQL migration file to set up the granular permissions tables as outlined in the PRD.

**Files:**
- Create: `backend/migrations/010_granular_permissions.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- backend/migrations/010_granular_permissions.sql
create table custom_roles (
  id          uuid default uuid_generate_v4() primary key,
  org_id      uuid references organizations(id) on delete cascade,
  name        text not null,
  description text,
  is_admin    boolean default false,
  created_at  timestamp with time zone default now()
);

create table permissions (
  id          uuid default uuid_generate_v4() primary key,
  module      text not null,
  action      text not null,
  key         text unique not null,
  description text
);

create table role_permissions (
  role_id       uuid references custom_roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table profile_roles (
  profile_id  uuid references profiles(id) on delete cascade unique,
  role_id     uuid references custom_roles(id) on delete cascade,
  primary key (profile_id)
);

create table profile_permission_overrides (
  profile_id    uuid references profiles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  granted       boolean not null,
  reason        text,
  created_by    uuid references profiles(id),
  created_at    timestamp with time zone default now(),
  primary key (profile_id, permission_id)
);
```

### Task 2: Create Seed File for Initial Permissions
We need to insert the specific `permissions` as defined in the VERUM_PRD_Inventario.md.

**Files:**
- Create: `backend/migrations/011_seed_permissions.sql`

- [ ] **Step 1: Write the seed SQL**

```sql
-- backend/migrations/011_seed_permissions.sql
INSERT INTO permissions (module, action, key, description) VALUES
  ('checklists', 'view', 'checklists.view', 'Ver lista de checklists del turno'),
  ('checklists', 'execute', 'checklists.execute', 'Ejecutar y enviar un checklist'),
  ('checklists', 'view_all', 'checklists.view_all', 'Ver checklists de otros usuarios/turnos'),
  ('checklists', 'manage_templates', 'checklists.manage_templates', 'Crear y editar plantillas de checklist'),
  ('inventory_assets', 'view', 'inventory_assets.view', 'Ver lista y ficha de activos'),
  ('inventory_assets', 'report_fault', 'inventory_assets.report_fault', 'Reportar falla en un activo (abre ticket)'),
  ('inventory_assets', 'add_ticket_entry', 'inventory_assets.add_ticket_entry', 'Agregar entradas a un ticket de reparación abierto'),
  ('inventory_assets', 'close_ticket', 'inventory_assets.close_ticket', 'Marcar un ticket de reparación como resuelto'),
  ('inventory_assets', 'create', 'inventory_assets.create', 'Crear nuevos activos'),
  ('inventory_assets', 'edit', 'inventory_assets.edit', 'Editar datos de un activo'),
  ('inventory_assets', 'delete', 'inventory_assets.delete', 'Eliminar activos (solo admin)'),
  ('inventory_assets', 'print_qr', 'inventory_assets.print_qr', 'Imprimir código QR de un activo'),
  ('inventory_assets', 'review', 'inventory_assets.review', 'Marcar un activo como revisado (revisión preventiva)'),
  ('inventory_utensils', 'view', 'inventory_utensils.view', 'Ver ítems y último conteo'),
  ('inventory_utensils', 'count', 'inventory_utensils.count', 'Ejecutar un conteo de utensilios'),
  ('inventory_utensils', 'confirm_count', 'inventory_utensils.confirm_count', 'Confirmar o corregir conteos pendientes'),
  ('inventory_utensils', 'manage_items', 'inventory_utensils.manage_items', 'Crear/editar ítems y categorías'),
  ('inventory_utensils', 'view_reports', 'inventory_utensils.view_reports', 'Ver reportes históricos de pérdidas'),
  ('admin', 'manage_users', 'admin.manage_users', 'Invitar usuarios, asignar roles'),
  ('admin', 'manage_roles', 'admin.manage_roles', 'Crear y editar roles personalizados'),
  ('admin', 'manage_venues', 'admin.manage_venues', 'Crear y editar sedes'),
  ('admin', 'view_dashboard', 'admin.view_dashboard', 'Acceso al dashboard administrativo'),
  ('admin', 'view_reports', 'admin.view_reports', 'Ver todos los reportes de compliance')
ON CONFLICT (key) DO NOTHING;
```

## Chunk 2: Backend Permissions Dependency

### Task 3: Create FastAPI Permissions Dependency
Implement the core logic for resolving a user's permissions and creating a dependency that endpoints can use.

**Files:**
- Create: `backend/permissions.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write `backend/permissions.py`**

```python
# backend/permissions.py
from fastapi import Depends, HTTPException, status
from database import get_db

async def resolve_permission(profile_id: str, permission_key: str, db) -> bool:
    # 1. Check admin bypass
    # Fetch user's custom role
    role_res = db.table('profile_roles').select('role_id, custom_roles(is_admin)').eq('profile_id', profile_id).execute()
    if role_res.data and len(role_res.data) > 0:
        custom_role = role_res.data[0].get('custom_roles', {})
        if custom_role and custom_role.get('is_admin') is True:
            return True

    # Fetch permission id
    perm_res = db.table('permissions').select('id').eq('key', permission_key).execute()
    if not perm_res.data:
        return False
    perm_id = perm_res.data[0]['id']

    # 2. Check individual override
    override_res = db.table('profile_permission_overrides').select('granted').eq('profile_id', profile_id).eq('permission_id', perm_id).execute()
    if override_res.data and len(override_res.data) > 0:
        return override_res.data[0]['granted']

    # 3. Check role permissions
    if role_res.data and len(role_res.data) > 0:
        role_id = role_res.data[0]['role_id']
        rp_res = db.table('role_permissions').select('permission_id').eq('role_id', role_id).eq('permission_id', perm_id).execute()
        if rp_res.data and len(rp_res.data) > 0:
            return True

    return False
```

- [ ] **Step 2: Import and define `require_permission` in `backend/main.py`**
(Assuming `get_current_user` and `get_db` already exist in `main.py`.)

```python
# Insert near other dependencies in backend/main.py
from permissions import resolve_permission

def require_permission(permission_key: str):
    async def _check(current_user = Depends(get_current_user), db = Depends(get_db)):
        has_perm = await resolve_permission(current_user["id"], permission_key, db)
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "missing_permission", "required": permission_key}
            )
        return current_user
    return _check
```

## Chunk 3: Backend API Endpoints

### Task 4: Roles and Permissions Endpoints
Add CRUD endpoints for Custom Roles, listing Permissions, and Overrides in `main.py`.

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add `/permissions` and `/roles` Endpoints**
(Assuming `app = FastAPI()` exists)

```python
# Append to backend/main.py
from pydantic import BaseModel
from typing import List, Optional

@app.get("/permissions")
async def list_permissions(db = Depends(get_db)):
    res = db.table("permissions").select("*").execute()
    return res.data

class RoleCreate(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None
    is_admin: bool = False

@app.get("/roles")
async def list_roles(org_id: str, db = Depends(get_db)):
    res = db.table("custom_roles").select("*").eq("org_id", org_id).execute()
    return res.data

@app.post("/roles")
async def create_role(role: RoleCreate, db = Depends(get_db), _ = Depends(require_permission("admin.manage_roles"))):
    res = db.table("custom_roles").insert(role.dict()).execute()
    return res.data[0]

@app.post("/roles/{role_id}/permissions")
async def assign_role_permissions(role_id: str, permission_ids: List[str], db = Depends(get_db), _ = Depends(require_permission("admin.manage_roles"))):
    # delete old permissions
    db.table("role_permissions").delete().eq("role_id", role_id).execute()
    # insert new
    inserts = [{"role_id": role_id, "permission_id": pid} for pid in permission_ids]
    if inserts:
        db.table("role_permissions").insert(inserts).execute()
    return {"status": "success"}
```

- [ ] **Step 2: Add User Overrides Endpoints**

```python
class OverrideCreate(BaseModel):
    permission_key: str
    granted: bool
    reason: Optional[str] = None

@app.post("/profiles/{profile_id}/overrides")
async def create_override(profile_id: str, override: OverrideCreate, current_user = Depends(get_current_user), db = Depends(get_db), _ = Depends(require_permission("admin.manage_users"))):
    # Fetch perm id
    perm_res = db.table("permissions").select("id").eq("key", override.permission_key).execute()
    if not perm_res.data:
        raise HTTPException(404, "Permission not found")
    perm_id = perm_res.data[0]["id"]
    
    data = {
        "profile_id": profile_id,
        "permission_id": perm_id,
        "granted": override.granted,
        "reason": override.reason,
        "created_by": current_user["id"]
    }
    res = db.table("profile_permission_overrides").upsert(data).execute()
    return res.data

@app.get("/profiles/{profile_id}/permissions")
async def get_effective_permissions(profile_id: str, db = Depends(get_db)):
    # Simple logic to return all effective permissions to frontend
    perms = db.table("permissions").select("*").execute().data
    effective = []
    for p in perms:
        has_perm = await resolve_permission(profile_id, p["key"], db)
        if has_perm:
            effective.append(p["key"])
    return {"permissions": effective}
```

## Chunk 4: Frontend UI - Role Management

### Task 5: Implement `/admin/settings/roles` Layout and Fetching
Create the admin view to list roles and an interface to edit their permissions.

**Files:**
- Create: `frontend/src/app/admin/settings/roles/page.tsx`
- Create: `frontend/src/app/admin/settings/roles/RoleManager.tsx`

- [ ] **Step 1: Write the minimal `page.tsx`**

```tsx
// frontend/src/app/admin/settings/roles/page.tsx
import { RoleManager } from './RoleManager';

export default function RolesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Roles</h1>
      <RoleManager />
    </div>
  );
}
```

- [ ] **Step 2: Write `RoleManager.tsx` (Skeleton)**

```tsx
// frontend/src/app/admin/settings/roles/RoleManager.tsx
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export function RoleManager() {
  const [roles, setRoles] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.from('custom_roles').select('*').then(({ data }) => {
      if (data) setRoles(data);
    });
  }, []);

  return (
    <div className="flex gap-6">
      <div className="w-1/3 bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4">Roles</h2>
        <ul className="space-y-2">
          {roles.map(r => <li key={r.id} className="p-2 bg-surface-raised rounded-md">{r.name}</li>)}
        </ul>
        <button className="mt-4 w-full bg-primary text-text-inverse rounded-xl h-10 font-semibold">
          + Crear rol
        </button>
      </div>
      <div className="w-2/3 bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4">Permisos</h2>
        <p className="text-text-secondary">Selecciona un rol para editar sus permisos</p>
      </div>
    </div>
  );
}
```


## Chunk 5: Frontend UI - User Overrides

### Task 6: Implement `/admin/settings/users/[id]` View
Update user profile to allow selecting a custom role and setting individual overrides.

**Files:**
- Create: `frontend/src/app/admin/settings/users/[id]/page.tsx`
- Create: `frontend/src/app/admin/settings/users/[id]/UserPermissions.tsx`

- [ ] **Step 1: Write `page.tsx`**

```tsx
// frontend/src/app/admin/settings/users/[id]/page.tsx
import { UserPermissions } from './UserPermissions';

export default async function UserProfilePage({ params }: { params: { id: string } }) {
  // Await params if using Next.js 15, but Next 14 allows sync usage (usually better to await though)
  const id = params.id; 
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Perfil de Usuario</h1>
      <UserPermissions userId={id} />
    </div>
  );
}
```

- [ ] **Step 2: Write `UserPermissions.tsx` (Skeleton)**

```tsx
// frontend/src/app/admin/settings/users/[id]/UserPermissions.tsx
'use client';

export function UserPermissions({ userId }: { userId: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4">Rol Asignado</h2>
        {/* Dropdown to select a single custom_role would go here */}
        <select className="bg-surface border border-border rounded-xl px-4 h-12 w-full text-text-primary focus:border-primary ring-primary/20">
          <option>Seleccionar rol...</option>
        </select>
      </div>

      <div className="bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4">Overrides Individuales</h2>
        <p className="text-text-secondary text-sm">Los overrides sobrescriben los permisos del rol asignado.</p>
        <button className="mt-4 border border-border text-text-primary rounded-xl h-10 px-4 hover:bg-surface-raised font-semibold">
          Añadir Override
        </button>
      </div>
    </div>
  );
}
```

---
*End of Plan*
