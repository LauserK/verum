# Especificación de Diseño: Milestone 3 — Checkout Multimoneda y Pagos

**Fecha:** 2026-08-24
**Módulo:** POS (Point of Sale)
**Dependencia:** Milestone 2 completado (Layout, Catálogo, Store Zustand)
**Spec padre:** `2026-08-23-pos-module-design.md`
**Skill visual:** impeccable (modo Operate — POS táctil de alta velocidad)

---

## 1. Alcance

Este milestone cubre todo lo necesario para que un cajero pueda cobrar una orden completa desde el terminal POS, incluyendo:

- Configuración de requerimiento de cliente (obligatorio/opcional/desactivado) en cascada con cache Redis
- Selector de cliente en el POS (búsqueda + registro rápido)
- Almacén vinculado por workstation y control de stock por producto con reserva en Redis
- Endpoint atómico de checkout (`POST /sales/checkout`)
- UI completa de checkout: decisión de pago, calculadora multimoneda, registro de vuelto, confirmación
- Admin CRUD para todas las configuraciones nuevas
- Preparación arquitectónica para split de cuentas por asientos (Milestone 4)

**Fuera de alcance (Milestone 4):** Asignación de asientos a items, split de cuentas (por asientos, partes iguales, manual), plano de mesas interactivo en el POS.

---

## 2. Configuración `customer_requirement` — Cascada con Cache Redis

### 2.1 Modelo de herencia

Tres niveles con resolución en cascada:

```
Workstation override → Sale Mode override → Tenant default → 'optional'
```

| Nivel | Tabla | Columna | Default |
|---|---|---|---|
| Tenant (global) | `tenant_billing_config` | `customer_requirement TEXT` | `'optional'` |
| Modo de venta | `sale_mode_config` (nueva) | `customer_requirement TEXT` | `NULL` (hereda de tenant) |
| Workstation | `workstations` | `customer_requirement TEXT` | `NULL` (hereda de modo) |

Valores posibles: `'required'`, `'optional'`, `'disabled'`.

### 2.2 Tabla `sale_mode_config`

```sql
CREATE TABLE sale_mode_config (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id),
  mode                 TEXT NOT NULL CHECK (mode IN ('tables','takeout','delivery','pickup','bar')),
  customer_requirement TEXT CHECK (customer_requirement IN ('required','optional','disabled')),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, mode)
);

ALTER TABLE sale_mode_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON sale_mode_config
  USING (org_id = current_setting('app.current_org')::uuid);
```

### 2.3 Migraciones en tablas existentes

```sql
-- tenant_billing_config
ALTER TABLE tenant_billing_config
  ADD COLUMN customer_requirement TEXT NOT NULL DEFAULT 'optional'
  CHECK (customer_requirement IN ('required','optional','disabled'));

-- workstations
ALTER TABLE workstations
  ADD COLUMN customer_requirement TEXT
  CHECK (customer_requirement IN ('required','optional','disabled'));
```

### 2.4 Cache Redis

- **Key:** `pos:config:{org_id}:{workstation_id}:{mode}`
- **Valor:** JSON con la configuración resuelta (customer_requirement + futuras configs por modo/workstation)
- **TTL:** 32400 segundos (9 horas)
- **Invalidación:** Al modificar config desde admin, se eliminan todas las keys del patrón `pos:config:{org_id}:*`

### 2.5 Endpoint de resolución

```
GET /sales/pos-config?workstation_id={uuid}&mode={string}
Permiso: sales.view_config
```

**Response:**
```json
{
  "customer_requirement": "required",
  "warehouse_id": "uuid",
  "resolved_from": "sale_mode_config"
}
```

**Lógica:**
1. Buscar en Redis → si existe, retornar
2. Query: workstation.customer_requirement → si no es NULL, usar
3. Query: sale_mode_config WHERE org_id AND mode → si no es NULL, usar
4. Query: tenant_billing_config.customer_requirement → usar
5. Fallback: `'optional'`
6. Guardar en Redis con TTL 32400s
7. Retornar

### 2.6 Comportamiento en el flujo POS

| Valor resuelto | Modo Mesas | Otros modos | Botón manual en carrito |
|---|---|---|---|
| `required` | Selector al abrir mesa (bloquea hasta seleccionar) | Selector al enviar a cocina (bloquea hasta seleccionar) | Visible, pre-llenado si ya hay cliente |
| `optional` | No pide automáticamente | No pide automáticamente | Visible |
| `disabled` | No pide | No pide | Oculto |

---

## 3. Selector de Cliente en el POS

### 3.1 Componente `CustomerSelectorModal`

Modal/bottom-sheet con dos vistas internas: **búsqueda** y **registro rápido**.

### 3.2 Vista Búsqueda (inicial)

- Input con debounce 300ms — busca por nombre, RIF/cédula o teléfono
- Resultados como tarjetas táctiles (nombre, RIF, teléfono, saldo pendiente si tiene)
- Botón "Nuevo Cliente" prominente al final o si no hay resultados
- Botón "Consumidor Final" visible solo si `customer_requirement !== 'required'`
- Endpoint: `GET /sales/customers?search=X` (existente)

### 3.3 Vista Registro Rápido

Al tocar "Nuevo Cliente" se transiciona dentro del mismo modal:

| Campo | Requerido | Tipo |
|---|---|---|
| Nombre / Razón Social | ✅ | Text |
| RIF / Cédula | ✅ | Text con prefijo (V/J/E/G) |
| Teléfono | ✅ | Tel |
| Email | ❌ | Email |
| Dirección | ❌ | Textarea |
| Cumpleaños | ❌ | Date picker |
| Instagram / Redes | ❌ | Text |
| Notas | ❌ | Text |

- Endpoint: `POST /sales/customers` (existente)
- Al guardar, auto-selecciona el cliente creado y cierra el modal

### 3.4 Integración con Store Zustand

Nuevos campos en `posStore`:

```typescript
customerId: string | null
customerName: string | null
customerTaxId: string | null
setCustomer: (id: string | null, name: string, taxId: string | null) => void
clearCustomer: () => void
```

### 3.5 Puntos de invocación

1. **Mesas + required:** Se abre automáticamente al seleccionar mesa. No se puede cerrar sin seleccionar.
2. **Otros modos + required:** Se abre al presionar "Enviar a Cocina". Bloquea el envío.
3. **Botón manual en carrito:** Ícono de persona en el header del `PosCart`. Muestra nombre del cliente si ya hay uno. Touch para cambiar/asignar.

---

## 4. Almacén por Workstation y Control de Stock

### 4.1 Almacén en Workstation

```sql
-- Paso 1: agregar columna nullable
ALTER TABLE workstations
  ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);

-- Paso 2: migración de datos — asignar almacén por defecto de la venue a workstations existentes
UPDATE workstations w
  SET warehouse_id = (
    SELECT id FROM warehouses
    WHERE venue_id = w.venue_id
    ORDER BY created_at ASC LIMIT 1
  )
  WHERE w.warehouse_id IS NULL;

-- Paso 3: hacer NOT NULL después de poblar
ALTER TABLE workstations
  ALTER COLUMN warehouse_id SET NOT NULL;
```

- Obligatorio al crear/editar workstation en admin
- El endpoint de checkout lee `warehouse_id` automáticamente de la workstation activa
- El cajero nunca selecciona almacén manualmente

### 4.2 Control de Stock por Producto

```sql
ALTER TABLE sale_items
  ADD COLUMN allow_negative_stock BOOLEAN NOT NULL DEFAULT false;
```

| `allow_negative_stock` | En catálogo POS | En carrito |
|---|---|---|
| `false` (default) | Producto deshabilitado visualmente (gris, sin tap) cuando stock ≤ 0 | No se puede agregar |
| `true` | Badge de advertencia "⚠️ Sin stock" visible | Ícono de exclamación rojo en la línea del item |

### 4.3 Reserva Temporal en Redis

**Al agregar al carrito:** Frontend → `POST /sales/stock/reserve`

El backend:
1. Lee stock real de la BD
2. Resta reservas activas en Redis
3. Calcula disponible
4. Si disponible ≥ cantidad (o `allow_negative_stock = true`) → reserva
5. Si no hay stock y `allow_negative_stock = false` → `400 OUT_OF_STOCK`

**Estructura Redis:**
```
Key:    stock:reserved:{warehouse_id}:{sale_item_id}
Type:   Hash
Fields: {session_id}:{cart_line_id} → quantity
TTL:    1800s (30 min), renovable
```

**Liberación:**
- Al eliminar item del carrito → `DELETE /sales/stock/reserve/{line_id}`
- Al completar checkout → se liberan todas las reservas de la sesión (stock deducido realmente en BD)
- TTL expirado → liberación automática

**Disponibilidad para catálogo:**
- `GET /sales/stock/availability?warehouse_id=X` retorna stock disponible (real − reservas) por item
- El frontend refresca al cambiar de categoría o con polling ligero (cada 30s)

### 4.4 Endpoints nuevos

| Método | Ruta | Propósito | Permiso |
|---|---|---|---|
| `POST` | `/sales/stock/reserve` | Reservar stock al agregar al carrito | `sales.create_invoice` |
| `DELETE` | `/sales/stock/reserve/{line_id}` | Liberar reserva al quitar del carrito | `sales.create_invoice` |
| `GET` | `/sales/stock/availability` | Stock disponible (real − reservas) | `sales.view_catalog` |

---

## 5. Endpoint Atómico `POST /sales/checkout`

### 5.1 Contrato

```
POST /sales/checkout
Permisos: sales.create_invoice + sales.manage_payments
```

**Request:**
```json
{
  "workstation_id": "uuid",
  "pos_session_id": "uuid",
  "venue_id": "uuid",
  "mode": "takeout",
  "table_id": "uuid | null",

  "customer_id": "uuid | null",
  "customer_name": "string | null",
  "customer_tax_id": "string | null",

  "items": [
    {
      "sale_item_id": "uuid",
      "variant_id": "uuid | null",
      "quantity": 2,
      "unit_price": 12.50,
      "discount_pct": 0,
      "tax_id": "uuid | null",
      "modifiers": [],
      "notes": "sin cebolla"
    }
  ],

  "payments": [
    {
      "payment_method_id": "uuid",
      "amount": 20.00,
      "currency_code": "USD",
      "exchange_rate": 1.0,
      "reference": null,
      "cash_tendered": 25.00
    }
  ],

  "change": {
    "amount": 5.00,
    "currency_code": "USD",
    "method": "cash"
  },

  "document_type": "invoice",
  "discount_amount": 0,
  "notes": null
}
```

> **Nota:** `warehouse_id` se resuelve internamente desde la workstation. No se envía en el payload.

### 5.2 Flujo interno (una transacción DB)

1. **Validar sesión POS** — verificar que `pos_session_id` esté activa para la workstation
2. **Resolver warehouse** — leer `warehouse_id` de la workstation
3. **Validar customer_requirement** — según config resuelta (cascada). Si `required` y no hay `customer_id` ni `customer_name` → `400 CUSTOMER_REQUIRED`
4. **Resolver cliente** — Si `customer_id` → fetch de `customers`. Si solo `customer_name` → usar inline. Si nada → `"Cliente General"`
5. **Crear factura** — generar correlativo (`get_next_doc_number`), calcular subtotal/impuestos/descuentos, insertar en `invoices` + `invoice_items` + `invoice_tax_summary`
6. **Registrar pagos** — por cada payment: snapshot del método, conversión monetaria, recargos. Insertar en `payments`
7. **Registrar vuelto** — `cash_change`, `change_currency`, `change_method` en el payment de efectivo
8. **Confirmar factura** — estado → `'paid'` (o `'partial'` si es CXC parcial). Actualizar `amount_paid`, `balance_due`
9. **Deducir inventario** — `deduct_inventory_for_invoice(warehouse_id)`
10. **Liberar reservas Redis** — eliminar todas las reservas de la sesión
11. **COMMIT**

### 5.3 CXC (Cuentas por Cobrar)

- `payments` puede estar vacío o parcial
- La factura se crea con estado `'confirmed'` y `balance_due > 0`
- `customer_id` es **obligatorio** (no se puede fiar a "Cliente General")
- Se suma al `outstanding_balance` del cliente

### 5.4 Manejo de errores

| Error | HTTP | Código |
|---|---|---|
| Cliente requerido pero no enviado | 400 | `CUSTOMER_REQUIRED` |
| CXC sin customer_id | 400 | `CXC_REQUIRES_CUSTOMER` |
| Método de pago inactivo o no existe | 400 | `INVALID_PAYMENT_METHOD` |
| Monto pagado insuficiente (y no es CXC) | 400 | `INSUFFICIENT_PAYMENT` |
| Producto inactivo o no encontrado | 400 | `INVALID_SALE_ITEM` |
| Sesión POS no activa | 400 | `SESSION_NOT_ACTIVE` |
| Stock insuficiente (allow_negative_stock=false) | 400 | `INSUFFICIENT_STOCK` |
| Error de correlativo | 500 | `SEQUENCE_ERROR` |

### 5.5 Response

```json
{
  "invoice": {
    "id": "uuid",
    "document_number": "FAC-000127",
    "status": "paid",
    "total": 45.80,
    "amount_paid": 45.80,
    "balance_due": 0,
    "currency_code": "USD",
    "customer_name": "María López",
    "items": [...],
    "payments": [...],
    "tax_summary": [...]
  }
}
```

---

## 6. UI del Checkout

### 6.1 Principios de diseño (impeccable Operate)

- **Modo Operate:** el cajero completa una tarea bajo presión de tiempo. Escaneabilidad y consistencia > expresión
- **Tap targets mínimo 48px** en todos los botones
- **Dark theme** consistente con el terminal (`bg-surface`, `text-primary`, acento teal)
- **Zero-scroll** donde sea posible — información crítica siempre visible
- **Feedback táctil:** `active:scale-[0.98]` en botones interactivos

### 6.2 Pantalla 1: Decisión de Pago (Fullscreen Modal)

Layout vertical centrado:

| Zona | Contenido |
|---|---|
| **Header** | Botón "← Volver" a la izquierda. Badge: "8 items · Mesa 5 · Orden #127" |
| **Total** | `$45.80 USD` en `text-2xl font-black text-primary`. Debajo: `1,832.00 VES` en `text-sm text-text-secondary`. Línea de desglose: Subtotal · IVA 16% |
| **Cliente** | Chip con nombre si existe ("María López ✏️"), o "Sin cliente asignado" si optional/disabled |
| **Opciones** | Grid `grid-cols-3` con 3 cards táctiles (~180px alto): **Pago Completo** (ícono billete, "Un solo método"), **Pago Mixto** (ícono split, "Combinar métodos y monedas"), **CXC** (ícono clipboard, "Cuenta por cobrar") |
| **Footer** | Botón ghost "Cancelar" |

> **M4:** Se agrega un 4º botón "Dividir Cuenta" (solo en modo `tables`), cambiando a `grid-cols-4` o `grid-cols-2 grid-rows-2`.

### 6.3 Pantalla 2: Calculadora de Pago (Split View Fullscreen)

Se abre al seleccionar "Pago Completo" o "Pago Mixto":

| Panel Izquierdo (40%) | Panel Derecho (60%) |
|---|---|
| **Métodos de pago** — lista vertical de cards táctiles | **Barra de resumen** — Total / Pagado / Restante (dual currency USD + VES) |
| Cada card: ícono + nombre + chip de moneda nativa (USD/VES) | **Pagos registrados** — lista con método, monto, botón × para eliminar |
| Método seleccionado: borde teal + glow sutil | **Input de monto** con **switch USD⇄VES** prominente |
| Si el método requiere referencia (Zelle, Pago Móvil): input de referencia debajo | **Teclado numérico** en pantalla (grid 4×4: dígitos + punto decimal + backspace + clear) |
| | **Botones:** "Agregar Pago" (primary) + "Finalizar Cobro" (green, activo cuando restante ≤ 0) |

**Pago Completo:** Pre-selecciona primer método, pre-llena monto total. Un solo tap en "Finalizar Cobro".

**Pago Mixto:** Empieza vacío. Cajero: selecciona método → ingresa monto → "Agregar Pago" → repite hasta cubrir total.

### 6.4 Pantalla 3: Registro de Vuelto

Se muestra cuando `cash_tendered > total` en un pago en efectivo:

| Zona | Contenido |
|---|---|
| **Vuelto calculado** | Monto grande en ambas monedas: "$4.20 USD / 168.00 VES" |
| **Moneda del vuelto** | Selector: USD / VES |
| **Método del vuelto** | Selector: Efectivo / Transferencia / Pago Móvil / etc. |
| **Confirmar** | Botón que ejecuta `POST /sales/checkout` |

### 6.5 Pantalla 4: Confirmación Post-Venta

Modal de éxito (auto-dismiss configurable o manual):

- ✅ Ícono de check animado
- "Venta #127 completada"
- Número de factura / control fiscal
- Botones: "Imprimir Factura" / "Nota de Entrega" / "Nueva Orden" (CTA principal)

---

## 7. Admin — CRUD de Configuraciones Nuevas

### 7.1 Configuración de Cliente (Tenant)

**Ubicación:** `/admin/sales/config` (página existente)

Agregar sección "Políticas de Cliente" con:
- Select global: Obligatorio / Opcional / Desactivado
- Tabla/grid con los 5 modos de venta, cada uno con select: "Heredar de global" / Obligatorio / Opcional / Desactivado

**Endpoint existente:** `PATCH /sales/config` — extender payload para aceptar `customer_requirement`.

**Endpoint nuevo:** `POST|PATCH|GET /sales/mode-config` — CRUD para `sale_mode_config`.

### 7.2 Workstation — Almacén y Override de Cliente

**Ubicación:** `/admin/sales/workstations` (página existente)

Agregar al formulario de crear/editar:
- **Almacén:** Dropdown obligatorio con almacenes de la venue seleccionada
- **Política de cliente:** Select: "Heredar" / Obligatorio / Opcional / Desactivado

**Endpoint existente:** `POST|PATCH /sales/workstations` — extender payload para aceptar `warehouse_id` y `customer_requirement`.

### 7.3 Producto — Control de Stock

**Ubicación:** `/admin/sales/catalog` (página existente)

Agregar al formulario de crear/editar producto:
- **Checkbox:** "Permitir venta sin stock (quedará en negativo con advertencia visual)"

**Endpoint existente:** `POST|PATCH /sales/catalog/items` — extender payload para aceptar `allow_negative_stock`.

---

## 8. Preparación para Split de Cuentas (Milestone 4)

Las siguientes decisiones arquitectónicas en M3 facilitan el split en M4 sin refactoring:

### 8.1 Extensiones futuras en `payments` (M4)

```sql
ALTER TABLE payments
  ADD COLUMN seat_label TEXT,
  ADD COLUMN covered_items UUID[];
```

### 8.2 Extensión futura en `CartItem` (M4)

```typescript
interface CartItem {
  // ... campos existentes
  seat?: string  // Asignación a asiento (M4)
}
```

### 8.3 Modos de división (M4)

- **Por Asientos:** Items pre-agrupados por asiento durante la comanda
- **Partes Iguales:** Dividir total entre N personas
- **Manual:** Selección libre de items para crear sub-cuentas

### 8.4 Modelo de facturación

Una factura → múltiples pagos parciales con `seat_label`. La factura permanece en estado `'partial'` hasta que todos los grupos estén cobrados, momento en que pasa a `'paid'`.

### 8.5 UX

4º botón "Dividir Cuenta" en la pantalla de decisión de pago (solo visible en modo `tables`). Se agrega en M4.

---

## 9. Resumen de Cambios por Capa

### Base de Datos (Migraciones)

| # | Tabla | Cambio |
|---|---|---|
| 1 | `tenant_billing_config` | ADD `customer_requirement TEXT DEFAULT 'optional'` |
| 2 | `sale_mode_config` | CREATE TABLE (nueva) |
| 3 | `workstations` | ADD `customer_requirement TEXT`, ADD `warehouse_id UUID NOT NULL` |
| 4 | `sale_items` | ADD `allow_negative_stock BOOLEAN DEFAULT false` |

### Backend (Python / FastAPI)

| Archivo | Cambio |
|---|---|
| `service.py` | Función `resolve_pos_config()` con cascada + cache Redis |
| `service.py` | CRUD para `sale_mode_config` |
| `service.py` | Extender create/update workstation con `warehouse_id` y `customer_requirement` |
| `service.py` | Extender create/update sale_item con `allow_negative_stock` |
| `checkout_service.py` | **Nuevo** — lógica atómica de checkout |
| `stock_service.py` | **Nuevo** — reserva/liberación Redis + disponibilidad |
| `router.py` | Endpoints: `POST /checkout`, `GET /pos-config`, CRUD `/mode-config`, stock reserve/release/availability |
| `schemas.py` | Schemas: `CheckoutCreate`, `CheckoutResponse`, `PosConfigOut`, `SaleModeConfigCreate/Update/Out`, `StockReserveRequest` |

### Frontend (Next.js / React)

| Archivo/Componente | Cambio |
|---|---|
| `posStore.ts` | Agregar `customerId`, `customerName`, `customerTaxId`, `setCustomer()`, `clearCustomer()` |
| `CustomerSelectorModal.tsx` | **Nuevo** — modal de búsqueda + registro rápido |
| `CheckoutModal.tsx` | **Nuevo** — pantalla de decisión de pago (fullscreen) |
| `PaymentCalculator.tsx` | **Nuevo** — calculadora split-view con teclado numérico y switch moneda |
| `ChangeRegistration.tsx` | **Nuevo** — registro de vuelto (moneda + método) |
| `CheckoutConfirmation.tsx` | **Nuevo** — pantalla de éxito post-venta |
| `PosCart.tsx` | Agregar botón de cliente en header, conectar `onCheckout` |
| `PosCatalog.tsx` | Integrar stock disponible, deshabilitar productos sin stock, badges de advertencia |
| `terminal/page.tsx` | Orquestar modales (customer selector, checkout), conectar props a PosCart |
| `/admin/sales/config` | Sección "Políticas de Cliente" + grid de modos |
| `/admin/sales/workstations` | Campos: almacén (obligatorio) + política de cliente |
| `/admin/sales/catalog` | Checkbox "Permitir venta sin stock" |

### Redis

| Key Pattern | Propósito | TTL |
|---|---|---|
| `pos:config:{org_id}:{workstation_id}:{mode}` | Config resuelta de POS | 32400s (9h) |
| `stock:reserved:{warehouse_id}:{sale_item_id}` | Reservas de stock por carrito | 1800s (30min) |
