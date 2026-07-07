# Selector de Método de Valoración en Snapshot de Inventario

**Fecha:** 2026-07-07
**Alcance:** Solo la página de Historial de Inventario (`/admin/inventory/snapshot`)

---

## Problema

La tarjeta "Valoración Histórica (PEPS)" en el Snapshot muestra $0 para artículos que tienen un `last_purchase_cost` registrado pero no tienen movimientos de stock (`stock_movements`) con `total_cost` poblado. Esto ocurre porque la valoración PEPS se calcula sumando `total_cost` de los movimientos, no usando el precio del artículo.

## Solución

Agregar un parámetro `valuation_method` al endpoint de snapshot y un toggle en la interfaz que permita al usuario escoger entre dos métodos de valoración:

1. **PEPS** (default): Comportamiento actual — `valuation = sum(total_cost)` de `stock_movements` hasta la fecha.
2. **Último Costo**: `valuation = qty_on_hand × last_purchase_cost` del artículo en la tabla `items`.

---

## Diseño Backend

### Endpoint: `GET /inventory/snapshot`

**Nuevo query parameter:**

| Param | Tipo | Default | Valores |
|---|---|---|---|
| `valuation_method` | string | `peps` | `peps`, `last_cost` |

**Lógica por método:**

**`peps` (sin cambios):**
- Agrupa `stock_movements` por `(item_id, warehouse_id)` donde `created_at <= fecha_fin_del_día`.
- `qty_on_hand = sum(qty_base)`
- `valuation = sum(total_cost)`

**`last_cost`:**
- Calcula `qty_on_hand` igual que PEPS (sumando `qty_base` de movimientos).
- Obtiene `last_purchase_cost` de la tabla `items` para cada artículo.
- `valuation = qty_on_hand × last_purchase_cost`.
- Si `last_purchase_cost` es `null` o `0`, la valoración del artículo queda en `$0`.

**Response actualizado:**
Se agrega el campo `valuation_method` al response para que el frontend confirme qué método se usó.

```python
class StockSnapshotResponse(BaseModel):
    date: str
    valuation_method: str  # "peps" | "last_cost" — NUEVO
    items: List[StockSnapshotItem]
    total_valuation: float
```

### Archivo: `backend/app/production/router.py`

En la función `get_inventory_snapshot` (línea ~466):
- Agregar parámetro `valuation_method: str = "peps"` con validación de valores permitidos.
- Después de calcular `qty_on_hand` para cada grupo, aplicar la lógica de valoración según el método:
  - Si `peps`: mantener el cálculo actual (`sum(total_cost)`).
  - Si `last_cost`: hacer un query a `items` para obtener `last_purchase_cost` y multiplicar por `qty_on_hand`. Solo se necesita un query adicional a `items` (que ya se hace en la línea 477 para obtener nombre/código). Se reutiliza ese mismo query agregando `last_purchase_cost` al select.

### Archivo: `backend/app/production/schemas.py`

Agregar `valuation_method: str` al modelo `StockSnapshotResponse`.

---

## Diseño Frontend

### Archivo: `frontend/src/lib/api.ts`

Actualizar `getInventorySnapshot` para aceptar y pasar `valuation_method`:

```typescript
getInventorySnapshot(date: string, warehouseId?: string, valuationMethod?: string)
```

Actualizar `StockSnapshotResponse` para incluir `valuation_method: string`.

### Archivo: `frontend/src/app/admin/inventory/snapshot/page.tsx`

**Nuevo estado:**
```typescript
const [valuationMethod, setValuationMethod] = useState<'peps' | 'last_cost'>('peps')
```

**Toggle UI:**
Un segmented control (estilo idéntico al toggle "Agrupar por" existente) ubicado en la barra de herramientas (toolbar) junto al buscador y al agrupador. Opciones:
- `PEPS` (seleccionado por defecto)
- `Último Costo`

**Cambio en la tarjeta resumen:**
La etiqueta de la tercera tarjeta cambia dinámicamente:
- Cuando `peps`: **"Valoración Histórica (PEPS)"**
- Cuando `last_cost`: **"Valoración a Último Costo"**

**Cambio en la tabla:**
El header de la columna de valoración cambia:
- Cuando `peps`: **"Valoración ($)"**
- Cuando `last_cost`: **"Val. Último Costo ($)"**

**Cambio en el CSV:**
El header de la columna exportada refleja el método seleccionado.

**Disparo de la consulta:**
`valuationMethod` se agrega como dependencia del `useEffect` que llama a `loadSnapshot()`. Al cambiar el toggle, se recarga la data desde el backend.

---

## Casos borde

| Caso | Comportamiento |
|---|---|
| Artículo sin `last_purchase_cost` (null) en modo `last_cost` | Valoración = $0.00 |
| Artículo con `qty_on_hand` negativo en modo `last_cost` | Valoración = qty_on_hand × last_purchase_cost (puede ser negativa) |
| Artículo sin movimientos en modo `peps` | Valoración = $0.00 (comportamiento actual) |

---

## Fuera de alcance

- No se aplica a la página de Valorización actual (`/inventory/valuation`).
- No se aplica al dashboard de inventario.
- No se persiste la preferencia del usuario (se resetea a PEPS al recargar).
- No se agrega un tercer método de valoración (promedio ponderado, etc.).
