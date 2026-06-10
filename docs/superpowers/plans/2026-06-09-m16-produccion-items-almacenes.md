# M16-PRD Maestro de Artículos, Almacenes y Stock Inicial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar la base del sistema de producción de VERUM (M16-PRD), habilitando la creación de unidades de medida, artículos con múltiples presentaciones, almacenes y la carga del stock inicial.

**Architecture:** 
- **Base de datos:** Nuevas tablas en PostgreSQL (`uom_base`, `uom_presentations`, `items`, `item_uom_presentations`, `warehouses`, `stock`) y permisos correspondientes.
- **Backend:** Endpoints en FastAPI para gestión de artículos (CRUD y asociación de presentaciones), almacenes y vista del stock. Uso de arquitectura multi-tenant (filtrado por `org_id`).
- **Frontend:** Vistas en Next.js App Router para listar y crear artículos (`/inventory/items`) y almacenes (`/inventory/warehouses`), integrando el estado global.

**Tech Stack:** PostgreSQL, FastAPI, Pydantic, Next.js, React, TailwindCSS.

---

### Task 1: Configurar esquema de BD y permisos para Producción e Inventario

**Files:**
- Create: `backend/migrations/027_production_schema.sql`

- [ ] **Step 1: Crear la migración para las tablas base y permisos**

```sql
-- backend/migrations/027_production_schema.sql

-- Permisos del módulo
INSERT INTO permissions (module, action, key, description) VALUES
  ('inventory', 'view', 'inventory.view', 'Ver stock e inventario'),
  ('inventory', 'manage_items', 'inventory.manage_items', 'Crear y editar artículos y presentaciones'),
  ('inventory', 'manage_warehouses', 'inventory.manage_warehouses', 'Crear y editar almacenes')
ON CONFLICT (key) DO NOTHING;

-- Unidades de medida base
create table if not exists uom_base (
  id      uuid default uuid_generate_v4() primary key,
  code    text unique not null,
  name    text not null
);

INSERT INTO uom_base (code, name) VALUES
  ('g', 'Gramos'),
  ('ml', 'Mililitros'),
  ('unit', 'Unidades')
ON CONFLICT (code) DO NOTHING;

-- Presentaciones de conversión por artículo
create table if not exists uom_presentations (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  name            text not null,
  base_uom_id     uuid references uom_base(id),
  conversion_factor numeric(18, 6) not null,
  is_default      boolean default false
);

-- Catálogo de artículos
create table if not exists items (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  code            text,
  name            text not null,
  type            text check (type in (
    'raw_material', 'semi_finished', 'finished', 'packaging', 'supply'
  )),
  base_uom_id     uuid references uom_base(id),
  default_display_uom_id uuid references uom_presentations(id),
  yield_alert_enabled  boolean default false,
  yield_alert_threshold_pct numeric(5,2),
  shelf_life_days  integer,
  last_purchase_cost numeric(18,6),
  last_purchase_cost_updated_at timestamp with time zone,
  is_active       boolean default true,
  created_at      timestamp with time zone default now()
);

-- Presentaciones habilitadas por artículo
create table if not exists item_uom_presentations (
  item_id         uuid references items(id) on delete cascade,
  presentation_id uuid references uom_presentations(id) on delete cascade,
  primary key (item_id, presentation_id)
);

-- Almacenes
create table if not exists warehouses (
  id       uuid default uuid_generate_v4() primary key,
  org_id   uuid references organizations(id) on delete cascade,
  venue_id uuid references venues(id),
  name     text not null,
  type     text check (type in (
    'production', 'storage', 'point_of_sale', 'transit'
  )),
  is_active boolean default true
);

-- Stock actual
create table if not exists stock (
  id           uuid default uuid_generate_v4() primary key,
  warehouse_id uuid references warehouses(id) on delete cascade,
  item_id      uuid references items(id) on delete cascade,
  qty_base     numeric(18, 6) not null default 0,
  qty_reserved numeric(18, 6) not null default 0,
  unique (warehouse_id, item_id)
);

create index if not exists idx_stock_warehouse_item on stock(warehouse_id, item_id);
```

- [ ] **Step 2: Aplicar la migración a la base de datos de test y desarrollo**

```bash
# Correr script de migraciones manual o reiniciar base de datos local
psql -U admin -d verum -f backend/migrations/027_production_schema.sql
```

- [ ] **Step 3: Escribir test backend verificando que la BD aplica los cambios (opcional)**

```python
# tests/test_production_schema.py
import pytest
from database import get_db

@pytest.mark.asyncio
async def test_production_tables_exist(test_app):
    async with get_db() as conn:
        res = await conn.fetch("SELECT code FROM uom_base")
        codes = [r['code'] for r in res]
        assert 'g' in codes
        assert 'ml' in codes
        assert 'unit' in codes
```

- [ ] **Step 4: Commit**
```bash
git add backend/migrations/027_production_schema.sql tests/test_production_schema.py
git commit -m "feat(db): add M16 production schema for items, uom and warehouses"
```

---

### Task 2: Backend Schemas para Items y Almacenes

**Files:**
- Modify: `backend/schemas.py:xxx` (append to end)

- [ ] **Step 1: Agregar modelos Pydantic**

```python
# backend/schemas.py
from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class UOMBase(BaseModel):
    id: UUID
    code: str
    name: str

class UOMPresentationCreate(BaseModel):
    name: str
    base_uom_id: UUID
    conversion_factor: float
    is_default: bool = False

class UOMPresentationResponse(UOMPresentationCreate):
    id: UUID
    org_id: UUID

class ItemCreate(BaseModel):
    code: Optional[str] = None
    name: str
    type: str
    base_uom_id: UUID
    yield_alert_enabled: bool = False
    yield_alert_threshold_pct: Optional[float] = None
    shelf_life_days: Optional[int] = None
    presentations: List[UOMPresentationCreate] = []

class ItemResponse(BaseModel):
    id: UUID
    org_id: UUID
    code: Optional[str]
    name: str
    type: str
    base_uom_id: UUID
    is_active: bool
    created_at: datetime
    # Se omiten presentaciones por ahora en la respuesta básica

class WarehouseCreate(BaseModel):
    name: str
    venue_id: Optional[UUID] = None
    type: str

class WarehouseResponse(WarehouseCreate):
    id: UUID
    org_id: UUID
    is_active: bool
```

- [ ] **Step 2: Commit**
```bash
git add backend/schemas.py
git commit -m "feat(backend): add schemas for production inventory"
```

---

### Task 3: Backend Endpoints para Almacenes y Items

**Files:**
- Modify: `backend/main.py` (append new endpoints at the end or in the inventory section)

- [ ] **Step 1: Agregar endpoints de inventario a main.py**

```python
# append to backend/main.py 
# (Asumiendo que ItemCreate, ItemResponse, WarehouseCreate, WarehouseResponse fueron importados de schemas)

@app.post("/inventory/warehouses", response_model=WarehouseResponse, tags=["Inventory"])
async def create_warehouse(warehouse: WarehouseCreate, org_id: str = Depends(get_active_org_id), db=Depends(get_db)):
    data = {
        "org_id": org_id,
        "venue_id": str(warehouse.venue_id) if warehouse.venue_id else None,
        "name": warehouse.name,
        "type": warehouse.type
    }
    
    res = db.table("warehouses").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error creating warehouse")
    return res.data[0]

@app.get("/inventory/warehouses", response_model=List[WarehouseResponse], tags=["Inventory"])
async def list_warehouses(org_id: str = Depends(get_active_org_id), db=Depends(get_db)):
    res = db.table("warehouses").select("*").eq("org_id", org_id).execute()
    return res.data

@app.post("/inventory/items", response_model=ItemResponse, tags=["Inventory"])
async def create_item(item: ItemCreate, org_id: str = Depends(get_active_org_id), db=Depends(get_db)):
    data = {
        "org_id": org_id,
        "code": item.code,
        "name": item.name,
        "type": item.type,
        "base_uom_id": str(item.base_uom_id),
        "yield_alert_enabled": item.yield_alert_enabled,
        "yield_alert_threshold_pct": item.yield_alert_threshold_pct,
        "shelf_life_days": item.shelf_life_days
    }
    
    res = db.table("items").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error creating item")
    return res.data[0]

@app.get("/inventory/items", response_model=List[ItemResponse], tags=["Inventory"])
async def list_items(org_id: str = Depends(get_active_org_id), db=Depends(get_db)):
    res = db.table("items").select("*").eq("org_id", org_id).execute()
    return res.data
```

- [ ] **Step 2: Test endpoints de inventario**
```python
# tests/test_inventory_endpoints.py
import pytest

@pytest.mark.asyncio
async def test_create_warehouse(authorized_client):
    res = await authorized_client.post("/inventory/warehouses", json={
        "name": "Almacén Central",
        "type": "storage"
    }, headers={"X-Org-ID": "org-id-here"}) # Assuming the test client handles headers or we pass it
    # Note: Test setup will handle proper headers for authorized_client based on existing tests.
    assert res.status_code == 200
    assert res.json()["name"] == "Almacén Central"
```

- [ ] **Step 3: Commit**
```bash
git add backend/main.py tests/test_inventory_endpoints.py
git commit -m "feat(backend): add endpoints for items and warehouses in main.py"
```

---

### Task 4: Frontend Catalog views para Items y Warehouses

**Files:**
- Create: `frontend/src/app/inventory/items/page.tsx`
- Create: `frontend/src/app/inventory/warehouses/page.tsx`

- [ ] **Step 1: Frontend Items Page**

```tsx
// frontend/src/app/inventory/items/page.tsx
"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function ItemsPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/inventory/items");
        setItems(res.data);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Catálogo de Artículos</h1>
      <table className="w-full text-left">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Nombre</th>
            <th className="p-2">Tipo</th>
            <th className="p-2">Activo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any) => (
            <tr key={item.id} className="border-b">
              <td className="p-2">{item.name}</td>
              <td className="p-2">{item.type}</td>
              <td className="p-2">{item.is_active ? 'Sí' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Frontend Warehouses Page**

```tsx
// frontend/src/app/inventory/warehouses/page.tsx
"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/inventory/warehouses");
        setWarehouses(res.data);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Almacenes</h1>
      <table className="w-full text-left">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Nombre</th>
            <th className="p-2">Tipo</th>
            <th className="p-2">Activo</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map((wh: any) => (
            <tr key={wh.id} className="border-b">
              <td className="p-2">{wh.name}</td>
              <td className="p-2">{wh.type}</td>
              <td className="p-2">{wh.is_active ? 'Sí' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**
```bash
git add frontend/src/app/inventory/
git commit -m "feat(frontend): add items and warehouses views"
```