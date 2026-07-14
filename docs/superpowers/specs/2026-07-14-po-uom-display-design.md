# Especificación de Diseño: Visualización Dinámica de Unidades de Presentación (UOM) en Compras

Este documento de diseño describe los cambios necesarios para que la vista de detalle de las Órdenes de Compra (PO) y el futuro PDF muestren las cantidades y costos unitarios basados en la presentación seleccionada (ej: 10 kg), mientras que la base de datos mantiene las unidades mínimas base (ej: 10,000 g) bajo el capó.

---

## 1. Contexto y Problema

Cuando el usuario crea una Orden de Compra (PO) y selecciona una presentación alternativa (ej: "Kilogramos" con un factor de conversión de 1000 sobre la base "Gramos"), el sistema calcula y almacena:
- `qty_ordered_base` = `10000` (cantidad en gramos)
- `qty_ordered_presentation` = `10` (cantidad en kilogramos)
- `unit_cost_base` = `0.01` (costo por gramo)
- `unit_cost_presentation` = `10.0` (costo por kilogramo)
- `uom_name` = `'Kg'` (sobrescrita por el nombre de la presentación)

Actualmente, al consultar la orden, el frontend renderiza `qty_ordered_base` junto a `uom_name`, lo que resulta en una visualización incoherente de **"10,000 Kg"** a un costo de **"$0.01"**, en lugar de los reales **"10 Kg"** a **"$10.00"**.

---

## 2. Enfoque Seleccionado: Campos de Conveniencia en el Backend (DRY)

Para evitar duplicar la lógica condicional en múltiples lugares del frontend (listados, fichas técnicas de detalle, y la plantilla del PDF de compras del Milestone 27), el backend proveerá campos calculados de conveniencia en la respuesta JSON de las líneas de la orden:
- `display_qty`: cantidad en presentación si está definida, o cantidad base.
- `display_unit_cost`: costo en presentación si está definido, o costo base.

---

## 3. Cambios Propuestos

### 3.1 Backend - Esquemas (`backend/app/purchasing/schemas.py`)
Añadir a `PurchaseOrderLineResponse`:
```python
class PurchaseOrderLineResponse(BaseModel):
    # ... campos existentes ...
    display_qty: float
    display_unit_cost: float
```

### 3.2 Backend - Enrutador (`backend/app/purchasing/router.py`)
En las funciones de hidratación de líneas dentro de `get_purchase_order_by_id_internal` y `list_purchase_orders`, poblar los nuevos campos dinámicos:
```python
for line in lines_data:
    # Lógica existente...
    if line.get("presentation_id"):
        line["display_qty"] = line.get("qty_ordered_presentation") or line["qty_ordered_base"]
        line["display_unit_cost"] = line.get("unit_cost_presentation") or line["unit_cost_base"]
    else:
        line["display_qty"] = line["qty_ordered_base"]
        line["display_unit_cost"] = line["unit_cost_base"]
```

### 3.3 Frontend - Interfaces de la API (`frontend/src/lib/api/purchasing.ts`)
Actualizar la interfaz de respuesta para reflejar los campos del backend:
```typescript
export interface PurchaseOrderLineResponse {
    // ... campos existentes ...
    display_qty: number;
    display_unit_cost: number;
}
```

### 3.4 Frontend - Vista de Detalle (`frontend/src/app/admin/purchasing/orders/[id]/page.tsx`)
Reemplazar el renderizado de la cantidad y costo en la tabla de líneas de la orden:
```html
<td className="py-4 px-4 text-right font-mono text-text-primary">
  {line.display_qty} <span className="text-[10px] text-text-secondary uppercase">({line.status === 'pending' ? 'Pedida' : line.status})</span>
</td>
<td className="py-4 px-4 text-center text-text-secondary font-bold text-xs uppercase">
  {line.uom_name || 'und'}
</td>
<td className="py-4 px-4 text-right font-mono text-text-primary">
  ${line.display_unit_cost.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
</td>
```

### 3.5 PDF de Órdenes de Compra (Milestone 27)
Cuando se codifique la plantilla del PDF de compras, se utilizarán exclusivamente `line.display_qty` y `line.display_unit_cost` para construir las columnas de cantidad y costo, garantizando coherencia visual del documento exportado.

---

## 4. Plan de Pruebas

1.  **Pruebas Unitarias del Backend:**
    - Verificar que al crear o consultar una orden con unidades de presentación, los campos `display_qty` y `display_unit_cost` en el JSON de respuesta contengan los valores de presentación correspondientes.
    - Ejecutar la suite de tests `tests/test_purchase_orders.py` y verificar éxito.
2.  **Verificación de Tipos en el Frontend:**
    - Correr `npx tsc --noEmit` en `frontend/` para asegurar compatibilidad.
