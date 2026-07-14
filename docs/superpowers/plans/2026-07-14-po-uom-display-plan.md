# Plan de Implementación: Visualización de Unidades de Presentación en Compras

Este plan describe las tareas necesarias para implementar la visualización correcta de cantidades y costos unitarios basados en la presentación de compra seleccionada en la vista de detalle de la Orden de Compra (PO).

---

## Fase 1: Backend (FastAPI)

1.  **Actualizar Esquema de la Línea (`backend/app/purchasing/schemas.py`):**
    - [ ] Agregar las propiedades calculadas `display_qty: float` y `display_unit_cost: float` a `PurchaseOrderLineResponse`.

2.  **Calcular Campos en el Enrutador (`backend/app/purchasing/router.py`):**
    - [ ] Actualizar la función `get_purchase_order_by_id_internal` para calcular `display_qty` y `display_unit_cost` para cada línea recuperada.
    - [ ] Actualizar la función `list_purchase_orders` para hacer el mismo cálculo para las líneas de la lista de órdenes devuelta.

---

## Fase 2: Frontend (Next.js - Cliente API)

1.  **Actualizar Interfaces del Cliente (`frontend/src/lib/api/purchasing.ts`):**
    - [ ] Agregar `display_qty: number` y `display_unit_cost: number` a la interfaz `PurchaseOrderLineResponse`.

---

## Fase 3: Frontend (Next.js - Vistas)

1.  **Actualizar Ficha de Detalle de la PO (`frontend/src/app/admin/purchasing/orders/[id]/page.tsx`):**
    - [ ] Reemplazar la renderización de la cantidad de la línea (`qty_ordered_base`) por `display_qty`.
    - [ ] Reemplazar la renderización del costo unitario de la línea (`unit_cost_base`) por `display_unit_cost`.

---

## Criterios de Aceptación

1.  **Consistencia de Datos:**
    - Al crear una PO de un artículo con presentación (ej: 10 Kg de Harina, donde 1 Kg = 1000g), en la pantalla de detalle se debe mostrar `10` en la columna de cantidad y `Kg` en la columna de unidad.
    - El costo unitario mostrado debe ser el correspondiente a la presentación (ej: `$10.00`) y no al costo base por gramo (`$0.01`).
    - El subtotal de la línea y el total global deben seguir sumando de forma correcta y precisa.
2.  **Verificación de Tipos:**
    - `npx tsc --noEmit` en el frontend debe compilar limpiamente.
3.  **Pruebas Unitarias:**
    - Correr `pytest` en la suite de compras del backend y comprobar que todas pasen con éxito.
