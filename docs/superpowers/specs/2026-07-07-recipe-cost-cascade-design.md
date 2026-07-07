# Cálculo de Costo en Cascada desde Receta

**Fecha:** 2026-07-07
**Contexto:** Cuando el costo de un ingrediente cambia (por compra o ajuste de Excel), el sistema debe propagar este nuevo costo a todos los productos manufacturados que usan dicho ingrediente en su receta, calculando el costo total y actualizando el `last_purchase_cost` del producto final.

---

## Diseño de Base de Datos

Se agregará un nuevo campo en la tabla `recipes` en lugar de la tabla `items`. Dado que el cálculo por receta solo aplica si el artículo posee una receta, tiene más sentido semántico que el toggle resida aquí.

**Migración SQL:**
```sql
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS auto_calculate_cost boolean NOT NULL DEFAULT true;
```

---

## Diseño del Backend

### Motor de Cálculo en Python (Enfoque Bottom-Up)

Se creará una función utilitaria asíncrona en `backend/app/production/utils.py` (o similar) para centralizar la lógica de actualización en cascada.

**Flujo de la función `update_item_cost_and_cascade(db, org_id, item_id, new_cost)`:**
1. Actualiza el campo `last_purchase_cost` del `item_id` suministrado.
2. Consulta la tabla `recipe_lines` buscando todas las recetas donde `item_id` forme parte de los ingredientes.
3. Para cada receta encontrada (que tenga `auto_calculate_cost = true`):
   - Descarga todas sus `recipe_lines` y los `last_purchase_cost` de todos los ingredientes (haciendo un JOIN o consulta a la tabla `items`).
   - Calcula el costo total de la receta: `sum(qty * ingrediente.last_purchase_cost)`.
   - Calcula el costo unitario del producto terminado: `costo total / receta.yield_qty`.
   - Se llama a sí misma recursivamente pasando el ID del producto terminado y el costo unitario recién calculado (`update_item_cost_and_cascade(...)`).

*Prevención de ciclos infinitos:* La función mantendrá un set de `visited_recipes` en memoria por cada ejecución raíz para romper ciclos si accidentalmente se crean recetas circulares (ej: A contiene B, B contiene A).

### Disparadores (Triggers) del Backend

La función `update_item_cost_and_cascade` será invocada en los siguientes escenarios reemplazando los `UPDATE items SET last_purchase_cost = ...` existentes:

1. **Recepción de Compras (`create_purchase_receipt` / `process_inventory_document`):** Cuando un ingrediente ingresa, su `last_purchase_cost` se actualiza con el precio de compra.
2. **Importación de Stock por Excel (`import_stock_from_excel`):** Si la importación incluye lotes con costos nuevos.
3. **Guardado/Edición de Recetas:** Cuando un usuario crea o modifica una receta, o altera las cantidades de la receta de un producto manufacturado, se disparará el recálculo para ese producto final y se propagará hacia arriba en la cadena.

---

## Diseño del Frontend

### Pestaña de Recetas (Edición de Artículo)

En el formulario o vista de la receta del artículo, se añadirá un componente tipo "Toggle" o Switch.

**Interfaz:**
- **Etiqueta:** "Calcular costo desde receta automáticamente"
- **Comportamiento:**
  - Si está activado (default): El campo de costo en la pestaña general se bloquea o muestra un indicador de que es calculado por sistema, y el motor del backend actualizará este valor.
  - Si está desactivado: El usuario puede sobreescribir manualmente el costo del artículo.
- Se conectará con el endpoint de creación/actualización de recetas en el backend para modificar la propiedad `auto_calculate_cost` de la tabla `recipes`.

---

## Manejo de Casos Borde

1. **Ingredientes sin costo (`last_purchase_cost` nulo o 0):** Aportarán $0 al cálculo del costo del producto manufacturado.
2. **Recetas con `yield_qty` = 0:** Prevendremos división por cero retornando 0 o forzando una validación previa en la creación de la receta para evitar yields de 0.
3. **Referencias circulares:** El motor en cascada cortará la ejecución en el mismo hilo cuando detecte un ID de receta que ya fue procesado en la iteración actual.
