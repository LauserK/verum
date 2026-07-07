# Plan de Implementación: Cálculo de Costo en Cascada desde Receta

**Objetivo:** Implementar la actualización en cascada del costo de los productos manufacturados (`last_purchase_cost`) a partir de los costos de sus ingredientes, con la opción de activarlo/desactivarlo mediante un toggle en la receta.

---

## Tarea 1: Base de Datos y Backend (Schema)

### 1.1 Migración de Base de Datos
- **Archivo:** `backend/migrations/031_recipe_auto_cost.sql` (nuevo)
- **Acción:** Crear un script SQL que agregue la columna `auto_calculate_cost` a la tabla `recipes`.
- **Código:** `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS auto_calculate_cost boolean NOT NULL DEFAULT true;`

### 1.2 Actualizar Pydantic Schemas
- **Archivo:** `backend/app/production/schemas.py`
- **Acción:**
  - Agregar `auto_calculate_cost: bool = True` a `RecipeCreate` y `RecipeUpdate`.
  - Agregar `auto_calculate_cost: bool` a `RecipeResponse`.

---

## Tarea 2: Motor de Cálculo y Actualización en Cascada

### 2.1 Función `update_item_cost_and_cascade`
- **Archivo:** `backend/app/production/utils.py` (crear si no existe, o agregarlo en `router.py` / `inventory/router.py` según corresponda)
- **Acción:**
  - Crear una función asíncrona: `async def update_item_cost_and_cascade(db, org_id: str, item_id: UUID, new_cost: float, visited_recipes: set = None)`.
  - **Lógica:**
    1. Actualizar `last_purchase_cost` del `item_id`.
    2. Inicializar `visited_recipes` si es None.
    3. Buscar en `recipe_lines` las recetas que contengan `item_id` como ingrediente.
    4. Para cada receta encontrada, verificar que `recipes.auto_calculate_cost == True` y que la receta no esté en `visited_recipes` (para evitar ciclos).
    5. Si cumple, agregar la receta a `visited_recipes`.
    6. Calcular el nuevo costo total de la receta sumando `qty * ingrediente.last_purchase_cost` para todos sus ingredientes.
    7. Dividir por `yield_qty` para obtener el `nuevo_costo_unitario`.
    8. Llamada recursiva: `await update_item_cost_and_cascade(db, org_id, receta.item_id, nuevo_costo_unitario, visited_recipes)`.

---

## Tarea 3: Disparadores (Triggers) del Motor

### 3.1 Recepción de Compras e Inventario
- **Archivo:** `backend/app/inventory/router.py`
- **Acción:** En `process_inventory_document` (procesamiento de "receipt"), reemplazar el `UPDATE items SET last_purchase_cost = ...` por una llamada a `await update_item_cost_and_cascade(db, org_id, line["item_id"], float(line["unit_cost_base"] or 0))`.

### 3.2 Importación de Excel
- **Archivo:** `backend/app/production/router.py`
- **Acción:** En `import_stock_from_excel`, si se detecta que el costo de un ingrediente cambia significativamente (o por convención en toda importación positiva que afecte el costo), llamar a `await update_item_cost_and_cascade`. (Podemos simplificar llamándolo al final de la importación para todos los items afectados).

### 3.3 Creación/Actualización de Recetas
- **Archivo:** `backend/app/production/router.py`
- **Acción:**
  - En `create_recipe`, después de crear la receta y sus líneas, si `auto_calculate_cost == True`, llamar a la lógica de cálculo de costo para su propio `item_id` (o llamar a una versión adaptada de la utilidad que comience desde la receta).
  - En `update_recipe`, hacer lo mismo.

---

## Tarea 4: Frontend (Interfaz de Usuario)

### 4.1 Actualizar API Client
- **Archivo:** `frontend/src/lib/api.ts`
- **Acción:** Actualizar las interfaces `Recipe`, `RecipeCreate` y `RecipeUpdate` para incluir `auto_calculate_cost: boolean`.

### 4.2 Formulario de Receta
- **Archivo:** `frontend/src/app/admin/inventory/items/[id]/recipes/page.tsx` (o equivalente)
- **Acción:**
  - En el modal/formulario de creación/edición de receta, agregar un Switch component con la etiqueta "Calcular costo desde receta automáticamente".
  - Enlazar el Switch al estado `auto_calculate_cost`.
  - Asegurarse de enviarlo al backend al guardar.
