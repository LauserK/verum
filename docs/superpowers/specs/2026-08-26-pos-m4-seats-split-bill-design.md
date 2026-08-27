# Especificación de Diseño: Milestone 4 — Servicio de Mesa, Asientos, División de Cuentas y Flujo Abierto

**Fecha:** 2026-08-26
**Módulo:** POS (Point of Sale)
**Dependencia:** Milestone 3 completado (Checkout Multimoneda, Stock, Customer Selector)
**Spec padre:** `2026-08-23-pos-module-design.md`

---

## 1. Alcance

Este milestone cubre todo lo necesario para operar un servicio de mesa completo con gestión de asientos, división de cuentas, y flujo de órdenes abiertas para todos los modos de venta:

- Asientos (Seats): asignación de items a posiciones de mesa con tabs en el carrito
- División de cuentas (Split Bill): cobro por asientos, partes iguales o selección manual de items
- Pre-cuenta: documento no fiscal imprimible con desglose por asientos
- Transferencia de mesas: mover comanda completa, items individuales o asientos entre mesas
- Fusión de mesas: consolidar dos cuentas en una sola mesa destino
- Órdenes abiertas Delivery/Pick-up: enviar a cocina con pago pendiente
- Estados visuales ampliados en el mapa de mesas: libre, ocupada (con timer), cuenta pedida
- Menú contextual de mesa para acciones rápidas

**Fuera de alcance (Milestone 5):** Integración con spooler de hardware, impresora fiscal, centro de notificaciones de errores de hardware.

---

## 2. Modelo de Datos y Migraciones

### 2.1 Extensión de `pos_table_orders`

```sql
-- Seats metadata
ALTER TABLE pos_table_orders
  ADD COLUMN IF NOT EXISTS seats JSONB NOT NULL DEFAULT '[]'::JSONB;

-- Mesero asignado
ALTER TABLE pos_table_orders
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Pre-cuenta
ALTER TABLE pos_table_orders
  ADD COLUMN IF NOT EXISTS pre_bill_requested_at TIMESTAMPTZ;

-- Timer de ocupación
ALTER TABLE pos_table_orders
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW();

-- Auditoría de fusiones
ALTER TABLE pos_table_orders
  ADD COLUMN IF NOT EXISTS merged_from UUID[];

-- Delivery/Pick-up con pago pendiente
ALTER TABLE pos_table_orders
  ADD COLUMN IF NOT EXISTS payment_pending BOOLEAN DEFAULT false;

-- Ampliar estados para incluir 'pre_bill'
ALTER TABLE pos_table_orders
  DROP CONSTRAINT IF EXISTS pos_table_orders_status_check;
ALTER TABLE pos_table_orders
  ADD CONSTRAINT pos_table_orders_status_check
  CHECK (status IN ('active', 'pre_bill', 'billed', 'cancelled'));
```

### 2.2 Estructura del `seats` JSONB

```json
[
  { "id": "seat-1", "label": "Asiento 1" },
  { "id": "seat-2", "label": "Pedro" }
]
```

### 2.3 Estructura del `cart` JSONB (extendido)

```json
[
  {
    "cartItemId": "uuid",
    "id": "sale_item_uuid",
    "name": "Hamburguesa",
    "price": 12.50,
    "quantity": 1,
    "seat": "seat-1",
    "tax_id": "uuid",
    "tax_rate": 16,
    "tax_included": true,
    "notes": "sin cebolla",
    "sentToKitchen": false
  }
]
```

El campo `seat` es nullable. Items sin asiento pertenecen al pool general (visible en el tab "Todos").

### 2.4 Extensión de `payments`

Preparado en M3, ahora se aplica:

```sql
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS seat_label TEXT,
  ADD COLUMN IF NOT EXISTS covered_items UUID[];
```

- `seat_label`: etiqueta del asiento cobrado (ej: "Pedro"). Informativo para reportes.
- `covered_items`: array de `cartItemId` cubiertos por este pago. Permite reconstruir qué items se pagaron en cada ronda.

### 2.5 Extensión de `invoices`

```sql
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS table_order_id UUID REFERENCES pos_table_orders(id) ON DELETE SET NULL;
```

Vincula la factura con la orden de mesa para el flujo de pagos parciales. La factura se crea una vez al primer pago parcial y se reutiliza hasta cubrir el total.

### 2.6 Tabla de auditoría de transferencias

```sql
CREATE TABLE IF NOT EXISTS pos_transfer_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_table_id TEXT NOT NULL,
  target_table_id TEXT NOT NULL,
  transfer_type TEXT CHECK (transfer_type IN ('full', 'items', 'seat', 'merge')),
  items_transferred JSONB,
  performed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pos_transfer_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members full access" ON pos_transfer_log;
CREATE POLICY "Org members full access" ON pos_transfer_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Registro de auditoría para trazabilidad de movimientos entre mesas. No afecta flujo operativo.

### 2.7 Validación Pydantic del cart JSONB

Garantiza congruencia entre cualquier cliente (web, mobile futuro):

```python
class CartItemSchema(BaseModel):
    cartItemId: str
    id: str
    name: str
    price: Decimal
    quantity: int = Field(ge=1)
    seat: Optional[str] = None
    sentToKitchen: bool = False
    tax_id: Optional[str] = None
    tax_rate: Optional[Decimal] = None
    tax_included: bool = True
    notes: Optional[str] = None
    category_id: Optional[str] = None

class SeatSchema(BaseModel):
    id: str
    label: str = Field(max_length=50)

class TableOrderUpdate(BaseModel):
    cart: Optional[List[CartItemSchema]] = None
    seats: Optional[List[SeatSchema]] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_tax_id: Optional[str] = None
```

Cualquier cliente que envíe un cart malformado recibe `422 Validation Error`.

---

## 3. Asientos (Seats) — Store y UI

### 3.1 Cambios en el Store Zustand (`posStore.ts`)

**Nuevos tipos:**

```typescript
export interface Seat {
  id: string       // "seat-1", "seat-2", etc.
  label: string    // "Asiento 1", "Pedro", etc.
}

export interface CartItem {
  // ... campos existentes
  seat?: string | null      // ID del asiento asignado
  sentToKitchen?: boolean   // Item ya enviado a cocina (bloqueado)
}

export interface PosCartContext {
  // ... campos existentes
  seats: Seat[]
}
```

**Nuevo estado y acciones:**

```typescript
// Estado
activeSeatId: string | null  // Tab activo ('all' = vista todos, null = sin seats)

// Acciones
setActiveSeat: (seatId: string | null) => void
addSeat: (label?: string) => void
removeSeat: (seatId: string) => void
renameSeat: (seatId: string, label: string) => void
moveItemToSeat: (cartItemId: string, targetSeatId: string | null) => void
```

### 3.2 Asignación automática de items

Cuando el mesero agrega un producto del catálogo, se asigna automáticamente al asiento/tab seleccionado:

- Si `activeSeatId` apunta a un asiento concreto → el item recibe `seat: activeSeatId`
- Si `activeSeatId === 'all'` → el item se asigna al último asiento del array `seats`
- Si no hay asientos (modos rápidos) → `seat: null`

### 3.3 Inicialización de asientos

- **Modo `tables`:** Al abrir una mesa nueva (sin orden previa), se crea automáticamente `[{ id: "seat-1", label: "Asiento 1" }]` y se selecciona como tab activo.
- **Otros modos (takeout, bar, delivery, pickup):** No se crean asientos. El concepto no aplica. Los tabs no se muestran.

### 3.4 UI del carrito con asientos (`PosCart.tsx`)

Tabs de asientos solo visibles en modo `tables`:

```
┌─────────────────────────────────────┐
│ 🧑 Cliente: María López  ✏️         │
├─────────────────────────────────────┤
│ [Todos] [Asiento 1] [Pedro]  [＋]  │  ← Tabs de asientos
├─────────────────────────────────────┤
│  🍔 Hamburguesa Classic    x1  $12 │
│     sin cebolla                     │
│  🥤 Coca-Cola              x2   $6 │
├─────────────────────────────────────┤
│  Subtotal              $18.00       │
│  IVA 16%                $2.88       │
│  TOTAL                 $20.88       │
├─────────────────────────────────────┤
│  [📋 Pre-cuenta]    [💰 Cobrar]    │
└─────────────────────────────────────┘
```

**Interacciones de los tabs:**

| Acción | Comportamiento |
|---|---|
| Tap en tab | Filtra el carrito mostrando solo items de ese asiento. `activeSeatId` se actualiza. |
| Tap en "Todos" | Muestra todos los items agrupados por asiento con separadores que incluyen el label y subtotal del asiento. |
| Tap en "＋" | Crea nuevo asiento con nombre auto-incremental ("Asiento 3"). Se selecciona automáticamente. |
| Long-press o doble-tap en tab | Abre input inline para renombrar (ej: "Asiento 2" → "Pedro"). |
| Swipe izquierdo en tab (o botón ×) | Elimina el asiento si está vacío. Si tiene items, confirmación: "¿Mover items a Asiento 1?" → items huérfanos van al primer asiento. |

**Vista "Todos" con separadores:**

```
── Asiento 1 ──────────── $18.00
  🍔 Hamburguesa           x1  $12
  🥤 Coca-Cola             x2   $6

── Pedro ──────────────── $5.00
  🍟 Papas Grandes         x1   $5
```

**Mover item entre asientos:** En la vista "Todos", cada item tiene un mini-badge con el nombre del asiento. Tap en el badge → popover con la lista de asientos disponibles para reasignar.

### 3.5 Items enviados a cocina (bloqueados)

Cuando el mesero presiona "Enviar a Cocina", los items con `sentToKitchen: false` se marcan como `true`:

- Fondo con opacidad reducida e ícono ✓ a la izquierda
- No se puede eliminar sin permiso `sales.void_sent_items`
- La cantidad no se puede reducir (sí aumentar — se agrega una nueva línea draft)

---

## 4. Mapa de Mesas — Estados, Timer, Transferir y Unir

### 4.1 Estados visuales en `PosTableMap.tsx`

Tres estados derivados de la data de `pos_table_orders`:

| Estado | Color | Condición | Info mostrada |
|---|---|---|---|
| **Libre** | Verde (`emerald-500`) | No hay `table_order` activa | Capacidad (`4p`) |
| **Ocupada** | Ámbar (`amber-500`) | `status = 'active'` | Monto + tiempo transcurrido + 🔔 si hay items `sentToKitchen` |
| **Cuenta Pedida** | Dorado (`yellow-500`) | `status = 'pre_bill'` | Monto + ⏱️ tiempo desde `pre_bill_requested_at` |

**Badge de tiempo transcurrido:** Calculado en el frontend con `opened_at`. Se muestra como `12m`, `1h05m`, etc. Se actualiza cada 60 segundos con `setInterval` local.

**Badge de campana (🔔):** Visible cuando al menos un item del carrito tiene `sentToKitchen: true`. Indica que la cocina está trabajando en esa mesa.

**Indicador de mesero:** Mini-avatar o iniciales del `assigned_to` debajo del nombre de la mesa, solo si está asignado.

### 4.2 Menú contextual de mesa (`TableContextMenu.tsx`)

Long-press (touch) o click derecho (desktop) sobre una mesa **ocupada**:

```
┌─────────────────────────┐
│  Mesa 5 — $45.80        │
│  ───────────────────     │
│  📋 Ver Comanda          │
│  🔄 Transferir Mesa →    │
│  🔗 Unir con otra Mesa   │
│  👤 Cambiar Mesero       │
│  📄 Pre-cuenta           │
│  💰 Cobrar               │
└─────────────────────────┘
```

En mesas libres, el tap directo abre nueva comanda sin menú contextual.

### 4.3 Transferir Mesa / Items

#### Transferencia completa

1. Mesero selecciona "Transferir Mesa →" del menú contextual
2. El mapa entra en **modo selección**: mesas destino elegibles parpadean suavemente. Header muestra "Selecciona la mesa destino"
3. Mesero toca la mesa destino
4. Si la mesa destino está libre → la orden se mueve (`pos_table_orders.table_id` y `table_name` se actualizan). Mesa origen queda libre.
5. Si la mesa destino tiene items → confirmación: "Mesa 8 ya tiene una orden. ¿Fusionar las cuentas?"

#### Transferencia de items o asientos

1. Mesero está dentro de la comanda (vista carrito)
2. Long-press sobre un item → opción "Mover a otra mesa"
3. O tap en el header de un asiento en vista "Todos" → "Mover asiento completo"
4. Modal con selector de mesa destino (mini-mapa o lista)
5. Los items se remueven del `cart` de la orden origen y se agregan al `cart` de la orden destino (creándola si no existe)

#### Endpoint

```
POST /sales/table-orders/transfer
Permiso: sales.transfer_orders
```

**Request:**
```json
{
  "source_table_id": "uuid-mesa-5",
  "target_table_id": "uuid-mesa-8",
  "transfer_type": "full",
  "item_ids": [],
  "seat_id": null
}
```

`transfer_type`: `"full"` (toda la orden), `"items"` (items específicos por `item_ids`), `"seat"` (asiento completo por `seat_id`).

**Lógica backend:**
1. Validar que source tiene orden activa
2. Si `transfer_type = "full"` → actualizar `table_id` y `table_name` en la orden. Si destino tiene orden, fusionar (merge).
3. Si `transfer_type = "items"` → mover items del `cart` JSONB del source al target. Crear orden target si no existe.
4. Si `transfer_type = "seat"` → mover todos los items con `seat = seat_id` + el seat del array `seats`. Crear orden target si no existe.
5. Invalidar cache Redis de ambas mesas
6. Registrar en `pos_transfer_log`

### 4.4 Unir/Fusionar Mesas

**Flujo:**

1. Mesero selecciona "Unir con otra Mesa" del menú contextual
2. Modo selección: mesas **ocupadas** se resaltan
3. Mesero toca la mesa destino
4. Confirmación: "¿Unir Mesa 3 ($22.50) con Mesa 5 ($45.80)? Los items y asientos de Mesa 3 se moverán a Mesa 5."
5. Al confirmar:
   - Items del `cart` de mesa origen se concatenan al `cart` de mesa destino
   - `seats` de la origen se agregan a los seats del destino (se preservan labels)
   - `merged_from` en la orden destino se actualiza con el ID de la orden origen
   - La orden origen pasa a `status = 'cancelled'`
   - Mesa origen queda libre en el mapa

#### Endpoint

```
POST /sales/table-orders/merge
Permiso: sales.merge_orders
```

**Request:**
```json
{
  "source_table_id": "uuid-mesa-3",
  "target_table_id": "uuid-mesa-5"
}
```

### 4.5 Cambiar Mesero

Selector de perfiles del equipo filtrado a usuarios con permiso `sales.serve_tables`.

```
PATCH /sales/table-orders/{table_id}
{ "assigned_to": "profile-uuid" }
```

---

## 5. División de Cuentas (Split Bill)

### 5.1 Entrada al flujo

En la pantalla de decisión de pago (`CheckoutModal.tsx`), se agrega un **4º botón** visible solo en modo `tables`:

| Botón | Ícono | Descripción |
|---|---|---|
| Pago Completo | 💵 | Un solo método |
| Pago Mixto | 🔀 | Combinar métodos y monedas |
| CXC | 📋 | Cuenta por cobrar |
| **Dividir Cuenta** | ✂️ | Por asientos o personas |

Grid: `grid-cols-4` en desktop, `grid-cols-2 grid-rows-2` en tablet.

### 5.2 Pantalla de División (`SplitBillModal.tsx`)

Fullscreen modal con 3 tabs:

```
┌───────────────────────────────────────────────────────────┐
│  ← Volver          Dividir Cuenta — Mesa 5                │
│                                                           │
│  [Por Asientos]   [Partes Iguales]   [Manual]             │
├───────────────────────────────────────────────────────────┤
│              (contenido según tab activo)                  │
└───────────────────────────────────────────────────────────┘
```

**Detección de factura parcial existente:** Al abrirse, el modal consulta `GET /sales/invoices/by-table-order/{table_order_id}`. Si existe una factura con `status = 'partial'`, cruza los `covered_items` de los payments contra el carrito y marca los items ya pagados como "✅ Pagado" (tachados, no seleccionables).

### 5.3 Modo "Por Asientos"

Agrupa items por `seat` y muestra cada asiento como tarjeta cobrable:

```
┌──────────────────────┐  ┌──────────────────┐
│ Asiento 1            │  │ Pedro            │
│ ──────────────────── │  │ ──────────────── │
│ Hamburguesa    $12   │  │ Papas       $5   │
│ Coca-Cola x2    $6   │  │ Cerveza     $4   │
│ ──────────────────── │  │ ──────────────── │
│ Subtotal      $18.00 │  │ Subtotal    $9.00│
│ IVA            $2.88 │  │ IVA         $1.44│
│ TOTAL         $20.88 │  │ TOTAL      $10.44│
│                      │  │                  │
│  [💰 Cobrar Asiento] │  │  [💰 Cobrar]     │
└──────────────────────┘  └──────────────────┘

Items sin asiento (pool general):
┌──────────────────────────────────────────┐
│ Postre Brownie   $6.00                   │
│ (Asignar a: [Asiento 1] [Pedro])         │
└──────────────────────────────────────────┘
```

- Items sin `seat` se muestran aparte con opción de asignarlos antes de cobrar
- Al presionar "Cobrar Asiento" → se abre `PaymentCalculator.tsx` con el subtotal del asiento
- Al completar el pago: la tarjeta cambia a "✅ Pagado" (verde, no interactuable)
- Cuando todos los asientos están pagados → factura pasa a `paid`, mesa se libera

### 5.4 Modo "Partes Iguales"

```
Total de la mesa:  $31.32

Dividir entre:  [ - ]  3  [ + ]  personas

Cada persona paga:  $10.44

┌──────────┐  ┌──────────┐  ┌──────────┐
│ Persona 1│  │ Persona 2│  │ Persona 3│
│  $10.44  │  │  $10.44  │  │  $10.44  │
│ [Cobrar] │  │ [Cobrar] │  │ [Cobrar] │
└──────────┘  └──────────┘  └──────────┘

⚠️ Diferencia por redondeo: $0.00
(se agrega/descuenta de la última persona)
```

- Stepper táctil para N (mínimo 2, máximo = cantidad de items)
- Redondeo aplicado a la última persona para cuadre exacto
- Cobro secuencial, mismo flujo que por asientos
- `covered_items` distribuidos proporcionalmente (round-robin)

### 5.5 Modo "Manual / Por Items"

```
Selecciona los items para este pago:

☐ 🍔 Hamburguesa Classic     x1    $12.00
☑ 🥤 Coca-Cola               x2     $6.00
☑ 🍟 Papas Grandes           x1     $5.00
☐ 🍺 Cerveza Artesanal       x1     $4.00
☐ 🍫 Brownie                 x1     $6.00

──────────────────────────────────────
Seleccionado: 2 items — $11.00 + IVA
TOTAL a cobrar: $12.76

[💰 Cobrar selección]
```

- Checkboxes táctiles (mínimo 48px targets)
- Items ya pagados (rondas anteriores) tachados y deshabilitados
- Barra sticky inferior con subtotal en tiempo real
- Al cobrar → misma calculadora, `covered_items` = IDs seleccionados

### 5.6 Modelo de facturación

**Una sola factura con pagos parciales:**

- Al primer pago parcial, se crea la factura con **todos** los items de la mesa (no solo los cubiertos). Estado: `partial`.
- Cada pago se registra como un `payment` con `seat_label` + `covered_items`.
- `amount_paid` se acumula, `balance_due` se reduce.
- El inventario **no** se deduce hasta el último pago.
- Cuando `balance_due = 0` → factura pasa a `paid`, se deduce inventario, se liberan reservas Redis, orden pasa a `billed`, mesa queda libre.

### 5.7 Extensión de `POST /sales/checkout`

Se extiende el endpoint existente. No se crea uno nuevo.

**Campos adicionales en el request:**

```json
{
  "split_mode": "seats" | "equal" | "manual" | null,
  "is_partial": true,
  "seat_label": "Pedro",
  "covered_item_ids": ["cartItemId-1", "cartItemId-2"]
}
```

**Lógica cuando `is_partial = true`:**

1. Buscar factura existente vinculada a `table_order_id` → si existe, reutilizarla
2. Si no existe → crear factura completa (todos los items de la mesa). Estado: `partial`. Vincular con `table_order_id`.
3. Registrar payment con `seat_label` + `covered_items`. Sumar a `amount_paid`.
4. Actualizar `balance_due`.
5. **No** cerrar la orden de mesa. **No** deducir inventario.
6. Cuando `balance_due = 0` (último pago) → factura a `paid`, deducir inventario, liberar reservas Redis, orden a `billed`, mesa libre.

### 5.8 Persistencia y recuperación

Toda la información de pagos parciales vive en la base de datos:

| Dato | Tabla | Persiste si cierra browser |
|---|---|---|
| Factura con `status = 'partial'` | `invoices` | ✅ |
| Pagos registrados con `covered_items` | `payments` | ✅ |
| `amount_paid` y `balance_due` | `invoices` | ✅ |
| Orden de mesa activa | `pos_table_orders` | ✅ |
| Carrito completo | `pos_table_orders.cart` | ✅ |

**Endpoint de recuperación:**

```
GET /sales/invoices/by-table-order/{table_order_id}
Permiso: sales.view_invoices
```

Response: `{ invoice, payments[] }` o `null` si no existe factura parcial.

---

## 6. Pre-cuenta

### 6.1 Visibilidad

Botón "📋 Pre-cuenta" visible en el footer del `PosCart` en **cualquier modo** siempre que haya una cuenta abierta (items en el carrito con una `pos_table_orders` activa).

### 6.2 Flujo

1. Mesero presiona "Pre-cuenta"
2. Frontend: `PATCH /sales/table-orders/{table_id}` con `{ "status": "pre_bill", "pre_bill_requested_at": "<ISO timestamp>" }`
3. Se genera el documento no fiscal en pantalla (`PreBillPreview.tsx`)
4. Impresión: el sistema verifica la configuración de la workstation. Si tiene spooler/impresora térmica → envía job al spooler. Si no → `window.print()` con stylesheet optimizada para 80mm.
5. La mesa en el mapa cambia a estado "Cuenta Pedida" (dorado)

### 6.3 Documento de pre-cuenta (`PreBillPreview.tsx`)

```
        ☰ VERUM — PRE-CUENTA
        (No válido como factura)
─────────────────────────────────
  Mesa: 5          Mesero: Carlos
  Fecha: 26/08/2026   19:35
─────────────────────────────────

  ── Asiento 1 ──────────────────
  1x Hamburguesa Classic    $12.00
  2x Coca-Cola               $6.00

  ── Pedro ──────────────────────
  1x Papas Grandes            $5.00
  1x Cerveza Artesanal        $4.00

  ── Sin asiento ────────────────
  1x Brownie                  $6.00

─────────────────────────────────
  Subtotal               $33.00
  IVA 16%                  $5.28
  ═══════════════════════════════
  TOTAL                  $38.28
  (Ref: 1,531.20 VES)
─────────────────────────────────
  * Precios incluyen IVA
  * Documento no fiscal
```

### 6.4 Reversibilidad

El estado `pre_bill` es reversible. Si el mesero agrega más items después de la pre-cuenta, el status vuelve a `active` automáticamente al guardar el carrito modificado vía `PUT /sales/table-orders/{table_id}`.

---

## 7. Órdenes Abiertas para Delivery / Pick-up

### 7.1 Flujo

1. Cajero en modo `delivery` o `pickup` toma la orden y agrega items al carrito
2. Presiona **"Enviar a Cocina"** (mismo botón existente)
3. El sistema:
   - Marca items como `sentToKitchen: true`
   - Valida cliente si `customer_requirement = 'required'`
   - Persiste la orden en `pos_table_orders` con `payment_pending: true` automáticamente
   - Limpia el carrito activo para tomar la siguiente orden
4. La orden queda como cuenta abierta en `OpenOrdersModal` con badge "💳 Pendiente de Pago"
5. Cualquier cajero retoma la orden desde el modal → "Cobrar" → checkout normal

"Enviar a Cocina" en modos delivery/pickup implica automáticamente que la orden queda abierta esperando pago. No requiere acción extra del cajero.

### 7.2 UI en `OpenOrdersModal`

Órdenes con `payment_pending = true` se distinguen visualmente:

```
┌─────────────────────────────────────────────┐
│  🚗 Delivery #34 — Juan Pérez              │
│  3 items · $28.50 · hace 15 min            │
│  💳 PENDIENTE DE PAGO                       │
│                        [Retomar] [Cobrar]   │
└─────────────────────────────────────────────┘
```

---

## 8. Resumen de Cambios por Capa

### Base de Datos (Migración `073_pos_seats_split_bill.sql`)

| # | Tabla | Cambio |
|---|---|---|
| 1 | `pos_table_orders` | ADD `seats JSONB DEFAULT '[]'` |
| 2 | `pos_table_orders` | ADD `assigned_to UUID REFERENCES profiles(id)` |
| 3 | `pos_table_orders` | ADD `pre_bill_requested_at TIMESTAMPTZ` |
| 4 | `pos_table_orders` | ADD `opened_at TIMESTAMPTZ DEFAULT NOW()` |
| 5 | `pos_table_orders` | ADD `merged_from UUID[]` |
| 6 | `pos_table_orders` | ADD `payment_pending BOOLEAN DEFAULT false` |
| 7 | `pos_table_orders` | UPDATE status CHECK → `('active','pre_bill','billed','cancelled')` |
| 8 | `payments` | ADD `seat_label TEXT` |
| 9 | `payments` | ADD `covered_items UUID[]` |
| 10 | `invoices` | ADD `table_order_id UUID REFERENCES pos_table_orders(id)` |
| 11 | `pos_transfer_log` | CREATE TABLE (auditoría) |

### Backend (Python / FastAPI — `backend/app/sales/`)

| Archivo | Cambio |
|---|---|
| `schemas.py` | `SeatSchema`, `CartItemSchema` (con `seat`, `sentToKitchen`), `TransferRequest`, `MergeRequest`. Extender `CheckoutCreate` con `split_mode`, `is_partial`, `seat_label`, `covered_item_ids`. |
| `service.py` | `transfer_table_order()` — mover items/seats/full entre órdenes. `merge_table_orders()` — consolidar dos órdenes. Extender `update_table_order()` para `seats`, `assigned_to`, `pre_bill`, `payment_pending`. `get_invoice_by_table_order()`. |
| `checkout_service.py` | Extender para `is_partial`: crear factura al primer pago, acumular payments con `seat_label` + `covered_items`, cerrar al cubrir `balance_due = 0`. Auto-marcar `payment_pending = true` en delivery/pickup al enviar a cocina. |
| `router.py` | `POST /sales/table-orders/transfer`. `POST /sales/table-orders/merge`. `GET /sales/invoices/by-table-order/{table_order_id}`. Extender `PATCH /sales/table-orders/{table_id}`. |

### Permisos nuevos

| Permiso | Descripción |
|---|---|
| `sales.transfer_orders` | Transferir/mover órdenes entre mesas |
| `sales.merge_orders` | Fusionar cuentas de mesas |
| `sales.void_sent_items` | Eliminar items ya enviados a cocina |
| `sales.split_bill` | Acceder a división de cuentas |
| `sales.serve_tables` | Aparecer como mesero asignable |

### Frontend (Next.js / React)

| Archivo/Componente | Cambio |
|---|---|
| `posStore.ts` | `Seat`, `activeSeatId`, acciones de seats (`add`, `remove`, `rename`, `moveItem`, `setActive`). Extender `CartItem` con `seat`, `sentToKitchen`. Extender `PosCartContext` con `seats`. Modificar `addItem` para asignar seat automático. |
| `PosCart.tsx` | Tabs de asientos (solo `tables`), separadores por asiento en "Todos", badge de asiento, botón pre-cuenta, items bloqueados (`sentToKitchen`). |
| `PosTableMap.tsx` | Tres estados visuales (libre/ocupada/cuenta pedida), badge de tiempo, badge campana, indicador mesero, menú contextual (long-press/right-click). |
| `SplitBillModal.tsx` | **Nuevo** — 3 tabs: Por Asientos, Partes Iguales, Manual. Detección factura parcial. Items pagados vs pendientes. |
| `PreBillPreview.tsx` | **Nuevo** — Documento no fiscal con desglose por asientos. Spooler o `window.print()`. |
| `TableContextMenu.tsx` | **Nuevo** — Menú contextual para mesas ocupadas. |
| `TransferModal.tsx` | **Nuevo** — Selector de mesa destino con mini-mapa o lista. |
| `MergeConfirmation.tsx` | **Nuevo** — Confirmación con resumen antes de fusionar. |
| `CheckoutModal.tsx` | 4º botón "Dividir Cuenta" (solo `tables`). Grid responsivo. |
| `OpenOrdersModal.tsx` | Badge "💳 Pendiente de Pago" para delivery/pickup. Botón "Cobrar" directo. |
| `useSales.ts` | `useTransferOrder()`, `useMergeOrders()`, `useInvoiceByTableOrder()`. |
| `sales.ts` | `transferTableOrder()`, `mergeTableOrders()`, `getInvoiceByTableOrder()`. |

### Endpoints nuevos

| Método | Ruta | Propósito | Permiso |
|---|---|---|---|
| `POST` | `/sales/table-orders/transfer` | Transferir orden/items/asiento entre mesas | `sales.transfer_orders` |
| `POST` | `/sales/table-orders/merge` | Fusionar dos órdenes en una | `sales.merge_orders` |
| `GET` | `/sales/invoices/by-table-order/{id}` | Buscar factura parcial de una mesa | `sales.view_invoices` |

### Endpoints extendidos

| Método | Ruta | Cambio |
|---|---|---|
| `PATCH` | `/sales/table-orders/{table_id}` | Acepta `assigned_to`, `status: 'pre_bill'`, `seats`, `payment_pending` |
| `POST` | `/sales/checkout` | Acepta `split_mode`, `is_partial`, `seat_label`, `covered_item_ids` |
