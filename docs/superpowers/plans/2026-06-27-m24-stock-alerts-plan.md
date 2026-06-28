# Plan de Implementación — Milestone 24: Previsión de Inventario y Alertas de Desabastecimiento

Este plan detalla los pasos para implementar el **Milestone 24** de forma secuencial y probada.

---

## Mapa de Archivos a Modificar / Crear

*   **Base de Datos (SQL Migraciones)**:
    *   Crear: `backend/migrations/042_item_min_stock.sql`
*   **Backend Core**:
    *   Modificar: `backend/schemas.py` (Modelos Pydantic de artículos y alertas)
    *   Modificar: `backend/main.py` (Endpoints de reservas en OP y endpoint de alertas)
*   **Pruebas Backend**:
    *   Crear: `backend/tests/test_m24_stock_alerts.py` (Validación de lógica de reservas e integración)
*   **Frontend**:
    *   Modificar: `frontend/src/lib/api.ts` (API Client de Next.js y tipos)
    *   Modificar: `frontend/src/app/admin/inventory/items/page.tsx` (Configurar `min_stock` en formulario de catálogo)
    *   Modificar: `frontend/src/app/admin/inventory/items/[id]/page.tsx` (Visualizar stock Físico, Reservado y Disponible)
    *   Modificar: `frontend/src/app/admin/inventory/page.tsx` (Dashboard de Alertas de Desabastecimiento)

---

## Tareas de Implementación

### Tarea 1: Migración SQL de Base de Datos
- [ ] **Paso 1.1: Crear archivo de migración**
  Crear el archivo `backend/migrations/042_item_min_stock.sql` para añadir la columna `min_stock` a la tabla `items` con valor por defecto `0.0`.

---

### Tarea 2: Schemas del Backend
- [ ] **Paso 2.1: Actualizar esquemas de Artículos**
  En `backend/schemas.py`, añadir la variable `min_stock: float = 0.0` a las clases `ItemResponse`, `ItemCreate` e `ItemUpdate`.
- [ ] **Paso 2.2: Crear el esquema de Alerta de Desabastecimiento**
  Añadir el modelo `LowStockAlertItem` en `backend/schemas.py`.

---

### Tarea 3: Endpoints y Lógica del Backend
- [ ] **Paso 3.1: Incrementar reservas al crear órdenes**
  Modificar `create_production_order` (`POST /production/orders`) para calcular los ingredientes requeridos y sumar la cantidad planificada a `stock.qty_reserved` en el almacén origen de producción.
- [ ] **Paso 3.2: Revertir reservas al cancelar órdenes**
  Modificar `update_production_order_status` (`PATCH /production/orders/{order_id}/status`) para que si la orden cambia de un estado activo (`pending`, `in_progress`, `paused`) a `"cancelled"`, se reste la cantidad planificada de ingredientes de `stock.qty_reserved` usando la fórmula `max(0.0, current_reserved - planned_qty)`.
- [ ] **Paso 3.3: Revertir reservas al completar órdenes**
  Modificar `complete_production_order` (`POST /production/orders/{order_id}/complete`) para restar la cantidad planificada de ingredientes de `stock.qty_reserved` en el almacén origen cuando se completa la orden con éxito.
- [ ] **Paso 3.4: Crear endpoint de alertas de bajo stock**
  Crear el endpoint `GET /inventory/alerts/low-stock` en `backend/main.py`. Este endpoint filtrará todos los registros de la tabla `stock` donde la diferencia `qty_base - qty_reserved` sea inferior a `items.min_stock`.

---

### Tarea 4: Pruebas Unitarias del Backend
- [ ] **Paso 4.1: Escribir archivo de pruebas**
  Crear `backend/tests/test_m24_stock_alerts.py` implementando pruebas de integración que validen:
  * El incremento correcto de `qty_reserved` tras crear una orden.
  * El descuento de `qty_reserved` tras cancelar la orden.
  * El descuento de `qty_reserved` tras completar la orden.
  * El retorno correcto de alertas en `GET /inventory/alerts/low-stock`.
- [ ] **Paso 4.2: Ejecutar y pasar pruebas con pytest**
  Correr `pytest tests/test_m24_stock_alerts.py` en el backend para verificar el correcto funcionamiento.

---

### Tarea 5: Integración del Cliente API del Frontend
- [ ] **Paso 5.1: Actualizar tipos e interfaces**
  Modificar `frontend/src/lib/api.ts` para incluir `min_stock?: number` en el tipo `InventoryItem`.
- [ ] **Paso 5.2: Registrar llamada del endpoint de alertas**
  Registrar `getLowStockAlerts(warehouseId?: string)` en el objeto `adminApi` en `frontend/src/lib/api.ts`.

---

### Tarea 6: Interfaz del Catálogo de Artículos
- [ ] **Paso 6.1: Añadir campo al formulario de artículos**
  En `frontend/src/app/admin/inventory/items/page.tsx`, añadir la variable `min_stock: 0` al hook de `formData`, crear el input de entrada para stock mínimo en el Modal y gestionar su envío en `handleSave`.
- [ ] **Paso 6.2: Mostrar columna de stock mínimo**
  Añadir la columna "Stock Mín." a la cabecera de la tabla y renderizar el valor de `item.min_stock` en el componente `Row`.

---

### Tarea 7: Detalle del Artículo y Desglose de Existencias
- [ ] **Paso 7.1: Mostrar 3 columnas en la sección de Stock por Almacén**
  En `frontend/src/app/admin/inventory/items/[id]/page.tsx`, modificar la visualización de stock por almacén para mostrar de forma desglosada: Físico, Reservado y Disponible.
- [ ] **Paso 7.2: Agregar distintivo visual en Disponible**
  Mostrar la cantidad disponible resaltada en rojo o con un icono de advertencia en caso de que esté por debajo del stock mínimo o en negativo.

---

### Tarea 8: Dashboard de Alertas de Desabastecimiento
- [ ] **Paso 8.1: Renderizar alertas en el Dashboard principal**
  En `frontend/src/app/admin/inventory/page.tsx`, cargar las alertas del endpoint de desabastecimiento y renderizar un bloque ordenado por criticidad (defecto negativo en rojo primero, y luego advertencias bajo mínimo en naranja).
