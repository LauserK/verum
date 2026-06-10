# VERUM_PRD_Produccion.md: Módulo de Inventario, Producción y MRP

> **Versión:** 1.0  
> **Estado:** En revisión  
> **Depende de:** VERUM.md (M1–M5), VERUM_PRD_Inventario.md (M6-INV para permisos)  
> **Milestones que agrega:** M16-PRD al M24-PRD  
> **Numeración:** continúa desde M15-ATT del módulo de asistencia

---

## 1. Visión General del Módulo

Este módulo convierte VERUM en un sistema de gestión de producción completo para operaciones gastronómicas. Cubre desde la recepción de materia prima hasta la etiquetación del producto terminado, incluyendo trazabilidad completa, control de lotes, órdenes de producción con KDS, planificación de catering y kardex histórico valorizado.

### Alcance funcional

| Sub-módulo | Descripción |
|---|---|
| **INS** — Maestro de artículos | Catálogo con multi-presentación, unidades de medida y clasificación |
| **ALM** — Almacenes y movimientos | Ingresos, egresos, traslados con confirmación, kardex PEPS |
| **BOM** — Recetas y rendimientos | Bill of Materials con rendimiento configurable y costo automático |
| **MPS** — Órdenes de producción | Generación, seguimiento, KDS, control de tiempo y lotes |
| **MRP** — Planificación de requerimientos | Previsión de inventario, requerimientos de catering, lista de compras |
| **ETQ** — Etiquetado | Impresión de etiquetas Zebra ZPL para productos terminados |
| **KAR** — Kardex histórico | Trazabilidad completa, valorización PEPS, snapshot de fechas pasadas |

### Estructura operativa soportada

* **Cocina central** como origen principal de producción.
* **3–5 almacenes** por organización (ej: Almacén Seco, Cámara Fría, Punto de Venta, Food Truck, Evento).
* **Catering y eventos** como destinos de consumo.
* Escalable a múltiples sedes si se agregan en el futuro.

---

## 2. Conceptos Fundamentales

### 2.1 Tipos de Artículo

| Tipo | Descripción | Ejemplos |
|---|---|---|
| `raw_material` | Materia prima comprada | Harina, tomate, mozzarella, aceite |
| `semi_finished` | Producto semiterminado | Masa de pizza, salsa napoli, base de tiramisú |
| `finished` | Producto terminado | Pizza completa, Cuzzetiello, postre empacado |
| `packaging` | Material de empaque | Cajas, bolsas, etiquetas |
| `supply` | Suministro general | Gas, papel film, guantes |

### 2.2 Sistema de Unidades de Medida

El inventario se lleva **siempre en la unidad base** (la más pequeña). Las presentaciones son solo vistas y formas de ingreso — no cambian cómo se almacena el dato.

**Unidades base disponibles:**

| Tipo | Unidad base |
|---|---|
| Peso | `g` (gramos) |
| Volumen | `ml` (mililitros) |
| Unidad | `unit` (unidades) |

**Presentaciones de conversión (ejemplos configurables):**

| Presentación | Conversión |
|---|---|
| Kilogramo (kg) | 1 kg = 1000 g |
| Saco 45 kg | 1 saco = 45,000 g |
| Bulto 20 kg | 1 bulto = 20,000 g |
| Litro | 1 L = 1000 ml |
| Envase 5L | 1 envase = 5,000 ml |
| Docena | 1 docena = 12 units |
| Caja 24 und | 1 caja = 24 units |

El admin define las presentaciones por artículo. Al ingresar o mover mercancía, el usuario selecciona la presentación que quiere usar — el sistema convierte a la unidad base automáticamente y almacena en gramos/ml/units.

### 2.3 Valuación PEPS (FIFO)

Cada lote de ingreso conserva su costo unitario en la unidad base. Al consumir stock, se consumen primero los lotes más antiguos. El costo de los productos manufacturados se calcula con el costo del lote más antiguo disponible de cada ingrediente al momento de iniciar la producción.

**Ejemplo:**
```
Lote A: 10 kg harina @ $1.00/kg  → costo base: $0.001/g   (ingresó primero)
Lote B: 20 kg harina @ $1.20/kg  → costo base: $0.0012/g  (ingresó después)

Orden de producción usa 15 kg harina:
  → consume 10 kg del Lote A a $0.001/g
  → consume  5 kg del Lote B a $0.0012/g
  → costo total harina en esta producción: $10.00 + $6.00 = $16.00
```

### 2.4 Previsión de Inventario

El inventario se muestra en tres valores simultáneos:

```
Físico:    cantidad real en almacén
Reservado: cantidad comprometida en órdenes de producción pendientes
Disponible: Físico − Reservado
```

Si `Disponible < 0` → alerta de desabastecimiento.

---

## 3. Modelo de Datos

```sql
-- ─────────────────────────────────────────────
-- MAESTRO DE ARTÍCULOS
-- ─────────────────────────────────────────────

-- Unidades de medida base
create table uom_base (
  id      uuid default uuid_generate_v4() primary key,
  code    text unique not null,  -- 'g', 'ml', 'unit'
  name    text not null          -- 'Gramos', 'Mililitros', 'Unidades'
);

-- Presentaciones de conversión por artículo
create table uom_presentations (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  name            text not null,          -- 'Saco 45kg', 'Caja 24und'
  base_uom_id     uuid references uom_base(id),
  conversion_factor numeric(18, 6) not null, -- 1 presentación = N unidades base
  is_default      boolean default false   -- Presentación por defecto al mostrar
);

-- Catálogo de artículos
create table items (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  code            text,                   -- Código interno (ej: HAR-001)
  name            text not null,
  type            text check (type in (
    'raw_material', 'semi_finished', 'finished', 'packaging', 'supply'
  )),
  base_uom_id     uuid references uom_base(id),
  -- Presentación por defecto para visualización
  default_display_uom_id uuid references uom_presentations(id),
  -- Control de calidad en producción
  yield_alert_enabled  boolean default false, -- Activar alerta de rendimiento
  yield_alert_threshold_pct numeric(5,2),     -- % de desvío permitido (ej: 5.00 = ±5%)
  -- Vida útil para etiquetas
  shelf_life_days  integer,               -- null = no aplica vencimiento
  -- Costos
  last_purchase_cost numeric(18,6),       -- Costo última compra en unidad base
  last_purchase_cost_updated_at timestamp with time zone,
  -- Meta
  is_active       boolean default true,
  created_at      timestamp with time zone default now()
);

-- Presentaciones habilitadas por artículo
create table item_uom_presentations (
  item_id         uuid references items(id) on delete cascade,
  presentation_id uuid references uom_presentations(id) on delete cascade,
  primary key (item_id, presentation_id)
);

-- ─────────────────────────────────────────────
-- ALMACENES
-- ─────────────────────────────────────────────

create table warehouses (
  id       uuid default uuid_generate_v4() primary key,
  org_id   uuid references organizations(id) on delete cascade,
  venue_id uuid references venues(id),   -- null si es almacén central
  name     text not null,                -- 'Almacén Seco', 'Cámara Fría', 'Food Truck'
  type     text check (type in (
    'production', 'storage', 'point_of_sale', 'transit'
  )),
  is_active boolean default true
);

-- Stock actual por artículo por almacén (tabla de saldo)
-- Se actualiza con cada movimiento. Fuente de verdad del inventario actual.
create table stock (
  id           uuid default uuid_generate_v4() primary key,
  warehouse_id uuid references warehouses(id) on delete cascade,
  item_id      uuid references items(id) on delete cascade,
  qty_base     numeric(18, 6) not null default 0, -- En unidad base siempre
  qty_reserved numeric(18, 6) not null default 0, -- Reservado por órdenes pendientes
  unique (warehouse_id, item_id)
);

-- Lotes de inventario (para PEPS/FIFO y trazabilidad)
create table stock_lots (
  id              uuid default uuid_generate_v4() primary key,
  warehouse_id    uuid references warehouses(id),
  item_id         uuid references items(id),
  lot_number      text,                      -- Número de lote externo o generado
  qty_base        numeric(18, 6) not null,   -- Cantidad restante en este lote
  unit_cost_base  numeric(18, 6) not null,   -- Costo por unidad base (PEPS)
  production_date date,
  expiry_date     date,
  received_at     timestamp with time zone default now(),
  is_exhausted    boolean default false      -- true cuando qty_base = 0
);

-- ─────────────────────────────────────────────
-- MOVIMIENTOS (KARDEX)
-- ─────────────────────────────────────────────

-- Tipos de movimiento
-- entry: compra, producción, ajuste positivo, recepción de traslado
-- exit: consumo, venta, ajuste negativo, merma
-- transfer: traslado entre almacenes

create table stock_movements (
  id                  uuid default uuid_generate_v4() primary key,
  org_id              uuid references organizations(id),
  movement_type       text check (movement_type in (
    'purchase',         -- Compra/ingreso por compra
    'production_in',    -- Ingreso por producción terminada
    'production_out',   -- Consumo por orden de producción
    'sale',             -- Egreso por venta/catering
    'transfer_out',     -- Salida por traslado
    'transfer_in',      -- Entrada por traslado
    'adjustment_in',    -- Ajuste positivo (inventario físico)
    'adjustment_out',   -- Ajuste negativo (merma, pérdida)
    'initial'           -- Carga inicial de inventario
  )),
  warehouse_id        uuid references warehouses(id),
  item_id             uuid references items(id),
  lot_id              uuid references stock_lots(id), -- Lote PEPS afectado
  qty_base            numeric(18, 6) not null,        -- Siempre positivo. El tipo indica dirección.
  unit_cost_base      numeric(18, 6),                 -- Costo unitario en unidad base
  total_cost          numeric(18, 6),                 -- qty_base * unit_cost_base
  -- Referencias cruzadas
  reference_id        uuid,    -- ID del documento origen (orden, traslado, etc.)
  reference_type      text,    -- 'production_order', 'transfer', 'purchase_receipt'
  notes               text,
  created_by          uuid references profiles(id),
  created_at          timestamp with time zone default now()
);

-- Documentos de ingreso (compras y otros ingresos)
create table purchase_receipts (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id),
  warehouse_id    uuid references warehouses(id),
  supplier        text,
  receipt_number  text,         -- Número de factura o referencia
  notes           text,
  status          text check (status in ('draft', 'confirmed')) default 'draft',
  created_by      uuid references profiles(id),
  confirmed_by    uuid references profiles(id),
  confirmed_at    timestamp with time zone,
  created_at      timestamp with time zone default now()
);

create table purchase_receipt_lines (
  id              uuid default uuid_generate_v4() primary key,
  receipt_id      uuid references purchase_receipts(id) on delete cascade,
  item_id         uuid references items(id),
  qty_base        numeric(18, 6) not null,
  presentation_id uuid references uom_presentations(id),  -- Cómo se ingresó
  qty_presentation numeric(18, 6),   -- Cantidad en la presentación usada
  unit_cost_base  numeric(18, 6) not null,   -- Costo por unidad base
  expiry_date     date,
  lot_number      text
);

-- Documentos de egreso
create table issue_documents (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id),
  warehouse_id    uuid references warehouses(id),
  reason          text check (reason in (
    'sale', 'catering', 'waste', 'sample', 'adjustment', 'other'
  )),
  notes           text,
  status          text check (status in ('draft', 'confirmed')) default 'draft',
  created_by      uuid references profiles(id),
  confirmed_by    uuid references profiles(id),
  confirmed_at    timestamp with time zone,
  created_at      timestamp with time zone default now()
);

create table issue_document_lines (
  id              uuid default uuid_generate_v4() primary key,
  document_id     uuid references issue_documents(id) on delete cascade,
  item_id         uuid references items(id),
  qty_base        numeric(18, 6) not null,
  presentation_id uuid references uom_presentations(id),
  qty_presentation numeric(18, 6)
);

-- Traslados entre almacenes
create table transfers (
  id                  uuid default uuid_generate_v4() primary key,
  org_id              uuid references organizations(id),
  from_warehouse_id   uuid references warehouses(id),
  to_warehouse_id     uuid references warehouses(id),
  requires_confirmation boolean default false,
  status              text check (status in (
    'draft',
    'in_transit',       -- Enviado, esperando confirmación en destino
    'confirmed',        -- Confirmado por destino sin discrepancias
    'confirmed_with_discrepancy', -- Confirmado con diferencias
    'cancelled'
  )) default 'draft',
  notes               text,
  created_by          uuid references profiles(id),
  confirmed_by        uuid references profiles(id),
  confirmed_at        timestamp with time zone,
  created_at          timestamp with time zone default now()
);

create table transfer_lines (
  id                  uuid default uuid_generate_v4() primary key,
  transfer_id         uuid references transfers(id) on delete cascade,
  item_id             uuid references items(id),
  qty_sent_base       numeric(18, 6) not null,
  qty_received_base   numeric(18, 6),   -- null hasta que destino confirme
  presentation_id     uuid references uom_presentations(id),
  qty_sent_presentation    numeric(18, 6),
  qty_received_presentation numeric(18, 6),
  discrepancy_base    numeric(18, 6)    -- qty_sent - qty_received, calculado al confirmar
);

-- ─────────────────────────────────────────────
-- BOM — RECETAS
-- ─────────────────────────────────────────────

create table recipes (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id),
  item_id         uuid references items(id) unique, -- El artículo que produce esta receta
  yield_qty_base  numeric(18, 6) not null,  -- Rendimiento base en unidad base del artículo
  yield_presentation_id uuid references uom_presentations(id), -- Para mostrar el rendimiento
  instructions    text,          -- Paso a paso de preparación (texto libre o markdown)
  version         integer default 1,
  is_active       boolean default true,
  created_at      timestamp with time zone default now()
);

create table recipe_ingredients (
  id              uuid default uuid_generate_v4() primary key,
  recipe_id       uuid references recipes(id) on delete cascade,
  item_id         uuid references items(id),     -- Ingrediente
  qty_base        numeric(18, 6) not null,        -- Cantidad en unidad base del ingrediente
  presentation_id uuid references uom_presentations(id), -- Para mostrar en receta
  order_index     integer not null,               -- Orden de aparición en la receta
  notes           text                            -- Ej: "tamizada", "a temperatura ambiente"
);

-- ─────────────────────────────────────────────
-- ÓRDENES DE PRODUCCIÓN
-- ─────────────────────────────────────────────

create table production_orders (
  id                  uuid default uuid_generate_v4() primary key,
  org_id              uuid references organizations(id),
  order_number        text unique not null,   -- PO-2024-001 generado automáticamente
  item_id             uuid references items(id),        -- Artículo a producir
  recipe_id           uuid references recipes(id),
  warehouse_id        uuid references warehouses(id),   -- Almacén de producción
  target_warehouse_id uuid references warehouses(id),   -- Almacén destino del producto
  -- Cantidades
  qty_ordered_base    numeric(18, 6) not null,  -- Cantidad a producir en unidad base
  qty_produced_base   numeric(18, 6),           -- Cantidad real producida (al cerrar)
  presentation_id     uuid references uom_presentations(id),
  qty_ordered_presentation numeric(18, 6),
  -- Estado
  status              text check (status in (
    'pending',        -- Creada, no iniciada
    'in_progress',    -- Iniciada por el equipo
    'paused',         -- Pausada
    'completed',      -- Terminada — ingresa al inventario
    'cancelled'
  )) default 'pending',
  priority            text check (priority in ('low', 'normal', 'high', 'urgent')) default 'normal',
  -- Tiempos
  scheduled_date      date,
  started_at          timestamp with time zone,
  completed_at        timestamp with time zone,
  -- Control de rendimiento
  yield_alert_triggered boolean default false,
  yield_variance_pct    numeric(5,2),   -- % diferencia entre esperado y real
  -- Referencias
  catering_request_id uuid,             -- Si viene de una solicitud de catering
  notes               text,
  created_by          uuid references profiles(id),
  assigned_to         uuid references profiles(id)
);

-- Consumos reales de ingredientes por orden (para trazabilidad y PEPS)
create table production_order_consumptions (
  id                  uuid default uuid_generate_v4() primary key,
  order_id            uuid references production_orders(id) on delete cascade,
  item_id             uuid references items(id),
  lot_id              uuid references stock_lots(id),   -- Lote PEPS consumido
  qty_planned_base    numeric(18, 6) not null,
  qty_actual_base     numeric(18, 6),                   -- null hasta completar
  unit_cost_base      numeric(18, 6)                    -- Del lote PEPS al iniciar
);

-- Lotes de producción generados
create table production_lots (
  id                  uuid default uuid_generate_v4() primary key,
  order_id            uuid references production_orders(id),
  item_id             uuid references items(id),
  warehouse_id        uuid references warehouses(id),
  lot_number          text unique not null,   -- PROD-20241014-001
  qty_base            numeric(18, 6) not null,
  unit_cost_base      numeric(18, 6),         -- Food cost calculado PEPS
  production_date     date not null,
  expiry_date         date,
  label_printed       boolean default false,
  created_at          timestamp with time zone default now()
);

-- ─────────────────────────────────────────────
-- CATERING / PLANIFICACIÓN
-- ─────────────────────────────────────────────

create table catering_requests (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id),
  name            text not null,    -- "Evento bodas García - Nov 2024"
  event_date      date,
  notes           text,
  status          text check (status in (
    'planning',       -- En planificación
    'confirmed',      -- Confirmado, órdenes generadas
    'completed',      -- Evento realizado
    'cancelled'
  )) default 'planning',
  created_by      uuid references profiles(id),
  created_at      timestamp with time zone default now()
);

-- Artículos requeridos para el catering
create table catering_request_lines (
  id              uuid default uuid_generate_v4() primary key,
  request_id      uuid references catering_requests(id) on delete cascade,
  item_id         uuid references items(id),
  qty_base        numeric(18, 6) not null,
  presentation_id uuid references uom_presentations(id),
  qty_presentation numeric(18, 6)
);

-- ─────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────

create index idx_stock_warehouse_item     on stock(warehouse_id, item_id);
create index idx_stock_lots_item_warehouse on stock_lots(item_id, warehouse_id, received_at)
  where not is_exhausted;
create index idx_movements_item_date      on stock_movements(item_id, created_at);
create index idx_movements_warehouse_date on stock_movements(warehouse_id, created_at);
create index idx_production_status        on production_orders(status, scheduled_date);
create index idx_production_item          on production_orders(item_id);
```

---

## 4. Reglas de Negocio Críticas

### 4.1 PEPS — Orden de consumo de lotes

Al consumir stock (producción, egreso, traslado salida):
1. Consultar `stock_lots` para ese `item_id` + `warehouse_id`, ordenado por `received_at ASC` donde `is_exhausted = false`.
2. Consumir del lote más antiguo primero.
3. Si el lote no alcanza, continuar con el siguiente.
4. Actualizar `stock_lots.qty_base` y marcar `is_exhausted = true` cuando llega a 0.
5. Registrar cada lote consumido en `production_order_consumptions` o en `stock_movements`.

### 4.2 Escalado de receta

Cuando el usuario solicita producir `X` unidades de un producto:
```
factor = qty_solicitada_base / receta.yield_qty_base
ingrediente_requerido = ingrediente.qty_base * factor
```

Para cada ingrediente: comparar con `stock.qty_base - stock.qty_reserved` del almacén de producción. Si no alcanza → mostrar alerta con el déficit.

### 4.3 Alerta de rendimiento

Al completar una orden de producción el sistema registra `qty_produced_base` (lo que realmente salió):
```
rendimiento_esperado = production_orders.qty_ordered_base
varianza_pct = abs(qty_producida - rendimiento_esperado) / rendimiento_esperado * 100

si varianza_pct > items.yield_alert_threshold_pct:
    → production_orders.yield_alert_triggered = true
    → notificar a usuarios con permiso production.audit
```

El umbral se configura por artículo en su ficha. Puede ser 0 para desactivar.

### 4.4 Previsión de inventario

```sql
-- El campo qty_reserved en stock se actualiza cuando:
-- + Se crea una orden de producción (reserva los ingredientes)
-- - Se completa o cancela la orden (libera la reserva)

-- Disponible = qty_base - qty_reserved
-- Se muestra siempre los tres valores: Físico / Reservado / Disponible
```

### 4.5 Food cost con última compra

El food cost de un producto manufacturado usa `items.last_purchase_cost` de cada ingrediente al momento de **crear** la orden de producción. Este valor se congela en `production_order_consumptions.unit_cost_base` para que el costo histórico no cambie si el precio del ingrediente cambia después.

### 4.6 Traslados con confirmación

Flujo:
1. Usuario origen crea traslado → `status: 'in_transit'`. Stock sale del almacén origen inmediatamente.
2. Usuario destino ve la solicitud pendiente con la lista de artículos y cantidades enviadas.
3. Usuario destino ingresa las cantidades realmente recibidas por línea.
4. Si todas las cantidades coinciden → `status: 'confirmed'`. Stock entra al almacén destino.
5. Si hay discrepancia en alguna línea → sistema pregunta: "¿Procesar con discrepancia o dejar abierto?"
   * Si procesa → `status: 'confirmed_with_discrepancy'` + alerta a supervisor.
   * Si deja abierto → permanece `in_transit` para revisión.

---

## 5. Requerimientos de la API

### 5.1 Maestro de artículos

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/items?org_id=&type=&search=` | Lista de artículos con stock actual agregado |
| `POST` | `/items` | Crear artículo con sus presentaciones habilitadas |
| `GET` | `/items/{id}` | Ficha completa: artículo, presentaciones, stock por almacén, última compra |
| `PATCH` | `/items/{id}` | Editar artículo |
| `GET` | `/items/{id}/stock` | Stock por almacén: físico, reservado, disponible en todas las unidades |
| `GET` | `/items/{id}/movements?from=&to=` | Kardex del artículo en el período |

### 5.2 Almacenes y movimientos

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/warehouses?org_id=` | Lista de almacenes |
| `POST` | `/warehouses` | Crear almacén |
| `GET` | `/warehouses/{id}/stock` | Inventario completo del almacén |
| `POST` | `/purchase-receipts` | Crear documento de ingreso |
| `PATCH` | `/purchase-receipts/{id}/confirm` | Confirmar ingreso: crea lotes PEPS, actualiza stock, registra movimientos |
| `POST` | `/issue-documents` | Crear documento de egreso |
| `PATCH` | `/issue-documents/{id}/confirm` | Confirmar egreso: consume lotes PEPS |
| `POST` | `/transfers` | Crear traslado (simple o con confirmación) |
| `PATCH` | `/transfers/{id}/send` | Marcar como enviado → `in_transit` |
| `PATCH` | `/transfers/{id}/confirm` | Destino confirma con cantidades recibidas |
| `GET` | `/transfers/pending?warehouse_id=` | Traslados pendientes de confirmación en un almacén |

### 5.3 Recetas

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/recipes?org_id=` | Lista de recetas |
| `POST` | `/recipes` | Crear receta con ingredientes |
| `GET` | `/recipes/{id}` | Receta completa con ingredientes y costo calculado |
| `PATCH` | `/recipes/{id}` | Editar receta |
| `POST` | `/recipes/{id}/scale` | Escalar receta a una cantidad objetivo. Body: `{ qty_base, warehouse_id }`. Devuelve ingredientes requeridos, disponibilidad por ingrediente y déficit si aplica |

### 5.4 Órdenes de producción

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/production-orders?status=&date=&warehouse_id=` | Lista de órdenes con filtros |
| `POST` | `/production-orders` | Crear orden. Reserva ingredientes en stock automáticamente |
| `GET` | `/production-orders/{id}` | Orden completa con ingredientes, consumos y tiempos |
| `PATCH` | `/production-orders/{id}/start` | Iniciar producción → `in_progress`, registra `started_at` |
| `PATCH` | `/production-orders/{id}/pause` | Pausar producción |
| `PATCH` | `/production-orders/{id}/complete` | Completar: recibe `qty_produced_base`, evalúa rendimiento, genera lote, ingresa al inventario, libera reservas |
| `PATCH` | `/production-orders/{id}/cancel` | Cancelar: libera reservas |
| `GET` | `/production-orders/kds?warehouse_id=` | Órdenes para el KDS: pending + in_progress ordenadas por prioridad y hora |

### 5.5 Catering y MRP

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/catering-requests` | Crear solicitud de catering con líneas de artículos requeridos |
| `GET` | `/catering-requests/{id}/plan` | Plan completo: qué producir, qué ingredientes se necesitan, qué hay en stock, qué falta comprar y costo estimado total |
| `POST` | `/catering-requests/{id}/generate-orders` | Generar órdenes de producción automáticamente para todo lo que hace falta producir |

### 5.6 Kardex e histórico

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/kardex?item_id=&warehouse_id=&from=&to=` | Kardex detallado: movimientos con lote, cantidad, costo unitario, saldo acumulado |
| `GET` | `/inventory/snapshot?date=&org_id=` | Snapshot de inventario en una fecha pasada: cantidades y valor en dinero de todos los artículos |
| `GET` | `/inventory/valuation?warehouse_id=` | Valorización actual del inventario por almacén |

---

## 6. Requerimientos del Frontend

### 6.1 Rutas del módulo

```
-- Operativo (staff / producción)
/production                      → Hub de producción
/production/kds                  → KDS: pantalla de órdenes pendientes (tablet)
/production/orders/[id]          → Detalle de orden activa con ingredientes
/production/transfers/pending    → Traslados pendientes de confirmación en mi almacén

-- Gestión (admin / supervisor)
/inventory                       → Dashboard de inventario
/inventory/items                 → Catálogo de artículos
/inventory/items/[id]            → Ficha de artículo con stock, kardex y receta
/inventory/warehouses            → Almacenes y su inventario
/inventory/warehouses/[id]       → Inventario completo de un almacén
/inventory/movements/receipts    → Ingresos por compra
/inventory/movements/issues      → Egresos
/inventory/movements/transfers   → Traslados
/inventory/kardex                → Kardex con filtros
/inventory/snapshot              → Snapshot histórico por fecha
/production/orders               → Lista de órdenes de producción
/production/orders/new           → Crear orden manual
/production/recipes              → Catálogo de recetas
/production/recipes/[id]         → Ficha de receta con escalador
/catering                        → Solicitudes de catering y planificación
/catering/[id]/plan              → Plan de producción y compras para el evento
```

### 6.2 KDS — Kitchen Display System (`/production/kds`)

Diseñado para tablet en posición horizontal (landscape). Sin navbar normal — modo kiosk con header mínimo.

```
┌──────────────────────────────────────────────────────────────┐
│  PRODUCCIÓN  |  Centro de Producción        14 Oct 10:32 AM  │
├──────────────┬───────────────┬──────────────┬────────────────┤
│  🔴 URGENTE  │  🟡 ALTA      │  🟢 NORMAL   │  ⏸ EN PAUSA   │
├──────────────┴───────────────┴──────────────┴────────────────┤
│                                                              │
│  ┌────────────────────┐  ┌────────────────────┐             │
│  │ PO-2024-047        │  │ PO-2024-048        │             │
│  │ Masa de Pizza      │  │ Salsa Napoli       │             │
│  │ 50 kg              │  │ 20 L               │             │
│  │ ──────────────     │  │ ──────────────     │             │
│  │ ⏱ Pendiente        │  │ ⏱ 00:23:14 ▶      │             │
│  │                    │  │                    │             │
│  │ [▶ Iniciar]        │  │ [⏸ Pausar]         │             │
│  └────────────────────┘  └────────────────────┘             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

* Cards coloreadas por prioridad.
* Timer en tiempo real para órdenes `in_progress`.
* Al tocar una card → abre el detalle de la orden.
* Sin scroll horizontal — máximo 4 cards visibles, el resto paginado.

### 6.3 Detalle de Orden en KDS (`/production/orders/[id]`)

Vista optimizada para tablet, diseñada para usarse con guantes o manos ocupadas:

```
┌──────────────────────────────────────────────────────┐
│  ← Volver    PO-2024-047 — Masa de Pizza     🔴 ALTA │
│              50 kg  |  ⏱ 00:45:22                    │
├──────────────────────────────────────────────────────┤
│  INGREDIENTES                                        │
│                                                      │
│  ✅ Harina 00          25.000 g  →  25 kg            │
│  ✅ Agua               16.500 ml →  16.5 L           │
│  ⬜ Levadura seca         500 g  →  500 g            │
│  ⬜ Sal                   750 g  →  750 g            │
│  ⬜ Aceite de oliva     1.250 ml →  1.25 L           │
│                                                      │
├──────────────────────────────────────────────────────┤
│  INSTRUCCIONES                                       │
│  1. Mezclar harina y sal en amasadora...             │
│  2. Disolver levadura en agua tibia (28°C)...        │
│  3. Incorporar agua gradualmente...                  │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Cantidad producida:  [_______] kg                   │
│                                                      │
│         [⏸ Pausar]        [✅ Completar orden]       │
└──────────────────────────────────────────────────────┘
```

* Ingredientes marcables como checklist durante la preparación (solo visual, no afecta el stock).
* Campo de cantidad producida obligatorio antes de completar.
* Botón "Completar" grande y fácil de tocar con guantes.

### 6.4 Escalador de Receta (`/production/recipes/[id]`)

```
┌────────────────────────────────────────────────────┐
│  Masa de Pizza — Receta base: 10 kg                │
│                                                    │
│  Quiero producir: [50] kg   Almacén: [Prod ▾]     │
│                                          [Calcular]│
├────────────────────────────────────────────────────┤
│  Ingrediente      Necesito    Disponible   Estado  │
│  ─────────────    ─────────   ─────────    ──────  │
│  Harina 00        25 kg       32 kg        ✅      │
│  Agua             16.5 L      ∞ (no stock) ✅      │
│  Levadura seca    500 g       300 g        ⚠️ -200g│
│  Sal              750 g       2 kg         ✅      │
│  Aceite de oliva  1.25 L      800 ml       ⚠️-450ml│
│                                                    │
│  Food cost estimado: $23.40 (para 50 kg)          │
│  Costo por kg: $0.47                              │
│                                                    │
│  ⚠️ 2 ingredientes insuficientes                   │
│  [Crear orden de todos modos]  [Cancelar]          │
└────────────────────────────────────────────────────┘
```

### 6.5 Planificador de Catering (`/catering/[id]/plan`)

La pantalla más compleja del módulo. Se divide en 3 columnas:

**Columna 1 — Artículos requeridos:**
Lista de los productos finales pedidos para el evento con sus cantidades.

**Columna 2 — Plan de producción:**
Para cada artículo final: qué semiterminados hay que producir primero, qué hay en stock y qué hace falta producir.

**Columna 3 — Lista de compras:**
Ingredientes que no están en stock o cuyo disponible no alcanza, con cantidades a comprar y costo estimado.

```
TOTAL ESTIMADO DE COMPRAS: $1,240.00
FOOD COST DEL EVENTO:      $1,890.00

[Generar todas las órdenes de producción]
[Exportar lista de compras PDF]
```

### 6.6 Formularios de Movimiento

**Ingreso por compra** (`/inventory/movements/receipts/new`):

```
Proveedor: [____________]   N° Factura: [____________]
Almacén destino: [Almacén Seco ▾]

Artículos:
┌──────────────────┬───────────┬──────────┬──────────┬──────────┐
│ Artículo         │ Presentac.│ Cantidad │ Costo/u  │Vencim.   │
├──────────────────┼───────────┼──────────┼──────────┼──────────┤
│ [Harina 00 ▾]    │ [Saco 45kg]│ [10]    │ [$45.00] │[mm/aa]   │
│ [+ Agregar línea]│           │          │          │          │
└──────────────────┴───────────┴──────────┴──────────┴──────────┘

[Guardar borrador]         [Confirmar ingreso]
```

Al confirmar:
* Crea lotes PEPS con fecha de recepción.
* Actualiza `stock.qty_base`.
* Actualiza `items.last_purchase_cost`.
* Registra movimientos en `stock_movements`.
* Habilita botón "Imprimir formato de ingreso".

**Traslado** (`/inventory/movements/transfers/new`):

Formulario similar. Toggle "Requiere confirmación en destino" → si activo, el receptor debe confirmar cantidades antes de que el stock entre a su almacén.

### 6.7 Kardex (`/inventory/kardex`)

Filtros: artículo, almacén, período. Tabla con:

| Fecha | Tipo | Referencia | Entrada | Salida | Lote | Costo unit. | Saldo |
|---|---|---|---|---|---|---|---|
| 01/10 | Compra | REC-0041 | 45,000 g | — | L-001 | $0.001 | 45,000 g |
| 05/10 | Producción | PO-047 | — | 25,000 g | L-001 | $0.001 | 20,000 g |
| 08/10 | Compra | REC-0052 | 45,000 g | — | L-002 | $0.0012 | 65,000 g |

Saldo acumulado calculado en tiempo real. Exportable a CSV.

### 6.8 Snapshot Histórico (`/inventory/snapshot`)

El usuario selecciona una fecha pasada → el sistema reconstruye el inventario a esa fecha sumando todos los movimientos hasta ese día desde el kardex.

```
Inventario al 31 de Mayo 2024
Almacén: [Todos ▾]

┌──────────────────┬──────────┬──────────────┬──────────────┐
│ Artículo         │ Cantidad │ Presentación │ Valor (PEPS) │
├──────────────────┼──────────┼──────────────┼──────────────┤
│ Harina 00        │ 45 kg    │ kg           │ $45.00       │
│ Mozzarella       │ 8 kg     │ kg           │ $96.00       │
│ Salsa Napoli     │ 12 L     │ litros       │ $18.00       │
├──────────────────┼──────────┼──────────────┼──────────────┤
│ TOTAL            │          │              │ $159.00      │
└──────────────────┴──────────┴──────────────┴──────────────┘

[Exportar CSV]
```

---

## 7. Etiquetado con Impresora Zebra

### 7.1 Configuración

La impresora Zebra se configura por almacén en `/admin/settings/printers`. El sistema genera comandos **ZPL (Zebra Programming Language)** directamente — sin drivers adicionales. La impresión se hace vía:

* **Browser Print** (app de Zebra para navegador) — recomendado para uso desde tablet.
* **API de impresora en red** — si la Zebra está en la red local, se puede enviar el ZPL directamente via HTTP.

### 7.2 Contenido de la etiqueta

```
┌─────────────────────────────┐
│  VERUM                      │
│                             │
│  Masa de Pizza              │
│  Lote: PROD-20241014-001    │
│                             │
│  Peso neto: 5.000 kg        │
│                             │
│  Producción: 14/10/2024     │
│  Vence:      21/10/2024     │
│                             │
│  [BARCODE: PROD-20241014-001]│
└─────────────────────────────┘
```

### 7.3 Generación ZPL

```javascript
// services/zpl.js
function generateProductionLabel({ lotNumber, itemName, weightG, productionDate, expiryDate }) {
  const weightDisplay = weightG >= 1000
    ? `${(weightG / 1000).toFixed(3)} kg`
    : `${weightG} g`;

  return `
^XA
^FO20,20^A0N,30,30^FDVERUM^FS
^FO20,60^A0N,40,40^FD${itemName}^FS
^FO20,110^A0N,25,25^FDLote: ${lotNumber}^FS
^FO20,145^A0N,35,35^FDPeso neto: ${weightDisplay}^FS
^FO20,190^A0N,25,25^FDProduccion: ${productionDate}^FS
${expiryDate ? `^FO20,220^A0N,25,25^FDVence: ${expiryDate}^FS` : ''}
^FO20,260^BY2^BCN,80,Y,N,N^FD${lotNumber}^FS
^XZ
  `.trim();
}
```

La etiqueta se genera al completar una orden de producción. El usuario puede imprimir N etiquetas (una por unidad empacada) indicando el peso de cada unidad.

### 7.4 Impresión de formatos de movimiento

Los formularios de ingreso, egreso y traslado tienen un botón "Imprimir formato" que genera un PDF con:
* Encabezado: tipo de movimiento, fecha, almacén, responsable.
* Tabla de artículos: nombre, presentación, cantidad, lote.
* Espacio para firmas: preparado por / revisado por / recibido por.

Generado client-side con `@react-pdf/renderer` o similar. Sin dependencia de servidor para la impresión.

---

## 8. Permisos del módulo (integración con M6-INV)

**Módulo: `inventory`**

| Permiso key | Descripción |
|---|---|
| `inventory.view` | Ver stock e inventario |
| `inventory.receive` | Crear y confirmar ingresos por compra |
| `inventory.issue` | Crear y confirmar egresos |
| `inventory.transfer` | Crear traslados |
| `inventory.transfer_confirm` | Confirmar recepción de traslados en destino |
| `inventory.adjust` | Hacer ajustes de inventario |
| `inventory.manage_items` | Crear y editar artículos y presentaciones |
| `inventory.manage_warehouses` | Crear y editar almacenes |
| `inventory.view_kardex` | Ver kardex y snapshots históricos |
| `inventory.view_costs` | Ver costos y valorización |

**Módulo: `production`**

| Permiso key | Descripción |
|---|---|
| `production.view` | Ver órdenes de producción |
| `production.execute` | Iniciar, pausar y completar órdenes |
| `production.create` | Crear órdenes de producción |
| `production.audit` | Revisar alertas de rendimiento |
| `production.manage_recipes` | Crear y editar recetas |
| `production.manage_catering` | Crear y gestionar solicitudes de catering |

---

## 9. Plan de Implementación — Milestones

```
M16-PRD  Maestro de artículos + almacenes + stock inicial
M17-PRD  Movimientos: ingresos, egresos y kardex PEPS
M18-PRD  Traslados simples y con confirmación
M19-PRD  Recetas (BOM) y escalador
M20-PRD  Órdenes de producción + KDS
M21-PRD  Etiquetado Zebra + formatos imprimibles
M22-PRD  Planificador de catering y MRP
M23-PRD  Kardex histórico, snapshots y valorización
M24-PRD  Previsión de inventario y alertas de desabastecimiento
```

> ⚠️ Cada milestone debe completarse y verificarse antes de iniciar el siguiente. M17 depende de M16. M19 depende de M17. M20 depende de M19. M22 depende de M20.

---

### ✅ M16-PRD — Maestro de Artículos, Almacenes y Stock Inicial
**Victoria:** El admin puede crear artículos con sus presentaciones, configurar almacenes y cargar el stock inicial. Se puede ver el inventario actual de cada almacén.

**SQL a agregar:** `uom_base`, `uom_presentations`, `items`, `item_uom_presentations`, `warehouses`, `stock`.

**Backend:** CRUD de artículos, presentaciones y almacenes. `GET /warehouses/{id}/stock`. `POST /stock-movements` con `type: 'initial'` para carga inicial.

**Frontend:** `/inventory/items` catálogo. `/inventory/items/new` formulario con selector de tipo, unidad base y presentaciones. `/inventory/warehouses` con tabla de stock actual en unidad base y presentación por defecto.

**Criterio de éxito:** Admin crea "Harina 00" con unidad base `g`, habilita presentaciones kg y saco 45kg, carga 10 sacos como stock inicial → el sistema muestra 450,000 g = 450 kg = 10 sacos según la presentación seleccionada.

---

### ✅ M17-PRD — Ingresos, Egresos y Kardex PEPS
**Victoria:** Se pueden registrar compras y consumos. El kardex muestra el historial completo con lotes PEPS y valorización.

**SQL a agregar:** `stock_lots`, `stock_movements`, `purchase_receipts`, `purchase_receipt_lines`, `issue_documents`, `issue_document_lines`.

**Backend:** Endpoints de ingresos y egresos con lógica PEPS completa. `GET /kardex`. Actualización de `items.last_purchase_cost` al confirmar ingreso.

**Frontend:** Formularios de ingreso y egreso con selector de presentación. Kardex con filtros y exportación CSV. Botón "Imprimir formato" genera PDF.

**Criterio de éxito:** Se ingresan 2 lotes de harina a precios distintos → se hace un egreso de una cantidad que cruza los dos lotes → el kardex muestra el consumo de cada lote por separado con sus costos PEPS correctos.

---

### ✅ M18-PRD — Traslados con y sin Confirmación
**Victoria:** El stock se puede mover entre almacenes. Los traslados con confirmación requieren que el destino valide las cantidades recibidas.

**SQL a agregar:** `transfers`, `transfer_lines`.

**Backend:** Flujo completo de traslado: draft → in_transit → confirmed / confirmed_with_discrepancy. Alerta a supervisor en caso de discrepancia procesada.

**Frontend:** Formulario de traslado con toggle "Requiere confirmación". `/production/transfers/pending` para el receptor. Diálogo de confirmación con campo de cantidad recibida por línea y lógica de discrepancia.

**Criterio de éxito:** Almacén central envía traslado con confirmación a food truck → operador del food truck ve la solicitud, ingresa cantidades recibidas con una diferencia en un ítem → sistema pregunta cómo proceder → si confirma con discrepancia aparece alerta al supervisor.

---

### ✅ M19-PRD — Recetas (BOM) y Escalador
**Victoria:** Cada producto semiterminado o terminado tiene su receta. El escalador calcula ingredientes para cualquier cantidad y muestra disponibilidad en tiempo real.

**SQL a agregar:** `recipes`, `recipe_ingredients`.

**Backend:** CRUD de recetas. `POST /recipes/{id}/scale` con cálculo de disponibilidad y food cost. Validación: un artículo solo puede tener una receta activa.

**Frontend:** `/production/recipes` catálogo. Editor de receta con tabla de ingredientes, cantidad en presentación configurable e instrucciones de preparación. Escalador interactivo con tabla de disponibilidad y alerta de déficit.

**Criterio de éxito:** Admin crea receta de masa de pizza con rendimiento 10 kg. Usuario escala a 50 kg → sistema muestra 5 ingredientes, 2 con déficit resaltados en rojo → food cost calculado automáticamente.

---

### ✅ M20-PRD — Órdenes de Producción y KDS
**Victoria:** El equipo de cocina puede ver y gestionar órdenes desde el KDS en tablet. Los tiempos quedan registrados. Las alertas de rendimiento funcionan.

**SQL a agregar:** `production_orders`, `production_order_consumptions`, `production_lots`.

**Backend:** CRUD de órdenes. Lógica de reserva de stock al crear. Lógica de consumo PEPS al completar. Cálculo de varianza de rendimiento y alerta. `GET /production-orders/kds`.

**Frontend:** `/production/kds` pantalla landscape para tablet con cards por prioridad y timers en vivo. `/production/orders/[id]` detalle con ingredientes marcables e instrucciones. Formulario de cantidad producida al completar con confirmación de alerta si hay varianza.

**Criterio de éxito:** Admin crea orden de 50 kg de masa → KDS la muestra como pendiente → operador la inicia → timer corre → al completar ingresa 48 kg (varianza 4%) → si el umbral del artículo es 3% → alerta al supervisor.

---

### ✅ M21-PRD — Etiquetado Zebra y Formatos Imprimibles
**Victoria:** Al completar una producción se pueden imprimir etiquetas ZPL para los lotes. Los formularios de movimiento tienen versión imprimible.

**SQL a agregar:** `production_lots` ya existe desde M20. Agregar `label_printed` tracking.

**Backend:** `GET /production-lots/{id}/zpl` — genera el ZPL para la etiqueta. Configuración de impresora por almacén.

**Frontend:** Modal post-producción: "¿Cuántas etiquetas imprimir? ¿Peso por unidad?" → genera ZPL → envía a impresora Zebra vía Zebra Browser Print. Botón "Imprimir formato" en confirmaciones de ingreso, egreso y traslado genera PDF con `@react-pdf/renderer`.

**Criterio de éxito:** Se completa una orden de 50 kg de masa → operador selecciona imprimir 10 etiquetas de 5 kg → impresora Zebra imprime 10 etiquetas con nombre, lote, peso, fecha de producción y vencimiento.

---

### ✅ M22-PRD — Planificador de Catering y MRP
**Victoria:** El admin ingresa los productos requeridos para un evento y el sistema genera automáticamente el plan de producción completo y la lista de compras con costos.

**SQL a agregar:** `catering_requests`, `catering_request_lines`.

**Backend:** `POST /catering-requests/{id}/plan` — lógica MRP: desglosa artículos finales → recetas → semiterminados → materias primas → compara con stock disponible → calcula qué producir y qué comprar. `POST /catering-requests/{id}/generate-orders` — crea todas las órdenes de producción necesarias en cadena.

**Frontend:** `/catering` lista de eventos. `/catering/new` formulario de artículos requeridos. `/catering/[id]/plan` pantalla de 3 columnas: requerimientos → plan de producción → lista de compras. Botón "Exportar lista de compras PDF".

**Criterio de éxito:** Admin ingresa 100 Cuzzetiellos y 50 pizzas para un evento → sistema calcula que necesita producir X kg de masa y X litros de salsa → detecta que le falta harina y tomate → muestra lista de compras con cantidades y costo estimado → con un click genera todas las órdenes de producción en la secuencia correcta.

---

### ✅ M23-PRD — Kardex Histórico y Snapshots
**Victoria:** El admin puede ver cuánto inventario tenía en cualquier fecha pasada y cuánto valía.

**SQL a agregar:** Sin tablas nuevas — se trabaja sobre `stock_movements` ya existente.

**Backend:** `GET /inventory/snapshot?date=` — suma todos los movimientos hasta la fecha solicitada agrupado por artículo y almacén. `GET /inventory/valuation` — valorización actual con costos PEPS del lote más antiguo disponible.

**Frontend:** `/inventory/snapshot` con date picker y tabla de resultados exportable. `/inventory/kardex` completo con todos los filtros, columna de saldo acumulado y exportación CSV.

**Criterio de éxito:** Admin selecciona 31 de Mayo → sistema muestra inventario y valorización de esa fecha en menos de 3 segundos. Los números cuadran con la suma manual de movimientos del kardex del mismo período.

---

### ✅ M24-PRD — Previsión y Alertas de Desabastecimiento
**Victoria:** El inventario siempre muestra físico / reservado / disponible. Las alertas de desabastecimiento se generan automáticamente cuando el disponible cae a cero.

**SQL a agregar:** Sin tablas nuevas. `stock.qty_reserved` ya existe desde M16.

**Backend:** Garantizar que `stock.qty_reserved` se actualice correctamente en todos los flujos (crear orden → reservar, completar/cancelar → liberar). Endpoint de alertas de stock bajo. Lógica de alerta cuando `qty_base - qty_reserved ≤ 0` para cualquier artículo con órdenes pendientes.

**Frontend:** En todas las vistas de inventario mostrar tres columnas: Físico / Reservado / Disponible. Badge rojo en artículos con disponible negativo. `/inventory` dashboard con sección de alertas de desabastecimiento activas.

**Criterio de éxito:** Se crean dos órdenes de producción que en conjunto requieren más harina de la disponible → en el inventario aparece la harina con disponible negativo en rojo → alerta visible en el dashboard de inventario.