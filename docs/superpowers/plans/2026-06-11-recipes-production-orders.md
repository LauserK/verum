# M19-PRD: Recetas y Órdenes de Producción Implementación Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo de Recetas (BOM + Pasos) y la creación reactiva de Órdenes de Producción con escalado automático y validación de stock multi-UOM.

**Architecture:** Módulo independiente de Producción. Backend en FastAPI con lógica de escalado en la capa de servicios. Frontend en Next.js con componentes reactivos que validan disponibilidad contra el inventario real.

**Tech Stack:** Python (FastAPI, Pytest), Supabase (PostgreSQL), TypeScript (Next.js, Tailwind).

---

### Fase 1: Infraestructura y Modelos de Datos

#### Task 1: Migración de Base de Datos
**Files:**
- Create: `backend/migrations/036_recipes_schema.sql`

- [ ] **Step 1: Crear la migración con las tablas `recipes`, `recipe_ingredients` y `recipe_steps`**
```sql
create table recipes (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  item_id         uuid references items(id) unique,
  yield_qty_base  numeric(18, 6) not null,
  yield_presentation_id uuid references uom_presentations(id),
  is_active       boolean default true,
  created_at      timestamp with time zone default now()
);

create table recipe_ingredients (
  id              uuid default uuid_generate_v4() primary key,
  recipe_id       uuid references recipes(id) on delete cascade,
  item_id         uuid references items(id),
  qty_base        numeric(18, 6) not null,
  presentation_id uuid references uom_presentations(id),
  order_index     integer not null
);

create table recipe_steps (
  id              uuid default uuid_generate_v4() primary key,
  recipe_id       uuid references recipes(id) on delete cascade,
  order_index     integer not null,
  description     text not null,
  estimated_time_minutes integer default 0
);
```
- [ ] **Step 2: Aplicar la migración en Supabase**
- [ ] **Step 3: Commit**
```bash
git add backend/migrations/036_recipes_schema.sql
git commit -m "db: add recipes schema for M19"
```

#### Task 2: Schemas Pydantic
**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Agregar schemas para Recipe, Ingredient y Step**
```python
class RecipeIngredientBase(BaseModel):
    item_id: UUID
    qty_base: Decimal
    presentation_id: UUID
    order_index: int

class RecipeStepBase(BaseModel):
    order_index: int
    description: str
    estimated_time_minutes: int = 0

class RecipeCreate(BaseModel):
    item_id: UUID
    yield_qty_base: Decimal
    yield_presentation_id: UUID
    ingredients: List[RecipeIngredientBase]
    steps: List[RecipeStepBase]

class RecipeResponse(BaseModel):
    id: UUID
    item_id: UUID
    yield_qty_base: Decimal
    yield_presentation_id: UUID
    ingredients: List[Dict]
    steps: List[Dict]
```
- [ ] **Step 2: Commit**

---

### Fase 2: Backend y Lógica de Escalado

#### Task 3: Endpoints de Recetas (CRUD)
**Files:**
- Modify: `backend/main.py`
- Create: `backend/tests/test_recipes.py`

- [ ] **Step 1: Escribir test para crear receta**
- [ ] **Step 2: Implementar POST /production/recipes**
- [ ] **Step 3: Implementar GET /production/recipes/{item_id}**
- [ ] **Step 4: Verificar tests**
- [ ] **Step 5: Commit**

#### Task 4: Lógica de Escalado y Validación de Stock
**Files:**
- Modify: `backend/main.py`
- Test: `backend/tests/test_production_orders.py`

- [ ] **Step 1: Escribir test de escalado reactivo**
```python
def test_calculate_production_needs():
    # Test que al pedir 50kg de una receta de 10kg, devuelva 5x ingredientes
    # y reporte déficit si no hay stock suficiente en el almacén de la sede.
    pass
```
- [ ] **Step 2: Implementar endpoint `POST /production/calculate-needs`**
```python
@app.post("/production/calculate-needs")
async def calculate_needs(item_id: UUID, target_qty: Decimal, target_uom_id: UUID, warehouse_id: UUID):
    # 1. Obtener receta
    # 2. Convertir target_qty a base_uom
    # 3. Calcular factor (target_base / yield_base)
    # 4. Por cada ingrediente: calc necesario y consultar stock actual
    # 5. Devolver lista con disponibilidad (ok/déficit)
```
- [ ] **Step 3: Verificar tests**
- [ ] **Step 4: Commit**

---

### Fase 3: Frontend - Módulo de Producción

#### Task 5: Estructura de Navegación y Sidebar
**Files:**
- Modify: `frontend/src/components/BottomNav.tsx` (o Sidebar si aplica a Admin)
- Modify: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Agregar el menú "Producción" con sub-rutas Dashboard, Recetas, Órdenes**
- [ ] **Step 2: Crear páginas placeholder para verificar rutas**
- [ ] **Step 3: Commit**

#### Task 6: Editor de Recetas (BOM + Pasos)
**Files:**
- Create: `frontend/src/app/admin/production/recipes/page.tsx`
- Create: `frontend/src/app/admin/production/recipes/[id]/page.tsx`
- Create: `frontend/src/components/production/RecipeEditor.tsx`

- [ ] **Step 1: Implementar lista de artículos que pueden tener receta**
- [ ] **Step 2: Implementar Editor con tabla de ingredientes y lista de pasos numerados**
- [ ] **Step 3: Integrar con API POST/GET recipes**
- [ ] **Step 4: Commit**

#### Task 7: Formulario de Nueva Orden de Producción Reactiva
**Files:**
- Create: `frontend/src/app/admin/production/orders/new/page.tsx`
- Create: `frontend/src/components/production/ScalerPanel.tsx`

- [ ] **Step 1: Implementar selector de Sede y buscador de Ítem**
- [ ] **Step 2: Implementar `ScalerPanel` que use `useAutoSave` o similar para debouncing de cálculos**
- [ ] **Step 3: Vincular el select de Unidad de Medida (UOM) al recálculo**
- [ ] **Step 4: Mostrar indicadores de stock (Verde/Rojo) e impedir creación si hay errores críticos**
- [ ] **Step 5: Implementar creación de la OP en el backend**
- [ ] **Step 6: Commit**

---

### Fase 4: Validación Final

#### Task 8: Test de Integración E2E
- [ ] **Step 1: Crear Receta -> Abrir Nueva OP -> Cambiar Cantidad -> Verificar Alerta Stock -> Guardar OP**
- [ ] **Step 2: Documentar el flujo en `MEMORY.md`**
- [ ] **Step 3: Commit final y limpieza**
