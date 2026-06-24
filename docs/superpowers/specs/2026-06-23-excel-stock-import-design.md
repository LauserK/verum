# Diseño de Importador de Stock desde Excel

Este documento describe la especificación de diseño para agregar la funcionalidad de **Importación Masiva de Stock** a la utilidad de importación de inventario (`/admin/inventory/import-utility`).

---

## 1. Objetivo y Casos de Uso
Permitir a los administradores inicializar o ajustar el stock físico de múltiples artículos a la vez subiendo un archivo Excel.

**Casos de uso principales:**
* **Inicialización:** Cargar el inventario físico inicial al configurar la aplicación.
* **Ajuste / Auditoría:** Sincronizar el inventario físico tomado en tienda con el inventario teórico del sistema a través de movimientos de ajuste en el Kardex.

---

## 2. Interfaz de Usuario y UX (Frontend)

### Estructura de Pestañas
La página `/admin/inventory/import-utility` se dividirá en dos pestañas:
1. **Importar Catálogo:** El flujo existente de importación de definiciones de artículos (Columnas A, B, C, K).
2. **Importar Stock Inicial:** Nueva pestaña para carga de stock físico.

### Pantalla de Importar Stock Inicial
* **Selector de Almacén:** Dropdown obligatorio. Carga la lista de almacenes activos de la organización.
* **Carga de Excel:** Dropdown o área drag-and-drop.
* **Formato del archivo:**
  * **Columna A:** Código del artículo
  * **Columna B:** Cantidad física actual (si está en blanco se asume `0.0`)
* **Tabla de Vista Previa:**
  * **Estado:** Pendiente (`pending`), Éxito (`success`), o Error (`error`) con tooltip detallado.
  * **Código:** El código leído del Excel.
  * **Artículo:** Nombre descriptivo cargado automáticamente haciendo coincidir el código con el catálogo de artículos existentes. Si el código no existe, se muestra `"Artículo no registrado"` en rojo.
  * **Cantidad a Ajustar:** La cantidad ingresada en el Excel (o `0.0` si estaba vacía).
* **Acciones:**
  * Botón **"Ejecutar Carga de Stock"**: Envía la lista de ajustes al nuevo endpoint del backend. Muestra barra de progreso y actualiza el estado de cada fila según el resultado.

---

## 3. Endpoints y Lógica de Negocio (Backend)

### Endpoint de Ajuste Masivo
* **Ruta:** `POST /inventory/bulk-adjust-stock`
* **Permiso requerido:** `inventory.audit_count`

### Modelos de Datos (Schemas)
```python
class StockAdjustItem(BaseModel):
    item_code: str
    qty_counted: float

class BulkStockAdjustRequest(BaseModel):
    warehouse_id: UUID
    adjustments: List[StockAdjustItem]

class StockAdjustResult(BaseModel):
    item_code: str
    status: str  # "success" o "error"
    error_message: Optional[str] = None
    qty_expected: Optional[float] = None
    qty_counted: Optional[float] = None
    difference: Optional[float] = None

class BulkStockAdjustResponse(BaseModel):
    results: List[StockAdjustResult]
```

### Lógica de Procesamiento (Paso a Paso)
Para cada fila en `adjustments` recibida por el backend:
1. **Validación de Código:** Busca el artículo en la tabla `items` por `code` y `org_id` activo. Si no existe, genera un resultado con error.
2. **Obtención de Stock Teórico:** Busca en la tabla `stock` la cantidad actual (`qty_expected`) en el almacén especificado. Si no existe registro de stock previo, asume `0.0`.
3. **Cálculo de Diferencia:** `diferencia = qty_counted - qty_expected`.
4. **Procesamiento de Movimiento:**
   * **Si `diferencia == 0`:** Omite el procesamiento para evitar transacciones vacías.
   * **Si `diferencia > 0` (Ajuste de Entrada):**
     * Obtiene el costo del artículo (`last_purchase_cost` de la tabla `items`, o `0.0` si es nulo).
     * Crea un lote nuevo en `stock_lots` con `qty_base = diferencia`, `unit_cost_base = costo` y `lot_number = "AJUSTE-IMPORTACION"`.
     * Registra un movimiento en `stock_movements` con `movement_type = "adjustment_in"`.
     * Actualiza o inserta la cantidad final en `stock`.
   * **Si `diferencia < 0` (Ajuste de Salida):**
     * Obtiene los lotes activos (con cantidad > 0) del artículo y almacén en orden cronológico (`received_at` asc).
     * Consume la cantidad necesaria restándola de los lotes (`qty_base`) y marcándolos como agotados (`is_exhausted = true`) si llega a cero.
     * Registra movimientos en `stock_movements` con `movement_type = "adjustment_out"` y los costos reales de cada lote consumido.
     * Reduce la cantidad general en la tabla `stock` para reflejar la cantidad física.

---

## 4. Pruebas y Criterios de Aceptación
* **Prueba 1: Catálogo sin Stock:** Importar artículos en la pestaña 1 funciona exactamente igual sin alterar el stock.
* **Prueba 2: Ajuste Positivo:** Un artículo con stock actual `10.0` e importado con `15.0` debe crear un lote por `5.0` con el `last_purchase_cost` del artículo y registrar un movimiento `adjustment_in`.
* **Prueba 3: Ajuste Negativo (PEPS):** Un artículo con dos lotes de stock (`10.0 @ $1` y `10.0 @ $2`) e importado con `12.0` (diferencia de `-8.0`) debe consumir `8.0` del primer lote (quedando en `2.0 @ $1`), y registrar un movimiento `adjustment_out` con costo base `$1`.
* **Prueba 4: Cantidad Vacía:** Si un artículo viene en el Excel pero con celda de cantidad vacía, el sistema debe ajustar su stock a `0.0`.
