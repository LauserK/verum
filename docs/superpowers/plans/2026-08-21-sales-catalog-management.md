# Catalog Management (Sales Items) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full frontend catalog management for Sales Items (`/admin/sales/catalog`), complete with categories, price configuration, variants, recipe components (BOM escandallo), and backend endpoints for listing/updating/deleting items and categories.

**Architecture:** Next.js App Router frontend with React Query/custom fetch client talking to FastAPI sales endpoints. The backend extends the sales service with CRUD for `sale_items`, `sale_categories`, and `sale_modifier_groups`. The frontend introduces an admin table view with filters/search and a multi-tab modal/drawer (General, Variantes, Escandallo/Receta, Modificadores).

**Tech Stack:** FastAPI (Python), PostgreSQL (Supabase), Next.js (TypeScript, React), Tailwind CSS, Lucide Icons.

---

### File Structure Map

**Backend:**
- Modify `backend/app/sales/router.py`: Add `GET /sales/items`, `GET /sales/items/{id}`, `PATCH /sales/items/{id}`, `DELETE /sales/items/{id}`, and `GET/POST/PATCH/DELETE /sales/categories` and `GET/POST /sales/modifier-groups`.
- Modify `backend/app/sales/service.py`: Add backend business logic for listing, updating, deleting sale items, categories, and modifier groups.
- Modify `backend/app/sales/schemas.py`: Add `SaleCategoryCreate`, `SaleCategoryUpdate`, `SaleCategoryOut`, `SaleItemUpdate`.

**Frontend:**
- Modify `frontend/src/lib/api/sales.ts`: Add TypeScript types (`SaleItem`, `SaleCategory`, `SaleModifierGroup`, etc.) and API client methods.
- Create `frontend/src/app/admin/sales/catalog/page.tsx`: Main catalog management page with category pill filters, search, and data table.
- Create `frontend/src/app/admin/sales/catalog/components/SaleItemModal.tsx`: Comprehensive multi-tab modal for creating/editing sales items.
- Create `frontend/src/app/admin/sales/catalog/components/CategoryModal.tsx`: Modal to create/edit sales categories.
- Modify `frontend/src/app/admin/sales/page.tsx`: Add navigation link to the new Catálogo de Venta page.

---

### Task 1: Backend Catalog Schemas & Service CRUD

**Files:**
- Modify: `backend/app/sales/schemas.py`
- Modify: `backend/app/sales/service.py`
- Modify: `backend/app/sales/router.py`

- [ ] **Step 1: Add Category & Update Schemas in `backend/app/sales/schemas.py`**

```python
class SaleCategoryCreate(BaseModel):
    name: str
    icon: str = 'lunch_dining'
    image_url: Optional[str] = None
    position: int = 0
    is_active: bool = True

class SaleCategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    position: Optional[int] = None
    is_active: Optional[bool] = None

class SaleCategoryOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    icon: str
    image_url: Optional[str] = None
    position: int
    is_active: bool
    created_at: Optional[Union[dt_datetime, str]] = None

class SaleItemUpdate(BaseModel):
    category_id: Optional[UUID] = None
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sale_price: Optional[Decimal] = None
    food_cost: Optional[Decimal] = None
    tax_id: Optional[UUID] = None
    tax_included: Optional[bool] = None
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    has_variants: Optional[bool] = None
    variant_label: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    position: Optional[int] = None
    components: Optional[List[SaleItemComponentCreate]] = None
    variants: Optional[List[SaleItemVariantCreate]] = None
    modifier_group_ids: Optional[List[UUID]] = None
```

- [ ] **Step 2: Implement Catalog Service Methods in `backend/app/sales/service.py`**

Add functions:
- `list_sale_categories(org_id: str, db)`
- `create_sale_category(org_id: str, payload: SaleCategoryCreate, db)`
- `update_sale_category(org_id: str, category_id: str, payload: SaleCategoryUpdate, db)`
- `list_sale_items(org_id: str, category_id: Optional[str], active_only: bool, db)`
- `update_sale_item(org_id: str, item_id: str, payload: SaleItemUpdate, db)`
- `delete_sale_item(org_id: str, item_id: str, db)`
- `list_modifier_groups(org_id: str, db)`
- `create_modifier_group(org_id: str, payload: SaleModifierGroupCreate, db)`

- [ ] **Step 3: Expose Endpoints in `backend/app/sales/router.py`**

```python
# --- Categories ---
@router.get("/categories", response_model=List[SaleCategoryOut])
async def list_categories(org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    return await sales_svc.list_sale_categories(org_id, db)

@router.post("/categories", response_model=SaleCategoryOut)
async def create_category(payload: SaleCategoryCreate, org_id: str = Depends(get_active_org_id), db = Depends(get_db), _ = Depends(require_permission("sales.manage_catalog"))):
    return await sales_svc.create_sale_category(org_id, payload, db)

# --- Items ---
@router.get("/items", response_model=List[SaleItemOut])
async def list_sale_items(category_id: Optional[str] = None, active_only: bool = False, org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    return await sales_svc.list_sale_items(org_id, category_id, active_only, db)

@router.get("/items/{item_id}", response_model=SaleItemOut)
async def get_sale_item(item_id: str, org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    return await sales_svc.get_sale_item(item_id, org_id, db)

@router.patch("/items/{item_id}", response_model=SaleItemOut)
async def update_sale_item(item_id: str, payload: SaleItemUpdate, org_id: str = Depends(get_active_org_id), db = Depends(get_db), _ = Depends(require_permission("sales.manage_catalog"))):
    res = await sales_svc.update_sale_item(org_id, item_id, payload, db)
    await invalidate_sales_catalog(org_id)
    return res

@router.delete("/items/{item_id}")
async def delete_sale_item(item_id: str, org_id: str = Depends(get_active_org_id), db = Depends(get_db), _ = Depends(require_permission("sales.manage_catalog"))):
    res = await sales_svc.delete_sale_item(org_id, item_id, db)
    await invalidate_sales_catalog(org_id)
    return res

# --- Modifier Groups ---
@router.get("/modifier-groups", response_model=List[SaleModifierGroupOut])
async def list_modifier_groups(org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    return await sales_svc.list_modifier_groups(org_id, db)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/sales/schemas.py backend/app/sales/service.py backend/app/sales/router.py
git commit -m "feat(sales): add CRUD endpoints for sale items, categories, and modifier groups"
```

---

### Task 2: Frontend API Client for Catalog

**Files:**
- Modify: `frontend/src/lib/api/sales.ts`

- [ ] **Step 1: Add Types and Endpoints to `frontend/src/lib/api/sales.ts`**

Define:
- `SaleCategory`, `SaleItem`, `SaleItemVariant`, `SaleItemComponent`, `SaleModifierGroup`, `SaleModifierOption`.
- Methods in `salesApi`:
  - `getSaleCategories()`
  - `createSaleCategory(data)`
  - `updateSaleCategory(id, data)`
  - `getSaleItems(categoryId?: string, activeOnly?: boolean)`
  - `getSaleItem(id: string)`
  - `createSaleItem(data)`
  - `updateSaleItem(id: string, data)`
  - `deleteSaleItem(id: string)`
  - `getModifierGroups()`

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api/sales.ts
git commit -m "feat(frontend): add sales catalog API client and types"
```

---

### Task 3: Category Management Modal

**Files:**
- Create: `frontend/src/app/admin/sales/catalog/components/CategoryModal.tsx`

- [ ] **Step 1: Build the Category Modal Component**

Features:
- Form fields: Name, Icon (emoji or Material icon selector), Position, Is Active.
- Handles both creation and edition.
- Emits `onSuccess` callback to reload category list.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/sales/catalog/components/CategoryModal.tsx
git commit -m "feat(frontend): create CategoryModal component for sales categories"
```

---

### Task 4: Sales Item Multi-Tab Modal (General, Variantes, Escandallo, Modificadores)

**Files:**
- Create: `frontend/src/app/admin/sales/catalog/components/SaleItemModal.tsx`

- [ ] **Step 1: Implement Multi-Tab Form Structure**

Tabs:
1. **General:**
   - Nombre del producto, Código/SKU, Código de barras.
   - Categoría (`select`), Impuesto/Alícuota (`select` de `salesApi.getTaxes()`).
   - Switch "Impuesto incluido en precio".
   - Precio de venta base y Switch "Tiene Variantes".
   - Switch "Producto Destacado" y "Activo".
2. **Variantes (visible si `has_variants = true`):**
   - Tabla interactiva para añadir filas de variantes (Nombre ej. "Grande", Precio, Costo, Código externo, Default).
3. **Escandallo / Insumos (BOM):**
   - Selector de insumos de inventario (llamando a `inventoryApi.getItems()`).
   - Cantidad y tipo (`fixed_qty` o `recipe_proportional`).
   - Indicador en vivo de Food Cost estimado vs Precio de venta (calculando Margen % = `((precio - costo) / precio) * 100`).
4. **Modificadores:**
   - Checkboxes/Selector múltiple para asociar grupos de modificadores globales (`salesApi.getModifierGroups()`).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/sales/catalog/components/SaleItemModal.tsx
git commit -m "feat(frontend): build comprehensive SaleItemModal with variants, BOM, and modifiers"
```

---

### Task 5: Catalog Admin Page (`/admin/sales/catalog`) & Navigation

**Files:**
- Create: `frontend/src/app/admin/sales/catalog/page.tsx`
- Modify: `frontend/src/app/admin/sales/page.tsx`

- [ ] **Step 1: Build `/admin/sales/catalog/page.tsx`**

Features:
- Top bar: Search input (by name or barcode/SKU), Category filter pills, "+ Nueva Categoría" and "+ Nuevo Producto".
- Table view:
  - Image/Icon, Name, SKU/Barcode, Category badge, Variants count badge, Price, Food Cost & Margin %, Status badge.
  - Actions dropdown: Editar, Duplicar, Desactivar / Eliminar.
- Empty states and loading skeletons matching Verum Dark Theme design tokens.

- [ ] **Step 2: Update Hub Navigation in `/admin/sales/page.tsx`**

Add link to `/admin/sales/catalog` in the submenu bar with icon `Package` or `UtensilsCrossed`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/sales/catalog/page.tsx frontend/src/app/admin/sales/page.tsx
git commit -m "feat(frontend): implement sales catalog admin view and update sales dashboard"
```
