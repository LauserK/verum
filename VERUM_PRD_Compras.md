# VERUM_PRD_Compras.md: Módulo de Compras y Proveedores (SRM)

> **Versión:** 1.0  
> **Estado:** En revisión  
> **Depende de:** VERUM_PRD_Produccion.md (M16-PRD a M24-PRD completados — especialmente el sistema unificado de documentos de inventario que reemplazó a M17)  
> **Milestones que agrega:** M25-SRM al M31-SRM  
> **Integración contable:** Sin integración con Odoo en esta fase. VERUM genera PDFs y mantiene sus propios registros. La migración completa a VERUM como sistema contable es una fase futura independiente.

---

## 1. Visión General del Módulo

Este módulo cierra el ciclo operativo que el MRP dejó abierto: el MRP sabe **qué comprar**, pero no gestiona **cómo se ejecuta esa compra**. El módulo SRM cubre desde la creación de la orden de compra hasta el registro de la factura del proveedor, pasando por el flujo de aprobación, el envío al proveedor, la recepción física y la conciliación de tres vías.

### Lo que resuelve

| Problema actual | Solución |
|---|---|
| Las compras se hacen por WhatsApp sin documento formal | Órdenes de compra en PDF con número de referencia |
| No hay aprobación estructurada | Flujo configurable por rol y monto |
| No se sabe si llegó lo que se pidió | Three-way matching: PO vs. Remisión vs. Factura |
| No hay historial de precios por proveedor | Catálogos de precios con vigencias |
| No se evalúa el desempeño del proveedor | Métricas automáticas + evaluación manual |
| No hay visibilidad de qué facturas enviar a pago | Registro de facturas para exportación a Odoo |

### Posición en el roadmap

```
MRP (M22-PRD) genera Lista de Compras
         ↓
SRM (este módulo) convierte esa lista en POs formales
         ↓
Recepción (Sistema unificado de doc. de inventario) recibe la mercancía
         ↓
Three-way matching cierra el ciclo con la factura
         ↓
Exportación de facturas a Odoo para gestión de pagos (CXP futura en VERUM)
```

---

## 2. Gestión de Proveedores

### 2.1 Directorio de Proveedores

Cada proveedor tiene una ficha completa con su información comercial, condiciones de pago y catálogo de precios negociados.

```sql
create table suppliers (
  id                  uuid default uuid_generate_v4() primary key,
  org_id              uuid references organizations(id) on delete cascade,
  code                text,                    -- SUP-001, generado automáticamente
  name                text not null,
  tax_id              text,                    -- RIF, NIT, RFC según país
  email               text,
  phone               text,
  address             text,
  -- Condiciones comerciales
  payment_terms_days  integer default 0,       -- 0=contado, 30, 60, 90 días
  credit_limit        numeric(18,2),           -- Límite de crédito aprobado
  currency            text default 'USD',      -- Moneda de facturación
  -- Estado
  status              text check (status in (
    'active',
    'inactive',
    'blocked'          -- Bloqueado por deuda o mala evaluación
  )) default 'active',
  -- Evaluación acumulada
  score               numeric(3,1),            -- 0.0 a 5.0, calculado automáticamente
  notes               text,
  created_at          timestamp with time zone default now()
);

-- Contactos del proveedor (puede haber varios: ventas, facturación, logística)
create table supplier_contacts (
  id          uuid default uuid_generate_v4() primary key,
  supplier_id uuid references suppliers(id) on delete cascade,
  name        text not null,
  role        text,          -- 'ventas', 'facturación', 'logística'
  email       text,
  phone       text,
  is_primary  boolean default false
);

-- Artículos que suministra cada proveedor (para filtrar proveedores al crear PO)
create table supplier_items (
  supplier_id uuid references suppliers(id) on delete cascade,
  item_id     uuid references items(id) on delete cascade,
  supplier_sku text,         -- Código del artículo en el sistema del proveedor
  lead_time_days integer,    -- Días típicos de entrega de este artículo
  is_preferred boolean default false, -- Proveedor preferido para este artículo
  primary key (supplier_id, item_id)
);
```

### 2.2 Catálogo de Precios por Proveedor

Los precios negociados se cargan por proveedor con fechas de vigencia. Al crear una PO, el sistema sugiere automáticamente el precio del catálogo vigente.

```sql
create table supplier_price_lists (
  id          uuid default uuid_generate_v4() primary key,
  supplier_id uuid references suppliers(id) on delete cascade,
  name        text not null,           -- 'Tarifa Q4 2024', 'Contrato anual 2025'
  valid_from  date not null,
  valid_until date,                    -- null = sin vencimiento
  is_active   boolean default true,
  created_at  timestamp with time zone default now()
);

create table supplier_price_list_items (
  id              uuid default uuid_generate_v4() primary key,
  price_list_id   uuid references supplier_price_lists(id) on delete cascade,
  item_id         uuid references items(id),
  unit_cost_base  numeric(18,6) not null,    -- Precio por unidad base del artículo
  presentation_id uuid references uom_presentations(id),
  unit_cost_presentation numeric(18,6),      -- Precio en la presentación de compra
  min_qty_base    numeric(18,6),             -- Cantidad mínima para este precio
  notes           text
);
```

### 2.3 Evaluación de Proveedores

**Métricas automáticas** — calculadas del historial de POs y recepciones:

| Métrica | Fórmula | Peso |
|---|---|---|
| Puntualidad de entrega | % de POs recibidas en o antes de la fecha prometida | 40% |
| Exactitud de cantidad | % de líneas recibidas sin discrepancia vs. PO | 35% |
| Tasa de devolución | % de líneas con devolución sobre total recibido | 25% |

```
Score automático = (puntualidad × 0.40) + (exactitud × 0.35) + ((1 - devolución) × 0.25)
Score final = (score_automático × 0.70) + (score_manual × 0.30)
```

**Evaluación manual** — formulario periódico opcional (mensual o trimestral):

```sql
create table supplier_evaluations (
  id              uuid default uuid_generate_v4() primary key,
  supplier_id     uuid references suppliers(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  -- Métricas automáticas calculadas al momento de la evaluación
  auto_on_time_pct      numeric(5,2),
  auto_qty_accuracy_pct numeric(5,2),
  auto_return_rate_pct  numeric(5,2),
  auto_score            numeric(3,1),
  -- Evaluación manual (1-5 en cada dimensión)
  manual_quality        integer check (manual_quality between 1 and 5),
  manual_communication  integer check (manual_communication between 1 and 5),
  manual_flexibility    integer check (manual_flexibility between 1 and 5),
  manual_score          numeric(3,1),  -- Promedio de los tres campos manuales
  -- Score final ponderado
  final_score           numeric(3,1),
  evaluator_id    uuid references profiles(id),
  notes           text,
  created_at      timestamp with time zone default now()
);
```

---

## 3. Órdenes de Compra (PO)

### 3.1 Flujo de Aprobación Configurable

El flujo de aprobación se basa en el sistema de roles del M6-INV. Cada rol tiene un límite de aprobación de POs configurable. El dueño no tiene límite.

```sql
-- Límites de aprobación por rol (extiende custom_roles del M6-INV)
create table po_approval_limits (
  id          uuid default uuid_generate_v4() primary key,
  org_id      uuid references organizations(id) on delete cascade,
  role_id     uuid references custom_roles(id) on delete cascade,
  max_amount  numeric(18,2),   -- null = sin límite (dueño)
  unique (org_id, role_id)
);

-- Configuración global de aprobación por organización
create table po_approval_config (
  id                          uuid default uuid_generate_v4() primary key,
  org_id                      uuid references organizations(id) on delete cascade unique,
  creator_can_approve_own     boolean default false,  -- El creador no puede aprobar su propia PO
  require_approval_above      numeric(18,2) default 0 -- Monto mínimo que requiere aprobación (0 = siempre)
);
```

**Lógica de resolución al crear una PO:**

```python
def resolver_aprobador(po_total: Decimal, creator_profile_id: str) -> list[str]:
    """
    Devuelve la lista de usuarios que pueden aprobar esta PO.
    Si el creador puede aprobar la suya (config) y tiene límite suficiente → se auto-aprueba.
    Si no → se notifica a todos los usuarios con límite >= po_total.
    Sin límite (null) → siempre puede aprobar (dueño).
    """
    config = get_po_approval_config(org_id)

    # Todos los usuarios con límite suficiente
    aprobadores = get_users_where(
        max_amount IS NULL OR max_amount >= po_total
    )

    if not config.creator_can_approve_own:
        aprobadores = [u for u in aprobadores if u.id != creator_profile_id]

    return aprobadores
```

**Estados de una PO:**

```
draft         → Borrador, aún no enviada a aprobación
pending       → Enviada a aprobación, esperando
approved      → Aprobada, lista para enviar al proveedor
sent          → Enviada al proveedor (PDF generado y enviado)
partially_received → Al menos una línea recibida parcialmente
received      → Todas las líneas recibidas en su totalidad
invoiced      → Factura del proveedor registrada y conciliada
closed        → Ciclo completo cerrado
cancelled     → Cancelada (solo desde draft o pending)
```

### 3.2 Modelo de Datos de PO

```sql
create table purchase_orders (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id),
  po_number       text unique not null,        -- PO-2024-0001, generado automáticamente
  supplier_id     uuid references suppliers(id),
  price_list_id   uuid references supplier_price_lists(id), -- null si precio manual
  -- Origen
  origin_type     text check (origin_type in (
    'manual',           -- Creada manualmente
    'mrp',              -- Generada desde el planificador de catering/MRP
    'reorder'           -- Generada por punto de reorden (futuro)
  )),
  catering_request_id uuid references catering_requests(id), -- Si viene del MRP
  -- Fechas
  requested_date  date,          -- Fecha en que se necesita la mercancía
  promised_date   date,          -- Fecha prometida por el proveedor
  -- Financiero
  currency        text default 'USD',
  subtotal        numeric(18,2),
  tax_amount      numeric(18,2) default 0,
  total           numeric(18,2),
  payment_terms_days integer,    -- Copiado del proveedor al crear, editable
  -- Estado y aprobación
  status          text check (status in (
    'draft','pending','approved','sent',
    'partially_received','received','invoiced','closed','cancelled'
  )) default 'draft',
  -- Envío
  sent_at         timestamp with time zone,
  sent_by         uuid references profiles(id),
  sent_to_email   text,
  -- Warehouse destino (para la recepción)
  warehouse_id    uuid references warehouses(id),
  -- Meta
  notes           text,
  created_by      uuid references profiles(id),
  created_at      timestamp with time zone default now()
);

create table purchase_order_lines (
  id              uuid default uuid_generate_v4() primary key,
  po_id           uuid references purchase_orders(id) on delete cascade,
  item_id         uuid references items(id),
  -- Cantidades
  qty_ordered_base        numeric(18,6) not null,
  presentation_id         uuid references uom_presentations(id),
  qty_ordered_presentation numeric(18,6),
  qty_received_base       numeric(18,6) default 0,  -- Acumulado de recepciones
  qty_pending_base        numeric(18,6),             -- Calculado: ordered - received
  -- Precio
  unit_cost_base          numeric(18,6) not null,
  unit_cost_presentation  numeric(18,6),
  line_total              numeric(18,2),
  -- Estado de la línea
  status          text check (status in (
    'pending', 'partially_received', 'received', 'cancelled'
  )) default 'pending'
);

-- Historial de aprobaciones (auditoría)
create table po_approvals (
  id          uuid default uuid_generate_v4() primary key,
  po_id       uuid references purchase_orders(id) on delete cascade,
  action      text check (action in ('approved', 'rejected', 'requested_changes')),
  approver_id uuid references profiles(id),
  notes       text,
  created_at  timestamp with time zone default now()
);
```

---

## 4. Recepción y Three-Way Matching

### 4.1 Vínculo con el módulo de inventario

El módulo de inventario ya gestiona la recepción mediante la tabla unificada `inventory_documents` (con `document_type = 'receipt'`). En este módulo se extiende para vincularse con una PO y generar el matching.

```sql
-- Extender inventory_documents con vínculo a PO
alter table inventory_documents
  add column po_id uuid references purchase_orders(id),
  add column supplier_id uuid references suppliers(id); -- Sustituye al campo de texto simple

-- Extender inventory_document_lines con qty recibida vs. pedida
alter table inventory_document_lines
  add column po_qty_ordered_base numeric(18,6),   -- Copiado de la línea de PO
  add column po_line_id uuid references purchase_order_lines(id),
  add column discrepancy_base numeric(18,6);      -- received - ordered (negativo = faltante)
```

### 4.2 Facturas de Proveedores

```sql
create table supplier_invoices (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id),
  supplier_id     uuid references suppliers(id),
  po_id           uuid references purchase_orders(id),
  receipt_id      uuid references inventory_documents(id),
  invoice_number  text not null,        -- Número de factura del proveedor
  invoice_date    date not null,
  due_date        date,                 -- Calculada: invoice_date + payment_terms_days
  -- Montos
  currency        text default 'USD',
  subtotal        numeric(18,2),
  tax_amount      numeric(18,2) default 0,
  total           numeric(18,2),
  -- Three-way matching
  matching_status text check (matching_status in (
    'pending',       -- Aún no conciliada
    'matched',       -- PO = Remisión = Factura (sin diferencias)
    'partial_match', -- Diferencias dentro de tolerancia aceptada
    'mismatch'       -- Diferencias que requieren resolución
  )) default 'pending',
  matching_notes  text,
  -- Estado de pago (delegado a Odoo por ahora, se prepara estructura futura)
  payment_status  text check (payment_status in (
    'unpaid',
    'exported',      -- Exportada a Odoo para pago
    'paid'
  )) default 'unpaid',
  exported_at     timestamp with time zone,
  -- Documentos
  pdf_url         text,                 -- Factura digital subida
  -- Meta
  created_by      uuid references profiles(id),
  created_at      timestamp with time zone default now()
);

create table supplier_invoice_lines (
  id              uuid default uuid_generate_v4() primary key,
  invoice_id      uuid references supplier_invoices(id) on delete cascade,
  po_line_id      uuid references purchase_order_lines(id),
  item_id         uuid references items(id),
  qty_invoiced_base    numeric(18,6),
  unit_cost_base       numeric(18,6),
  line_total           numeric(18,2),
  -- Diferencias vs. PO y recepción
  diff_vs_po_base      numeric(18,6),      -- invoiced - ordered
  diff_vs_receipt_base numeric(18,6)       -- invoiced - received
);
```

### 4.3 Three-Way Matching

Al registrar una factura vinculada a una PO y una recepción, el sistema calcula automáticamente las diferencias:

```
PO line:      qty_ordered   × unit_cost  = line_total_PO
Receipt line: qty_received  × unit_cost  = line_total_received
Invoice line: qty_invoiced  × unit_cost  = line_total_invoiced

matching_status:
  'matched'       → |diff_vs_po| ≤ tolerancia Y |diff_vs_receipt| ≤ tolerancia
  'partial_match' → diferencias existen pero dentro del % de tolerancia global
  'mismatch'      → diferencias superan la tolerancia → requiere resolución manual
```

La tolerancia de matching se configura en `po_approval_config` (ej: 2% = diferencias de hasta 2% se aceptan automáticamente).

### 4.4 Devoluciones y Notas de Crédito

```sql
create table supplier_returns (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id),
  receipt_id      uuid references inventory_documents(id),
  supplier_id     uuid references suppliers(id),
  po_id           uuid references purchase_orders(id),
  reason          text check (reason in (
    'damaged',          -- Mercancía dañada
    'wrong_item',       -- Artículo incorrecto
    'excess_qty',       -- Cantidad en exceso
    'quality',          -- No cumple calidad
    'expired'           -- Vencido o próximo a vencer
  )),
  status          text check (status in (
    'pending',          -- Devolución creada, pendiente de envío
    'sent',             -- Enviada al proveedor
    'credit_note_received', -- Proveedor emitió nota de crédito
    'closed'
  )) default 'pending',
  notes           text,
  created_by      uuid references profiles(id),
  created_at      timestamp with time zone default now()
);

create table supplier_return_lines (
  id          uuid default uuid_generate_v4() primary key,
  return_id   uuid references supplier_returns(id) on delete cascade,
  item_id     uuid references items(id),
  lot_id      uuid references stock_lots(id),
  qty_base    numeric(18,6) not null,
  unit_cost_base numeric(18,6),
  line_total  numeric(18,2)
);

create table supplier_credit_notes (
  id              uuid default uuid_generate_v4() primary key,
  return_id       uuid references supplier_returns(id),
  supplier_id     uuid references suppliers(id),
  credit_note_number text,
  amount          numeric(18,2),
  issue_date      date,
  applied_to_invoice_id uuid references supplier_invoices(id), -- Si se aplica a una factura
  status          text check (status in ('pending','applied','refunded')) default 'pending',
  created_at      timestamp with time zone default now()
);
```

---

## 5. Exportación a Odoo (CXP)

La gestión de Cuentas por Pagar (CXP) se realizará en Odoo de forma independiente. En VERUM, solo se registran las facturas (Three-way matching) y se exportan a Odoo para su pago. En un futuro, VERUM contará con su propio módulo de contabilidad.

```sql
-- Vista para exportación a Odoo
create or replace view v_odoo_invoice_export as
select
  si.id                   as invoice_id,
  si.invoice_number,
  s.name                  as supplier_name,
  si.invoice_date,
  si.due_date,
  si.total                as amount_total,
  si.currency,
  po.po_number
from supplier_invoices si
join suppliers s on s.id = si.supplier_id
left join purchase_orders po on po.id = si.po_id
where si.payment_status = 'unpaid'
order by si.invoice_date asc;
```

**Módulo de exportación muestra:**
* Facturas listas para exportar a Odoo (Three-way matching completado).
* Por proveedor: historial de facturas exportadas.

---

## 6. Índices y extensiones SQL

```sql
-- Proveedores
create index idx_suppliers_org      on suppliers(org_id, status);
create index idx_supplier_items     on supplier_items(item_id, supplier_id);
create index idx_price_list_item    on supplier_price_list_items(item_id, price_list_id);

-- POs
create index idx_po_supplier        on purchase_orders(supplier_id, status);
create index idx_po_status_date     on purchase_orders(status, requested_date);
create index idx_po_lines_po        on purchase_order_lines(po_id);
create index idx_po_lines_item      on purchase_order_lines(item_id);

-- Facturas y CXP
create index idx_invoices_supplier  on supplier_invoices(supplier_id, payment_status);
create index idx_invoices_due       on supplier_invoices(due_date) where payment_status != 'paid';

-- Evaluaciones
create index idx_evaluations_supplier on supplier_evaluations(supplier_id, period_start);
```

---

## 7. Requerimientos de la API

### 7.1 Proveedores

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/suppliers?org_id=&status=&search=` | Lista de proveedores con score y saldo CXP |
| `POST` | `/suppliers` | Crear proveedor |
| `GET` | `/suppliers/{id}` | Ficha completa: datos, contactos, métricas, historial de POs |
| `PATCH` | `/suppliers/{id}` | Editar proveedor |
| `GET` | `/suppliers/{id}/items` | Artículos que suministra |
| `POST` | `/suppliers/{id}/items` | Vincular artículo al proveedor con SKU y lead time |
| `GET` | `/suppliers/{id}/price-lists` | Catálogos de precios vigentes |
| `POST` | `/suppliers/{id}/price-lists` | Crear catálogo con sus líneas |
| `GET` | `/suppliers/{id}/metrics?from=&to=` | Métricas automáticas del período |
| `POST` | `/suppliers/{id}/evaluations` | Crear evaluación manual periódica |
| `GET` | `/suppliers/{id}/evaluations` | Historial de evaluaciones |

### 7.2 Órdenes de Compra

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/purchase-orders?status=&supplier_id=&from=&to=` | Lista de POs con filtros |
| `POST` | `/purchase-orders` | Crear PO (manual o desde MRP). Calcula precios del catálogo vigente automáticamente |
| `GET` | `/purchase-orders/{id}` | PO completa con líneas, aprobaciones y estado de matching |
| `PATCH` | `/purchase-orders/{id}` | Editar PO en `draft` |
| `POST` | `/purchase-orders/{id}/submit` | Enviar a aprobación → `pending`. Notifica a aprobadores |
| `POST` | `/purchase-orders/{id}/approve` | Aprobar PO. Valida que el aprobador tenga límite suficiente |
| `POST` | `/purchase-orders/{id}/reject` | Rechazar con nota → vuelve a `draft` |
| `POST` | `/purchase-orders/{id}/send` | Marcar como enviada al proveedor. Genera y adjunta PDF. Envía email |
| `GET` | `/purchase-orders/{id}/pdf` | Generar PDF de la PO para descarga o envío |
| `POST` | `/purchase-orders/{id}/cancel` | Cancelar (solo desde `draft` o `pending`) |
| `GET` | `/purchase-orders/from-mrp/{catering_request_id}` | Sugerir POs agrupadas por proveedor desde la lista de compras del MRP |

### 7.3 Recepción y Facturas

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/inventory/documents` | Crear recepción (`document_type = 'receipt'`) vinculada a una PO. Actualiza `qty_received_base` en líneas de PO |
| `PATCH` | `/inventory/documents/{id}/confirm` | Confirmar recepción. Genera movimientos de inventario PEPS. Calcula discrepancias |
| `POST` | `/supplier-invoices` | Registrar factura vinculada a PO y recepción. Calcula three-way matching automáticamente |
| `GET` | `/supplier-invoices/{id}` | Factura con detalle de matching |
| `PATCH` | `/supplier-invoices/{id}/mark-exported` | Marcar como exportada a Odoo → `exported` |
| `PATCH` | `/supplier-invoices/{id}/mark-paid` | Marcar como pagada (si se actualiza desde Odoo) → `paid` |
| `GET` | `/supplier-invoices/export?from=&to=` | Exportar facturas a CSV para Odoo |

### 7.4 Devoluciones

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/supplier-returns` | Crear devolución desde una recepción. Genera movimiento de egreso en inventario |
| `PATCH` | `/supplier-returns/{id}/send` | Marcar como enviada al proveedor |
| `POST` | `/supplier-returns/{id}/credit-note` | Registrar nota de crédito recibida del proveedor |

### 7.5 Configuración

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/po-approval-config/{org_id}` | Configuración de aprobación y tolerancia de matching |
| `PUT` | `/po-approval-config/{org_id}` | Guardar configuración |
| `GET` | `/po-approval-limits/{org_id}` | Límites por rol |
| `PUT` | `/po-approval-limits/{org_id}` | Configurar límite de aprobación por rol |

---

## 8. Requerimientos del Frontend

### 8.1 Rutas del módulo

```
-- Compras operativas
/purchasing                          → Dashboard de compras: POs activas y recepciones
/purchasing/orders                   → Lista de POs con filtros y estados
/purchasing/orders/new               → Crear PO manual
/purchasing/orders/[id]              → Detalle de PO con timeline de estado
/purchasing/orders/[id]/receive      → Formulario de recepción contra PO
/purchasing/invoices                 → Lista de facturas registradas
/purchasing/invoices/[id]            → Detalle de factura con matching
/purchasing/returns                  → Lista de devoluciones
/purchasing/export                   → Dashboard de exportación a Odoo

-- Proveedores
/suppliers                           → Directorio de proveedores
/suppliers/new                       → Crear proveedor
/suppliers/[id]                      → Ficha del proveedor
/suppliers/[id]/price-lists          → Catálogos de precios
/suppliers/[id]/evaluations          → Historial de evaluaciones y nueva evaluación

-- Configuración (admin)
/admin/settings/purchasing           → Límites de aprobación por rol y tolerancia matching
```

### 8.2 Dashboard de Compras (`/purchasing`)

```
┌──────────────────────────────────────────────────────────────┐
│  COMPRAS                                    Central Prod.    │
├─────────────┬──────────────┬───────────────┬────────────────┤
│  POs activas│ Pend. aprob. │ Por recibir   │  Fact. listas  │
│     12      │      3       │      5        │      8         │
├─────────────┴──────────────┴───────────────┴────────────────┤
│                                                              │
│  APROBACIONES PENDIENTES                                     │
│  PO-2024-0041  |  Distribuidora XYZ  |  $850.00  [Aprobar]  │
│  PO-2024-0043  |  Lácteos del Sur    |  $2,400.00 [Aprobar] │
│                                                              │
│  FACTURAS LISTAS PARA EXPORTAR (THREE-WAY MATCH OK)          │
│  ✅ Factura F-0821  |  Harina Total  |  $445.00             │
│  ✅ Factura F-0830  |  Aceites Mar   |  $218.00             │
│                                                              │
│  RECEPCIONES PENDIENTES                                      │
│  PO-2024-0039  |  Lácteos del Sur  |  Prom.: mañana         │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 Detalle de PO (`/purchasing/orders/[id]`)

Timeline de estado en la parte superior mostrando el recorrido de la PO:

```
[Borrador] → [Pendiente] → [Aprobada] → [Enviada] → [Recibida] → [Facturada] → [Cerrada]
                ✓ actual
```

Tabla de líneas con columnas: Artículo / Presentación / Cant. pedida / Cant. recibida / Precio unit. / Total.

Sección de aprobaciones: historial de quién aprobó/rechazó y cuándo.

Botones contextuales según estado:
* `draft` → [Enviar a aprobación] [Editar] [Cancelar]
* `pending` → [Aprobar] [Rechazar] *(solo si el usuario tiene límite suficiente)*
* `approved` → [Enviar al proveedor] [Descargar PDF]
* `sent` → [Registrar recepción] [Ver PDF]
* `partially_received` → [Registrar recepción adicional] [Registrar factura]
* `received` → [Registrar factura]

### 8.4 Formulario de Recepción contra PO (`/purchasing/orders/[id]/receive`)

Pre-cargado con las líneas de la PO. El usuario ingresa la cantidad realmente recibida:

```
┌──────────────────────────────────────────────────────────┐
│  Recepción — PO-2024-0041                                │
│  Proveedor: Distribuidora XYZ    Almacén: [Alm. Seco ▾] │
├────────────────┬──────────┬──────────┬───────────────────┤
│  Artículo      │ Pedido   │ Recibido │ Vencimiento       │
├────────────────┼──────────┼──────────┼───────────────────┤
│  Harina 00     │ 10 sacos │ [9  ]    │ [03/2025]         │
│  Aceite oliva  │  5 envas │ [5  ]    │ [—      ]         │
│  Levadura      │  2 kg    │ [2  ]    │ [01/2025]         │
├────────────────┴──────────┴──────────┴───────────────────┤
│  ⚠️ Harina 00: se recibirán 9 de 10 (falta 1 saco)      │
│                                                          │
│  N° Remisión proveedor: [____________]                   │
│  Notas: [_______________________________________]        │
│                                                          │
│  [Guardar borrador]      [Confirmar recepción]           │
└──────────────────────────────────────────────────────────┘
```

Al confirmar → crea lotes PEPS, actualiza stock, registra movimientos en kardex, actualiza `qty_received_base` en las líneas de PO, y cambia estado de PO a `partially_received` o `received` según corresponda.

### 8.5 Three-Way Matching (`/purchasing/invoices/[id]`)

```
┌───────────────────────────────────────────────────────────────┐
│  Factura F-0821  |  Distribuidora XYZ  |  Vence: 15/11/2024  │
│  ● MATCHED                                                    │
├──────────────┬──────────────┬──────────────┬──────────────────┤
│  Artículo    │  PO (pedido) │  Recibido    │  Facturado       │
├──────────────┼──────────────┼──────────────┼──────────────────┤
│  Harina 00   │  10 sacos    │   9 sacos    │   9 sacos  ✅    │
│  Aceite oliva│   5 envases  │   5 envases  │   5 envases ✅   │
│  Levadura    │   2 kg       │   2 kg       │   2.5 kg   ⚠️    │
├──────────────┴──────────────┴──────────────┴──────────────────┤
│  ⚠️  Levadura: facturado 2.5 kg vs. recibido 2 kg (+0.5 kg)  │
│     Diferencia: $1.50  —  Dentro de tolerancia (2%)           │
│                                                               │
│  Total PO:       $850.00                                      │
│  Total recibido: $822.50                                      │
│  Total factura:  $823.50  ← diferencia $1.00 (0.12%)         │
│                                                               │
│  [Marcar Exportada]    [Registrar devolución]                │
└───────────────────────────────────────────────────────────────┘
```

### 8.6 PDF de Orden de Compra

Generado client-side con `@react-pdf/renderer`. Contenido:

```
VERUM — Orden de Compra
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PO-2024-0041                   14/10/2024
Proveedor: Distribuidora XYZ
RIF: J-12345678-9
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Artículo         Cant.   Presentac.  P.Unit   Total
─────────────────────────────────────────────────────
Harina 00        10      Sacos 45kg  $45.00   $450.00
Aceite de oliva   5      Envase 5L   $28.00   $140.00
Levadura seca     2      kg          $12.50   $25.00
─────────────────────────────────────────────────────
                                  Subtotal:   $615.00
                                  IVA (16%):   $98.40
                                  TOTAL:      $713.40
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Condiciones: 30 días
Entregar en: Almacén Seco — Centro de Producción
Fecha requerida: 20/10/2024
Aprobado por: María García
```

El PDF se adjunta automáticamente al email enviado al proveedor.

### 8.7 Ficha del Proveedor (`/suppliers/[id]`)

Cuatro pestañas:

**Información** — datos generales, contactos, condiciones comerciales.

**Catálogos de precios** — lista de price lists con sus líneas y vigencias. Botón "Nuevo catálogo".

**Historial** — timeline de POs del proveedor con montos y estados. Métricas automáticas del período seleccionado: puntualidad, exactitud de cantidad, tasa de devolución, score calculado.

**Evaluaciones** — historial de evaluaciones manuales y formulario de nueva evaluación periódica con los tres campos (calidad, comunicación, flexibilidad) y espacio para notas.

---

## 9. Generación de POs desde el MRP

Cuando el planificador de catering genera la lista de compras (M22-PRD), el usuario puede convertirla en POs con un click. El sistema agrupa los artículos por proveedor preferido:

```
POST /purchase-orders/from-mrp/{catering_request_id}

El sistema:
1. Toma la lista de compras del catering request
2. Para cada artículo → busca supplier_items donde is_preferred = true
3. Agrupa artículos por proveedor
4. Crea una PO por proveedor en estado 'draft'
5. Precarga precios del catálogo vigente si existe
6. Devuelve las POs creadas para revisión
```

Si un artículo no tiene proveedor preferido → queda en una lista de "artículos sin proveedor asignado" para que el usuario los asigne manualmente antes de crear la PO.

---

## 10. Permisos del módulo (integración con M6-INV)

**Módulo: `purchasing`**

| Permiso key | Descripción |
|---|---|
| `purchasing.view` | Ver POs y facturas |
| `purchasing.create` | Crear POs y enviarlas a aprobación |
| `purchasing.approve` | Aprobar POs (sujeto al límite de monto configurado en su rol) |
| `purchasing.send` | Marcar PO como enviada al proveedor y generar PDF |
| `purchasing.receive` | Registrar recepciones contra PO |
| `purchasing.invoice` | Registrar facturas de proveedores |
| `purchasing.pay` | Programar pagos y marcar facturas como pagadas |
| `purchasing.return` | Crear devoluciones a proveedores |
| `purchasing.manage_suppliers` | Crear y editar proveedores, catálogos y evaluaciones |
| `purchasing.view_costs` | Ver precios, totales y valorización |
| `purchasing.configure` | Configurar límites de aprobación y tolerancias |
| `purchasing.export` | Exportar datos para Odoo |

---

## 11. Plan de Implementación — Milestones

```
M25-SRM  Directorio de proveedores y catálogos de precios
M26-SRM  Órdenes de compra + flujo de aprobación configurable
M27-SRM  PDF de PO + envío por email al proveedor
M28-SRM  Recepción contra PO + three-way matching
M29-SRM  Devoluciones y notas de crédito
M30-SRM  Exportación de facturas para Odoo
M31-SRM  Evaluación de proveedores (métricas + manual)
```

> ⚠️ M26 depende de M25. M28 depende de M26 y de la recepción unificada de inventario. M30 depende de M28. Respetar el orden estrictamente.

---

### ✅ M25-SRM — Directorio de Proveedores y Catálogos de Precios
**Victoria:** El admin puede registrar proveedores con sus condiciones comerciales, vincularlos a artículos del catálogo y cargar sus listas de precios con vigencias.

**SQL a agregar:** `suppliers`, `supplier_contacts`, `supplier_items`, `supplier_price_lists`, `supplier_price_list_items`, `po_approval_config`, `po_approval_limits`.

**Backend:**
* CRUD completo de proveedores y contactos.
* `POST /suppliers/{id}/items` — vincular artículo con SKU, lead time y flag de preferido.
* CRUD de catálogos de precios con validación de vigencias solapadas.
* `PUT /po-approval-limits` — configurar límite por rol. Validar que el rol "dueño" quede con null.

**Frontend:**
* `/suppliers` — tabla con nombre, score (vacío por ahora), saldo CXP (vacío), estado.
* `/suppliers/new` y `/suppliers/[id]` — ficha completa con tabs de información, catálogos e ítems vinculados.
* `/admin/settings/purchasing` — tabla de roles con campo editable de límite de aprobación. Toggle "el creador no puede aprobar su propia PO".

**Criterio de éxito:** Admin crea proveedor "Distribuidora XYZ" con condiciones 30 días, vincula Harina 00 como ítem preferido, carga catálogo de precios vigente hasta Dic 2024. Al crear después una PO con ese artículo, el precio se precarga automáticamente.

---

### ✅ M26-SRM — Órdenes de Compra y Flujo de Aprobación
**Victoria:** Se pueden crear POs manuales o desde el MRP. El flujo de aprobación por rol y monto funciona. Los aprobadores reciben notificación.

**SQL a agregar:** `purchase_orders`, `purchase_order_lines`, `po_approvals`.

**Backend:**
* `POST /purchase-orders` — crear PO con precarga de precios del catálogo vigente. Si `origin_type: 'mrp'`, recibe las líneas del catering request.
* `POST /purchase-orders/{id}/submit` — enviar a aprobación. Resolver aprobadores según límites configurados. Notificar.
* `POST /purchase-orders/{id}/approve` — validar que `approver.max_amount >= po.total`. Registrar en `po_approvals`. Si aprueba → `status: 'approved'`.
* `POST /purchase-orders/{id}/reject` — vuelve a `draft`. Notifica al creador.
* `GET /purchase-orders/from-mrp/{catering_request_id}` — agrupar por proveedor preferido.

**Frontend:**
* `/purchasing/orders` — lista con filtros de estado, proveedor y fecha. Badge de "X pendientes de tu aprobación".
* `/purchasing/orders/new` — formulario con selector de proveedor (filtra por artículo), líneas con búsqueda de artículo y presentación, precio precargado del catálogo.
* `/purchasing/orders/[id]` — timeline de estado, tabla de líneas, sección de aprobaciones con historial. Botones contextuales según estado y permisos del usuario.

**Criterio de éxito:** Supervisor crea PO de $800 → la envía a aprobación → el gerente (límite $1,000) la ve en su dashboard → la aprueba → el supervisor ve el estado actualizado a "Aprobada" → el dueño puede aprobar POs de cualquier monto.

---

### ✅ M27-SRM — PDF de PO y Envío al Proveedor
**Victoria:** La PO aprobada se puede descargar en PDF y enviar por email al proveedor directamente desde VERUM.

**SQL a agregar:** Sin tablas nuevas.

**Backend:**
* `GET /purchase-orders/{id}/pdf` — generar PDF con `@react-pdf/renderer` server-side o retornar los datos para generación client-side.
* `POST /purchase-orders/{id}/send` — enviar email al contacto principal del proveedor con el PDF adjunto. Registrar `sent_at`, `sent_by`, `sent_to_email`. Cambiar status a `sent`.
* Configuración de email: usar el servicio de email existente en VERUM (o Resend/SendGrid).

**Frontend:**
* Botón "Descargar PDF" en la PO aprobada — genera y descarga el PDF.
* Botón "Enviar al proveedor" — muestra modal con el email del contacto (editable), subject precargado y opción de agregar nota al email. Al confirmar envía y actualiza estado.
* El PDF sigue el formato definido en la sección 8.6.

**Criterio de éxito:** Admin hace click en "Enviar al proveedor" → confirma el email → el proveedor recibe un email formal con el PDF de la PO adjunto → en VERUM el estado cambia a "Enviada" con la fecha y hora del envío.

---

### ✅ M28-SRM — Recepción contra PO y Three-Way Matching
**Victoria:** Al recibir mercancía se registra contra la PO. Al cargar la factura del proveedor, el sistema hace el matching automático y señala discrepancias.

**SQL a agregar:** Alter `inventory_documents` e `inventory_document_lines` para agregar `po_id`, `supplier_id`, `po_line_id`, `discrepancy_base`. Crear `supplier_invoices`, `supplier_invoice_lines`.

**Backend:**
* `POST /inventory/documents` actualizado para recibir `po_id` en ingresos. Pre-carga líneas de la PO. Al confirmar: crea lotes PEPS, actualiza `qty_received_base` en líneas de PO, cambia estado de PO.
* `POST /supplier-invoices` — registrar factura. Calcular diffs vs. PO y vs. recepción. Determinar `matching_status` según tolerancia configurada. Actualizar estado de PO a `invoiced`.

**Frontend:**
* `/purchasing/orders/[id]/receive` — formulario de recepción pre-cargado con líneas de PO. Campos de cantidad recibida y vencimiento por línea. Alerta visual si hay discrepancias al ingresar.
* `/purchasing/invoices/[id]` — vista de three-way matching con tabla comparativa (sección 8.5). Badge de estado de matching con color: verde matched, amarillo partial, rojo mismatch.

**Criterio de éxito:** Se reciben 9 de 10 sacos de harina → PO pasa a `partially_received` → se registra la factura por 9 sacos → sistema muestra matching ✅ para todas las líneas → PO pasa a `invoiced`.

---

### ✅ M29-SRM — Devoluciones y Notas de Crédito
**Victoria:** Se puede registrar una devolución al proveedor desde una recepción. Al recibir la nota de crédito, se aplica a la factura correspondiente.

**SQL a agregar:** `supplier_returns`, `supplier_return_lines`, `supplier_credit_notes`.

**Backend:**
* `POST /supplier-returns` — crear devolución desde `receipt_id`. Genera movimiento de egreso en inventario (consume del lote recibido). Cambia estado a `pending`.
* `POST /supplier-returns/{id}/credit-note` — registrar nota de crédito. Si se aplica a una factura, ajusta el `total` pendiente de pago de esa factura.

**Frontend:**
* Botón "Registrar devolución" en la vista de recepción o de factura.
* Formulario de devolución: líneas pre-cargadas de la recepción, selección de razón por línea, cantidad a devolver.
* `/purchasing/returns` — lista de devoluciones con estado.

**Criterio de éxito:** Se recibe mercancía dañada → se crea devolución → el stock del almacén se descuenta automáticamente → el proveedor emite nota de crédito → se registra y se aplica a la factura → el saldo a pagar de esa factura se reduce.

---

### ✅ M30-SRM — Exportación para Odoo
**Victoria:** El admin puede exportar las facturas conciliadas a Odoo para su pago.

**SQL a agregar:** Vista `v_odoo_invoice_export` (ya definida en sección 5).

**Backend:**
* `PATCH /supplier-invoices/{id}/mark-exported` y `mark-paid`.
* `GET /supplier-invoices/export` — CSV con todas las facturas pendientes listas para importar en Odoo.

**Frontend:**
* `/purchasing/export` — tabla ordenada por fecha con filtro por proveedor.
* Botón "Marcar como Exportada".
* Botón "Exportar a CSV" → CSV para Odoo.

**Criterio de éxito:** Admin concilia 3 facturas → va a exportación → descarga CSV → lo importa en Odoo manualmente y marca las facturas como exportadas en VERUM.

---

### ✅ M31-SRM — Evaluación de Proveedores
**Victoria:** Cada proveedor tiene un score calculado automáticamente de su historial. Se puede agregar una evaluación manual periódica. El directorio muestra el score final.

**SQL a agregar:** `supplier_evaluations`.

**Backend:**
* `GET /suppliers/{id}/metrics?from=&to=` — calcular métricas automáticas del período: % POs a tiempo, % líneas sin discrepancia, % líneas con devolución.
* `POST /suppliers/{id}/evaluations` — guardar evaluación manual. Calcular `manual_score` como promedio de los tres campos. Calcular `final_score = auto_score × 0.70 + manual_score × 0.30`. Actualizar `suppliers.score`.

**Frontend:**
* `/suppliers/[id]` tab "Evaluaciones" — gráfica de score histórico por período. Formulario de nueva evaluación con los tres sliders (1–5) y campo de notas.
* `/suppliers` — columna de score con estrellas visuales y color (verde ≥4, amarillo 3–4, rojo <3).
* Badge en proveedor bloqueado por score bajo o deuda.

**Criterio de éxito:** Después de 3 POs con el mismo proveedor, el sistema calcula automáticamente puntualidad 80%, exactitud 95%, devoluciones 5%. El admin agrega evaluación manual con notas. El score final aparece en el directorio de proveedores.
