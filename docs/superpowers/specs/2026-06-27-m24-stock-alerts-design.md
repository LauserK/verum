# Milestone 24 — Previsión de Inventario y Alertas de Desabastecimiento (Diseño)

Este documento define la especificación técnica para la implementación del **Milestone 24-PRD**. Introduce la capacidad de configurar un stock mínimo de seguridad por artículo, reservar ingredientes de forma automatizada al crear órdenes de producción, y generar un panel de alertas accionables cuando el stock disponible caiga por debajo de la reserva mínima configurada.

---

## 1. Reglas de Negocio y Lógica de Reserva

Para garantizar la precisión de la planificación física e impedir que múltiples órdenes asuman la disponibilidad de los mismos insumos, el inventario se desglosará de la siguiente manera:

1.  **Métricas de Stock por Almacén:**
    *   **Stock Físico (`qty_base`):** La cantidad física real contada en el depósito.
    *   **Stock Reservado (`qty_reserved`):** La cantidad de ingredientes comprometida para órdenes de producción activas que aún no se han completado ni cancelado.
    *   **Stock Disponible (Neto):** Calculado dinámicamente como `Stock Físico - Stock Reservado`. Puede ser negativo (indicando un déficit de materia prima).

2.  **Lógica del Ciclo de Vida de Reservas:**
    *   **Creación de Orden (OP en estado `pending`):**
        *   Se calcula la cantidad base requerida de cada ingrediente escalando la receta (`recipe_ingredients`).
        *   Para cada ingrediente, se incrementa el valor de `qty_reserved` en la tabla `stock` para el almacén origen de producción.
        *   Si no existe un registro en `stock` para ese almacén e ingrediente, se crea automáticamente con `qty_base = 0` y `qty_reserved = cantidad_requerida`.
    *   **Cancelación de Orden (`status` cambia a `cancelled`):**
        *   Se restan los ingredientes planificados de `qty_reserved` en la tabla `stock`.
        *   Se utiliza la fórmula `max(0, qty_reserved - qty_planned)` para evitar residuos o inconsistencias decimales de punto flotante.
    *   **Completar Orden (`status` cambia a `completed`):**
        *   Se restan los ingredientes planificados de `qty_reserved` en `stock` (liberando el compromiso físico) al mismo tiempo que el consumo real descuenta el stock real (`qty_base`).

3.  **Alerta de Desabastecimiento:**
    *   Se configura un **Stock Mínimo (`min_stock`)** a nivel de catálogo de artículos.
    *   Un artículo genera una alerta crítica de desabastecimiento si: `Stock Disponible < min_stock`.
    *   Si no se define un stock mínimo (por defecto `0.0`), la alerta se comporta como **Déficit Real**, disparándose únicamente cuando el disponible cae en negativo (menos que `0.0`), lo que significa que no hay suficiente materia prima física para completar las órdenes de producción programadas.

---

## 2. Cambios en Base de Datos

Se creará una nueva migración `backend/migrations/042_item_min_stock.sql` con el siguiente contenido:

```sql
-- Agregar columna de stock mínimo al catálogo de artículos
ALTER TABLE items ADD COLUMN min_stock NUMERIC(18, 6) NOT NULL DEFAULT 0.0;
```

---

## 3. Endpoints del Backend

### Modificaciones en Schemas (`backend/schemas.py`)
1.  **`ItemResponse` / `ItemCreate` / `ItemUpdate`:** Agregar el campo `min_stock: float = 0.0`.
2.  **`StockResponse` / `WarehouseStockResponse`:** Asegurar que `qty_reserved` se devuelva en la API (actualmente ya está en la base de datos).
3.  **`LowStockAlertItem` (Nuevo Schema):**
    ```python
    class LowStockAlertItem(BaseModel):
        item_id: UUID
        item_name: str
        item_code: Optional[str]
        uom_code: str
        warehouse_name: str
        qty_base: float      # Físico
        qty_reserved: float  # Reservado
        qty_available: float # Disponible (Físico - Reservado)
        min_stock: float     # Stock mínimo de seguridad
    ```

### Modificaciones en Rutas (`backend/main.py`)
1.  **`POST /production/orders`**:
    *   Al insertar los registros en `production_order_consumptions`, actualizar `stock.qty_reserved` para cada ingrediente sumando `qty_planned_base`.
2.  **`PATCH /production/orders/{order_id}/status`**:
    *   Si la orden cambia a `"cancelled"`, verificar que su estado anterior fuera activo (`pending`, `in_progress`, `paused`) y restar la cantidad planificada de ingredientes de `stock.qty_reserved`.
3.  **`POST /production/orders/{order_id}/complete`**:
    *   En la ejecución exitosa de la transacción, restar la cantidad planificada de ingredientes de `stock.qty_reserved`.
4.  **`GET /inventory/alerts/low-stock` (Nuevo Endpoint):**
    *   Filtra los registros de `stock` uniendo con `items`.
    *   Devuelve una lista de `LowStockAlertItem` donde `(qty_base - qty_reserved) < items.min_stock` para los artículos activos de la organización.

---

## 4. Cambios en el Frontend

### 1. Formulario de Artículos ([items/page.tsx](file:///C:/Users/kilda/PROYECTOS/Verum/frontend/src/app/admin/inventory/items/page.tsx))
*   Se añade un input de tipo numérico decimal en el modal de creación y edición para el campo **Stock Mínimo**.
*   Se añade la columna **Stock Mín.** al listado principal de la tabla de catálogo.

### 2. Detalle del Artículo ([items/[id]/page.tsx](file:///C:/Users/kilda/PROYECTOS/Verum/frontend/src/app/admin/inventory/items/%5Bid%5D/page.tsx))
*   En la sección de existencias por depósito, se reemplaza la visualización plana por una tabla o tarjetas con 3 columnas claras:
    *   **Físico** (Stock Real)
    *   **Reservado** (Comprometido)
    *   **Disponible** (Neto para uso)
*   Se destaca el disponible en rojo si es negativo o menor al stock mínimo configurado.

### 3. Dashboard Principal de Inventario ([page.tsx](file:///C:/Users/kilda/PROYECTOS/Verum/frontend/src/app/admin/inventory/page.tsx))
*   Se agrega la sección **Alertas de Desabastecimiento** en la vista general.
*   Carga las alertas desde `/inventory/alerts/low-stock` mostrando tarjetas con advertencia crítica si el stock disponible es negativo (déficit real de producción) o preventivo si está por debajo del stock mínimo.

---

## 5. Plan de Pruebas Unitarias

Se implementará el archivo `backend/tests/test_m24_stock_alerts.py` para probar la lógica de forma aislada:
1.  **Test de Reserva en Creación:** Crear una orden de producción y verificar que `qty_reserved` de los ingredientes se incremente en la cantidad correspondiente.
2.  **Test de Liberación en Cancelación:** Cancelar una orden de producción y validar que `qty_reserved` retorne a su valor original.
3.  **Test de Liberación en Completado:** Completar una orden de producción y verificar que `qty_reserved` se reduzca.
4.  **Test de Endpoint de Alertas:** Configurar un artículo con stock disponible inferior al stock mínimo y validar que aparezca en el listado de `GET /inventory/alerts/low-stock`.
