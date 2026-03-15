# VERUM_PRD_Inventario.md: Módulo de Inventario

> **Versión:** 2.1  
> **Estado:** En revisión  
> **Depende de:** VERUM.md (milestones M1–M6 completados)  
> **Milestones que agrega:** M7 (permisos), M8 (activos registro+QR), M9 (tickets), M10 (dashboard activos), M11 (utensilios conteo), M12 (utensilios dashboard)

---

## 1. Visión General del Módulo

Este módulo extiende VERUM con capacidades de control físico de activos y utensilios. Resuelve dos problemas crónicos en operaciones gastronómicas:

* **Pérdidas hormiga de utensilios:** cucharas, panes, manteles y utensilios que desaparecen gradualmente sin que nadie lo detecte hasta que el daño es notable.
* **Descontrol de activos:** equipos sin trazabilidad de fallas, reparaciones incompletas sin seguimiento, y sin alertas preventivas.

### Dos sub-módulos independientes

* **INV-A — Activos:** equipos de alto valor con identidad individual (QR, serial), historial de reparaciones como sistema de tickets multi-visita, y alertas de revisión preventiva.
* **INV-U — Utensilios:** conteo periódico por volumen con flujo de doble verificación (staff cuenta → supervisor confirma), conteo ciego configurable y alertas de discrepancia.

### Separación visual en el dashboard principal

El dashboard principal de VERUM **no se mezcla** con el módulo de inventario. El staff ve dos secciones claramente separadas:

```
┌─────────────────────────────────────┐
│  HOY                                │
│  ✅ Tienes 3 checklists pendientes  │  → navega a /checklists
│  📦 Tienes 2 conteos pendientes     │  → navega a /inventory/utensils
└─────────────────────────────────────┘
```

Cada sección es un card clickeable que lleva a su propio dashboard. La pantalla principal nunca muestra el detalle de ninguno de los dos — solo el conteo y el acceso rápido.

---

## 2. Sistema de Permisos Granular

> ⚠️ **Este es un cambio de arquitectura global.** Afecta a toda la plataforma VERUM, no solo al módulo de inventario. Debe implementarse en M7 antes de construir cualquier lógica de permisos nueva.

### 2.1 Problema con el sistema actual

El sistema actual usa `profiles.role` con tres valores fijos (`admin`, `encargado`, `staff`). Esto no permite ajustar qué puede hacer cada persona sin cambiar su rol completo. Un "Jefe de Cocina" puede necesitar confirmar conteos pero no crear activos — eso no es posible con roles fijos.

### 2.2 Modelo de permisos: Roles base + overrides individuales

El sistema funciona en dos capas:

**Capa 1 — Roles personalizados** (reemplazan los roles fijos actuales):
El admin crea roles con nombre libre (ej: "Jefe de Cocina", "Supervisor de Turno", "Staff General") y les asigna un conjunto de permisos.

**Capa 2 — Overrides por usuario:**
A un usuario específico se le puede otorgar o revocar un permiso individual que sobreescribe lo que dice su rol. Útil para casos excepcionales sin crear un rol nuevo.

### 2.3 Arquitectura de datos (SQL)

```sql
-- Roles personalizados por organización
create table custom_roles (
  id          uuid default uuid_generate_v4() primary key,
  org_id      uuid references organizations(id) on delete cascade,
  name        text not null,           -- "Jefe de Cocina", "Supervisor de Turno"
  description text,
  is_admin    boolean default false,   -- Si true, bypasea todos los permisos
  created_at  timestamp with time zone default now()
);

-- Catálogo de permisos disponibles en el sistema
-- Se define en código, no en DB. Se sincroniza al iniciar el backend.
create table permissions (
  id          uuid default uuid_generate_v4() primary key,
  module      text not null,   -- 'checklists', 'inventory_assets', 'inventory_utensils', 'admin'
  action      text not null,   -- 'view', 'create', 'edit', 'delete', 'confirm', 'close_ticket'
  key         text unique not null,  -- 'inventory_assets.create', 'inventory_utensils.confirm'
  description text
);

-- Permisos asignados a un rol
create table role_permissions (
  role_id       uuid references custom_roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Asignación de rol a usuario (un solo rol por usuario)
create table profile_roles (
  profile_id  uuid references profiles(id) on delete cascade unique,
  role_id     uuid references custom_roles(id) on delete cascade,
  primary key (profile_id)
);

-- Overrides individuales por usuario (sobreescribe el rol)
create table profile_permission_overrides (
  profile_id    uuid references profiles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  granted       boolean not null,  -- true = forzar grant, false = forzar revoke
  reason        text,              -- Nota del admin explicando el override
  created_by    uuid references profiles(id),
  created_at    timestamp with time zone default now(),
  primary key (profile_id, permission_id)
);

-- Migración: mantener campo role en profiles para compatibilidad
-- 'admin' → is_admin: true en su custom_role
-- 'encargado' → rol con permisos de supervisión (confirmar conteos, ver reportes)
-- 'staff' → rol base sin permisos especiales
-- El campo profiles.role pasa a ser opcional/legacy
```

### 2.4 Catálogo de permisos por módulo

Los permisos se organizan en módulos con toggles de acceso, y dentro de cada módulo hay acciones específicas:

**Módulo: `checklists`**

| Permiso key | Descripción |
|---|---|
| `checklists.view` | Ver lista de checklists del turno |
| `checklists.execute` | Ejecutar y enviar un checklist |
| `checklists.view_all` | Ver checklists de otros usuarios/turnos |
| `checklists.manage_templates` | Crear y editar plantillas de checklist |

**Módulo: `inventory_assets`**

| Permiso key | Descripción |
|---|---|
| `inventory_assets.view` | Ver lista y ficha de activos |
| `inventory_assets.report_fault` | Reportar falla en un activo (abre ticket) |
| `inventory_assets.add_ticket_entry` | Agregar entradas a un ticket de reparación abierto |
| `inventory_assets.close_ticket` | Marcar un ticket de reparación como resuelto |
| `inventory_assets.create` | Crear nuevos activos |
| `inventory_assets.edit` | Editar datos de un activo (nombre, serial, ubicación) |
| `inventory_assets.delete` | Eliminar activos (solo admin) |
| `inventory_assets.print_qr` | Imprimir código QR de un activo |
| `inventory_assets.review` | Marcar un activo como revisado (revisión preventiva) |

**Módulo: `inventory_utensils`**

| Permiso key | Descripción |
|---|---|
| `inventory_utensils.view` | Ver ítems y último conteo |
| `inventory_utensils.count` | Ejecutar un conteo de utensilios |
| `inventory_utensils.confirm_count` | Confirmar o corregir conteos pendientes |
| `inventory_utensils.manage_items` | Crear/editar ítems y categorías |
| `inventory_utensils.view_reports` | Ver reportes históricos de pérdidas |

**Módulo: `admin`**

| Permiso key | Descripción |
|---|---|
| `admin.manage_users` | Invitar usuarios, asignar roles |
| `admin.manage_roles` | Crear y editar roles personalizados |
| `admin.manage_venues` | Crear y editar sedes |
| `admin.view_dashboard` | Acceso al dashboard administrativo |
| `admin.view_reports` | Ver todos los reportes de compliance |

### 2.5 Lógica de resolución de permisos (backend)

```python
# services/permissions.py

def resolve_permission(profile_id: str, permission_key: str) -> bool:
    """
    Orden de resolución:
    1. Si el usuario tiene is_admin=True en su rol → True siempre
    2. Si hay un override individual (profile_permission_overrides) → usar ese valor
    3. Si el rol del usuario tiene el permiso → True
    4. Si ninguna condición → False
    """
    # 1. Check admin bypass
    if user_has_admin_role(profile_id):
        return True

    # 2. Check individual override
    override = get_override(profile_id, permission_key)
    if override is not None:
        return override.granted

    # 3. Check role permissions
    return user_role_has_permission(profile_id, permission_key)
```

### 2.6 Integración con FastAPI — Dependency Injection

Los permisos se integran como dependencias de FastAPI, no como decoradores ni validaciones manuales dentro del endpoint:

```python
# dependencies/permissions.py
from fastapi import Depends, HTTPException, status

def require_permission(permission_key: str):
    """
    Dependency factory. Uso:
      @router.post("/assets")
      async def create_asset(..., _=Depends(require_permission("inventory_assets.create"))):
    """
    async def _check(current_user = Depends(get_current_user)):
        if not resolve_permission(current_user.id, permission_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "detail": "missing_permission",
                    "required": permission_key
                }
            )
    return _check
```

### 2.7 UI de gestión de permisos (`/admin/settings/roles`)

Pantalla con dos columnas:

**Columna izquierda — Roles:**
* Lista de roles personalizados de la organización.
* Botón "Crear rol" con campo de nombre y descripción.
* Click en un rol muestra sus permisos en la columna derecha.

**Columna derecha — Permisos del rol:**
* Agrupados por módulo con un toggle general por módulo (activa/desactiva todos los permisos del módulo).
* Dentro de cada módulo, checkboxes individuales por acción.
* Cambios se guardan en tiempo real (auto-save).

**Vista de usuario individual (`/admin/settings/users/[id]`):**
* Muestra el rol único asignado y los permisos heredados de ese rol.
* Selector de rol (dropdown) — cada usuario tiene exactamente un rol.
* Sección "Overrides" donde el admin puede forzar grant o revoke de permisos específicos con campo de nota justificativa.
* Badge visual cuando un permiso tiene override activo (ícono de llave).

---

## 3. Sub-módulo INV-A — Activos

### 3.1 Definición

Un Activo es cualquier equipo o bien físico de valor significativo que requiere seguimiento individual. Cada activo tiene identidad propia (serial, QR), ubicación física y un historial de reparaciones modelado como **tickets**.

Ejemplos: nevera de bebidas, horno de convección, freidora industrial, máquina de espresso, extractor de humo, POS terminal.

### 3.2 Código QR — enlace directo a ficha

El campo `qr_code` de cada activo almacena un UUID único. El QR físico que se imprime y se pega en el equipo **codifica una URL pública** de la aplicación:

```
https://app.verum.com/inventory/assets/{qr_code}
```

Al escanear el QR con cualquier cámara (sin necesidad de abrir la app primero), el sistema:

1. Si el usuario tiene sesión activa → navega directamente a la ficha del activo.
2. Si no tiene sesión → redirige a login y luego a la ficha del activo (usando `?redirect=/inventory/assets/{qr_code}`).

Esta ruta `/assets/[qr_code]` es especial: acepta el `qr_code` UUID (no el `id` del activo) y lo resuelve en el backend via `GET /assets/qr/{qr_code}`.

**Contenido del QR impreso:**
* QR visual grande.
* Nombre del activo.
* Sede.
* ID corto legible (primeros 8 caracteres del UUID).

Librería sugerida: `qrcode` (npm) para generación, `react-to-print` para impresión desde el panel.

### 3.3 Modelo de datos

```sql
-- Categorías de activos (admin configura)
create table asset_categories (
  id        uuid default uuid_generate_v4() primary key,
  org_id    uuid references organizations(id) on delete cascade,
  name      text not null,           -- "Refrigeración", "Cocción", "POS"
  icon      text,                    -- Nombre de ícono Lucide
  review_interval_days integer default 30  -- Umbral de alerta de revisión
);

-- Activos individuales
create table assets (
  id            uuid default uuid_generate_v4() primary key,
  org_id        uuid references organizations(id) on delete cascade,
  venue_id      uuid references venues(id),
  category_id   uuid references asset_categories(id),
  name          text not null,
  serial        text,
  brand         text,
  model         text,
  purchase_date date,
  status        text check (status in (
    'operativo',
    'en_reparacion',
    'baja'
  )) default 'operativo',
  location_note text,
  last_reviewed_at timestamp with time zone,
  photo_url     text,
  qr_code       text unique not null, -- UUID generado al crear. Inmutable.
  created_at    timestamp with time zone default now()
);

create index idx_assets_venue    on assets(venue_id);
create index idx_assets_status   on assets(status);
create index idx_assets_qr       on assets(qr_code);
```

### 3.4 Sistema de Tickets de Reparación

Un ticket modela el ciclo de vida completo de una reparación: desde que se detecta la falla hasta que se resuelve, pasando por todas las visitas, compras de repuestos y esperas intermedias.

```sql
-- Ticket de reparación (uno por falla, puede tener múltiples entradas)
create table repair_tickets (
  id            uuid default uuid_generate_v4() primary key,
  asset_id      uuid references assets(id) on delete cascade,
  opened_by     uuid references profiles(id),
  closed_by     uuid references profiles(id),
  title         text not null,        -- "Falla en compresor" — resumen de la falla inicial
  status        text check (status in (
    'abierto',          -- Falla reportada, pendiente de atención
    'en_progreso',      -- Al menos una visita registrada
    'esperando',        -- Esperando repuesto, presupuesto, o próxima visita
    'resuelto'          -- Reparación completada y verificada
  )) default 'abierto',
  priority      text check (priority in ('baja', 'media', 'alta', 'critica')) default 'media',
  opened_at     timestamp with time zone default now(),
  closed_at     timestamp with time zone
  -- El status del activo se actualiza automáticamente:
  -- abierto/en_progreso/esperando → assets.status = 'en_reparacion'
  -- resuelto → assets.status = 'operativo'
  -- Nota: el costo total se calcula via la vista v_repair_ticket_costs,
  -- no se almacena como columna en esta tabla.
);

-- Entradas del ticket (historial cronológico)
create table repair_ticket_entries (
  id            uuid default uuid_generate_v4() primary key,
  ticket_id     uuid references repair_tickets(id) on delete cascade,
  created_by    uuid references profiles(id),
  type          text check (type in (
    'visita',           -- Vino el técnico
    'presupuesto',      -- Se recibió/aprobó un presupuesto
    'compra',           -- Se compraron repuestos
    'nota',             -- Nota interna sin visita física
    'cierre'            -- Entrada de cierre (resumen final)
  )),
  description   text not null,
  technician    text,              -- Nombre del técnico (solo en type: 'visita')
  cost          numeric(10,2),     -- Costo de esta entrada específica
  attachments   jsonb,             -- Array de URLs de fotos/docs: ["url1", "url2"]
  next_action   text,              -- Qué sigue: "Esperar presupuesto", "Comprar repuesto X"
  status_after  text check (status_after in ('abierto','en_progreso','esperando','resuelto')),
  -- Al crear la entrada, el ticket.status se actualiza a status_after
  created_at    timestamp with time zone default now()
);

-- Vista: costo total por ticket
create or replace view v_repair_ticket_costs as
select
  t.id as ticket_id,
  t.asset_id,
  t.title,
  t.status,
  t.opened_at,
  t.closed_at,
  coalesce(sum(e.cost), 0) as total_cost,
  count(e.id) filter (where e.type = 'visita') as visit_count,
  count(e.id) as entry_count
from repair_tickets t
left join repair_ticket_entries e on e.ticket_id = t.id
group by t.id;

create index idx_tickets_asset   on repair_tickets(asset_id);
create index idx_tickets_status  on repair_tickets(status);
create index idx_entries_ticket  on repair_ticket_entries(ticket_id);
```

### 3.5 Flujos Operativos

#### Flujo A1 — Reportar una falla (cualquier usuario con `inventory_assets.report_fault`)

1. Usuario escanea el QR del activo con la cámara del dispositivo.
2. El navegador abre `https://app.verum.com/assets/{qr_code}` directamente.
3. Si no hay sesión activa → login → redirect automático a la ficha del activo.
4. En la ficha, botón **"Reportar problema"** abre un formulario:
   * Título de la falla (texto libre).
   * Prioridad: Baja / Media / Alta / Crítica.
   * Descripción detallada.
   * Foto opcional.
5. Al confirmar → se crea un `repair_ticket` con `status: 'abierto'` y `assets.status` cambia a `'en_reparacion'`.
6. Notificación a usuarios con permiso `inventory_assets.close_ticket` en esa sede.

#### Flujo A2 — Agregar entrada a un ticket en curso (usuarios con `inventory_assets.add_ticket_entry`)

1. Desde la ficha del activo o desde `/admin/inventory/tickets`, abrir el ticket activo.
2. Click en **"Agregar entrada"** → seleccionar tipo: Visita / Presupuesto / Compra / Nota.
3. Completar el formulario según el tipo:
   * **Visita:** técnico, descripción de lo hecho, costo, fotos, qué sigue (`next_action`), nuevo status del ticket.
   * **Presupuesto:** descripción, monto, decisión (aprobado/rechazado), foto del doc.
   * **Compra:** descripción del repuesto, costo, fecha estimada de llegada.
   * **Nota:** texto libre + foto opcional.
4. Al guardar → `repair_ticket_entries` se crea y `repair_tickets.status` se actualiza a `status_after`.
5. Si `status_after = 'resuelto'` y el usuario tiene `inventory_assets.close_ticket` → el ticket se cierra y `assets.status` vuelve a `'operativo'`.
6. Si el usuario **no tiene** `inventory_assets.close_ticket` pero selecciona `status_after: 'resuelto'` → se guarda como `status_after: 'en_progreso'` y se genera una notificación al supervisor/admin para que lo cierre.

#### Flujo A3 — Vista del ticket (timeline)

La ficha del activo muestra el ticket activo (si existe) como un **timeline vertical** con todas las entradas en orden cronológico:

```
🔴 [ABIERTO] 12 oct — María G.
   "Falla en compresor, hace ruido extraño y no enfría"

🔵 [VISITA] 14 oct — Carlos (técnico externo)
   "Revisó el compresor. Necesita reemplazo del capacitor."
   Próximo paso: Esperar presupuesto de repuesto.
   Costo: $0

📄 [PRESUPUESTO] 16 oct — Admin
   "Presupuesto recibido: $85 USD. Aprobado."
   📎 presupuesto.pdf

🛒 [COMPRA] 17 oct — Admin
   "Capacitor comprado. Llega en 3-5 días hábiles."
   Costo: $85

🔵 [VISITA] 22 oct — Carlos (técnico externo)
   "Instaló el capacitor. Probado OK."
   Costo: $40 (mano de obra)

✅ [RESUELTO] 22 oct — Supervisor
   "Verificado funcionando correctamente."
   Costo total: $125
```

#### Flujo A4 — Revisión preventiva (usuarios con `inventory_assets.review`)

La revisión preventiva es independiente de los tickets de reparación. Sirve para verificar que un activo está funcionando correctamente y resetear el contador de `review_interval_days` de su categoría.

1. Desde la ficha del activo (escaneando QR o navegando desde la lista), botón **"Marcar como revisado"** visible si el usuario tiene permiso `inventory_assets.review`.
2. Al hacer click → bottom sheet con:
   * Nota opcional describiendo el estado observado.
   * Foto opcional como evidencia.
   * Checkbox: "Confirmo que el equipo está en condiciones operativas".
3. Al confirmar → se actualiza `assets.last_reviewed_at = now()` y se guarda un registro en `asset_reviews`.
4. El activo desaparece de la lista de "revisiones vencidas" en el dashboard admin.

```sql
-- Registro de revisiones preventivas
create table asset_reviews (
  id            uuid default uuid_generate_v4() primary key,
  asset_id      uuid references assets(id) on delete cascade,
  reviewed_by   uuid references profiles(id),
  notes         text,
  photo_url     text,
  created_at    timestamp with time zone default now()
);

create index idx_asset_reviews_asset on asset_reviews(asset_id);
```

### 3.6 Comportamiento de archivo (status `baja`)

Cuando un activo se marca con status `baja`:

* **No aparece** en las listas por defecto (filtro principal excluye `baja`).
* **Sí aparece** al activar el toggle "Mostrar archivados" en la UI de lista.
* **No se puede eliminar** si tiene tickets abiertos — primero debe cerrarse el ticket.
* **Se puede reactivar** cambiando el status de vuelta a `operativo`.
* Su historial de tickets y revisiones se conserva íntegramente.

### 3.7 Campos de referencia — Asset

| Campo | Tipo | Req. | Descripción |
|---|---|---|---|
| `name` | text | Sí | Nombre descriptivo. Ej: "Nevera Línea Fría #2" |
| `category_id` | uuid | Sí | Categoría. Admin configura las categorías y su intervalo de revisión. |
| `venue_id` | uuid | Sí | Sede donde está físicamente. |
| `serial` | text | No | Número de serie del fabricante. |
| `brand` / `model` | text | No | Marca y modelo. |
| `purchase_date` | date | No | Para cálculo de antigüedad. |
| `status` | enum | Auto | `operativo` / `en_reparacion` / `baja`. Se actualiza automáticamente desde los tickets. Activos en `baja` se tratan como archivados. |
| `location_note` | text | No | Descripción textual. Ej: "Cocina fría, lado izquierdo". |
| `last_reviewed_at` | timestamp | Auto | Se actualiza solo al completar una revisión preventiva (flujo A4) o al cerrar un ticket de reparación como resuelto. No se actualiza al agregar entradas intermedias al ticket. |
| `qr_code` | uuid | Auto | Generado al crear. Inmutable. Codifica la URL pública `/inventory/assets/{qr_code}`. |

---

## 4. Sub-módulo INV-U — Utensilios

### 4.1 Definición

Un Utensilio es un ítem de bajo costo y alto volumen que se gestiona por cantidad, no individualmente. El objetivo es detectar pérdidas entre conteos sucesivos antes de que sean acumulativamente significativas.

Ejemplos por categoría:

| Categoría | Ejemplos |
|---|---|
| Panadería | Pan 1/3, pan 1/6, pan de hot dog |
| Cubertería | Cucharas soperas, cucharas de té, tenedores, cuchillos |
| Lencería | Manteles, servilletas de tela, delantales, paños |
| Vajilla | Platos planos, platos hondos, tazas, bowls |
| Cristalería | Vasos de agua, copas de vino, vasos de jugo |

### 4.2 Modelo de datos

```sql
-- Categorías de utensilios
create table utensil_categories (
  id        uuid default uuid_generate_v4() primary key,
  org_id    uuid references organizations(id) on delete cascade,
  name      text not null,
  unit      text not null,   -- "unidades", "pares", "metros"
  icon      text
);

-- Ítems dentro de cada categoría
create table utensil_items (
  id               uuid default uuid_generate_v4() primary key,
  org_id           uuid references organizations(id) on delete cascade,
  category_id      uuid references utensil_categories(id) on delete cascade,
  venue_id         uuid references venues(id),
  name             text not null,
  expected_qty     integer not null,   -- Stock ideal
  location_note    text,
  alert_threshold  integer default 1,  -- Alerta si pérdida supera este número
  -- ✅ conteo ciego configurable por ítem
  blind_count      boolean default false,
  -- Si true: el staff NO ve expected_qty ni el último conteo al contar
  -- Si false: el staff ve el último conteo como referencia
  is_active        boolean default true  -- false = archivado, no aparece en conteos
);

-- Conteos periódicos
create table utensil_counts (
  id             uuid default uuid_generate_v4() primary key,
  item_id        uuid references utensil_items(id) on delete cascade,
  venue_id       uuid references venues(id),
  counted_by     uuid references profiles(id),
  confirmed_by   uuid references profiles(id),
  counted_qty    integer not null,
  confirmed_qty  integer,              -- null hasta que se confirme
  status         text check (status in (
    'pendiente_confirmacion',
    'confirmado',
    'con_discrepancia'
  )) default 'pendiente_confirmacion',
  notes          text,
  counted_at     timestamp with time zone default now(),
  confirmed_at   timestamp with time zone
);

-- Vista: último conteo confirmado por ítem
create or replace view v_utensil_last_count as
select distinct on (item_id)
  item_id,
  counted_qty,
  confirmed_qty,
  coalesce(confirmed_qty, counted_qty) as effective_qty,
  status,
  counted_at,
  confirmed_by
from utensil_counts
where status in ('confirmado', 'con_discrepancia')
order by item_id, counted_at desc;

create index idx_utensil_counts_item  on utensil_counts(item_id);
create index idx_utensil_counts_venue on utensil_counts(venue_id);
```

### 4.3 Conteo Ciego — Configuración

El conteo ciego es una funcionalidad por ítem que evita que el conteo del staff esté influenciado por lo que "se supone" que debe haber.

**Con `blind_count = false` (default):**
El staff ve el último conteo confirmado como referencia al lado de cada ítem. Útil para conteos rápidos de verificación.

**Con `blind_count = true`:**
El staff solo ve el nombre del ítem y el campo de entrada. No ve `expected_qty` ni el último conteo. El supervisor/admin ve la diferencia solo después de que el staff envía el conteo.

**¿Cuándo usar conteo ciego?**
* Ítems con historial de discrepancias sospechosas.
* Cuando se sospecha que alguien ajusta los números para que "cuadren".
* Auditorías periódicas de verificación.

**UI para activar:** Toggle por ítem en `/admin/inventory/utensils`. El staff nunca sabe si un ítem está en modo ciego o no — simplemente no ve la referencia.

### 4.4 Flujo de Doble Verificación

**Paso 1 — Staff ejecuta el conteo** (requiere `inventory_utensils.count`):

1. El staff ve en su dashboard: "Tienes 2 conteos pendientes" → click → `/inventory/utensils`.
2. Lista de ítems asignados. Cada ítem muestra:
   * Si `blind_count = false`: nombre, ubicación y último conteo como referencia.
   * Si `blind_count = true`: nombre y ubicación únicamente.
3. Input numérico grande por ítem (mínimo 44px de altura, optimizado para móvil).
4. Campo de nota opcional por ítem.
5. Indicador de alerta visual si el valor ingresado es menor al último conteo en más de `alert_threshold` unidades — **solo visible si `blind_count = false`**.
6. Botón "Enviar conteo" → crea todos los registros en `utensil_counts` en un solo request. Status: `pendiente_confirmacion`.

**Paso 2 — Supervisor confirma** (requiere `inventory_utensils.confirm_count`):

1. El supervisor ve en su panel: conteos pendientes de confirmación.
2. Para cada conteo ve: ítem, cantidad contada por el staff, último conteo confirmado anterior, diferencia.
3. Puede:
   * **Confirmar** el conteo tal como está → `status: 'confirmado'`.
   * **Corregir** ingresando su propio recuento → `confirmed_qty` difiere de `counted_qty` → `status: 'con_discrepancia'`.
4. Si la pérdida (`expected_qty - effective_qty`) supera `alert_threshold` → se genera una alerta en el panel admin.

### 4.5 Campos de referencia — Utensilio

| Campo | Tipo | Req. | Descripción |
|---|---|---|---|
| `name` | text | Sí | Ej: "Pan 1/3", "Cuchara sopera" |
| `expected_qty` | integer | Sí | Stock ideal al inicio de cada período |
| `location_note` | text | No | Dónde debe estar. Ej: "Estación de panadería" |
| `alert_threshold` | integer | No | Pérdida máxima antes de generar alerta. Default: 1 |
| `blind_count` | boolean | No | Si true: el staff no ve la cantidad de referencia al contar. Default: false |

### 4.5 Comportamiento de archivo (utensilios)

Cuando un utensilio se marca con `is_active = false`:

* **No aparece** en los conteos futuros ni en las listas por defecto.
* **Sí aparece** al activar el toggle "Mostrar archivados" en la UI de administración.
* Su historial de conteos se conserva íntegramente para reportes.
* **Se puede reactivar** cambiando `is_active` de vuelta a `true`.

### 4.6 Sistema de Programación de Conteos

El admin puede programar conteos periódicos y asignarlos a usuarios específicos. Cada programación define qué contar (todos los ítems, una categoría, o productos específicos), quién lo hace, y con qué frecuencia.

```sql
-- Programación de conteos
create table count_schedules (
  id            uuid default uuid_generate_v4() primary key,
  org_id        uuid references organizations(id) on delete cascade,
  venue_id      uuid references venues(id),
  assigned_to   uuid references profiles(id),
  name          text not null,              -- "Conteo semanal cubertería"
  frequency     text check (frequency in (
    'daily', 'weekly', 'biweekly', 'monthly', 'one_time'
  )) not null,
  scope         text check (scope in (
    'all',        -- Todos los ítems activos de la sede
    'category',   -- Solo ítems de una categoría específica
    'custom'      -- Lista específica de ítems seleccionados
  )) not null,
  category_id   uuid references utensil_categories(id),  -- solo si scope = 'category'
  next_due      date not null,
  last_completed_at timestamp with time zone,
  is_active     boolean default true,
  created_by    uuid references profiles(id),
  created_at    timestamp with time zone default now()
);

-- Ítems específicos de una programación (solo si scope = 'custom')
create table count_schedule_items (
  schedule_id   uuid references count_schedules(id) on delete cascade,
  item_id       uuid references utensil_items(id) on delete cascade,
  primary key (schedule_id, item_id)
);

create index idx_count_schedules_venue on count_schedules(venue_id);
create index idx_count_schedules_assigned on count_schedules(assigned_to);
```

**Flujo de programación:**

1. Admin abre `/admin/inventory/schedules` → lista de programaciones activas.
2. Botón "Nueva programación" → formulario:
   * Nombre descriptivo.
   * Sede.
   * Usuario asignado (dropdown de usuarios con permiso `inventory_utensils.count` en esa sede).
   * Frecuencia: diario / semanal / quincenal / mensual / una vez.
   * Alcance:
     * **Todos los productos:** conteo de todos los ítems activos de la sede.
     * **Por categoría:** selector de categoría → solo esos ítems.
     * **Productos específicos:** multi-select de ítems individuales.
   * Fecha de inicio (primer conteo).
3. Al guardar, el sistema calcula `next_due` según la frecuencia.
4. Cada día, el sistema verifica `next_due <= hoy` y genera la entrada en el dashboard del usuario asignado: "Tienes N conteos pendientes".
5. Al completar un conteo, `last_completed_at` se actualiza y `next_due` avanza según la frecuencia (excepto `one_time` que se marca `is_active = false`).

---

## 5. Requerimientos de la API

### 5.1 Permisos

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/permissions` | Lista todos los permisos disponibles agrupados por módulo |
| `GET` | `/roles?org_id=` | Lista roles personalizados de la organización |
| `POST` | `/roles` | Crear rol personalizado |
| `PATCH` | `/roles/{id}` | Editar nombre, descripción y permisos del rol |
| `DELETE` | `/roles/{id}` | Eliminar rol (solo si no hay usuarios asignados) |
| `POST` | `/roles/{id}/permissions` | Asignar permisos a un rol (array de permission keys) |
| `GET` | `/profiles/{id}/permissions` | Resolver permisos efectivos de un usuario (rol + overrides) |
| `POST` | `/profiles/{id}/overrides` | Crear override individual para un usuario |
| `DELETE` | `/profiles/{id}/overrides/{permission_key}` | Eliminar override |

### 5.2 Activos

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/asset-categories?org_id=` | Lista categorías de activos de la organización |
| `POST` | `/asset-categories` | Crear categoría con `review_interval_days` |
| `PATCH` | `/asset-categories/{id}` | Editar categoría |
| `DELETE` | `/asset-categories/{id}` | Eliminar categoría (solo si no tiene activos asociados) |
| `GET` | `/assets?venue_id=&status=&category_id=&include_archived=` | Lista con filtros. Por defecto excluye status `baja`. Incluye días desde última revisión y ticket activo si existe |
| `POST` | `/assets` | Crear activo. Genera `qr_code` UUID automáticamente |
| `GET` | `/assets/{id}` | Ficha completa con ticket activo y últimas 3 entradas del historial |
| `PATCH` | `/assets/{id}` | Actualizar campos (nombre, ubicación, foto, status). No modifica `qr_code` |
| `GET` | `/assets/qr/{qr_code}` | Resolver activo por QR. Usado al escanear. Requiere solo sesión activa |
| `GET` | `/assets/{id}/tickets` | Historial de todos los tickets del activo |
| `POST` | `/assets/{id}/tickets` | Abrir ticket de reparación. Actualiza `assets.status = 'en_reparacion'` |
| `GET` | `/tickets/{ticket_id}` | Ticket completo con todas sus entradas |
| `POST` | `/tickets/{ticket_id}/entries` | Agregar entrada al ticket. Actualiza `ticket.status` según `status_after` |
| `PATCH` | `/tickets/{ticket_id}/close` | Cerrar ticket. Actualiza `assets.status = 'operativo'`. Requiere permiso `close_ticket` |
| `GET` | `/assets/alerts/review-due?org_id=` | Activos que superaron el intervalo de revisión de su categoría |
| `POST` | `/assets/{id}/review` | Registrar revisión preventiva. Actualiza `last_reviewed_at`. Requiere `inventory_assets.review` |

### 5.3 Utensilios

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/utensil-categories?org_id=` | Lista categorías de utensilios de la organización |
| `POST` | `/utensil-categories` | Crear categoría |
| `PATCH` | `/utensil-categories/{id}` | Editar categoría |
| `DELETE` | `/utensil-categories/{id}` | Eliminar categoría (solo si no tiene ítems asociados) |
| `GET` | `/utensil-items?venue_id=&category_id=&include_archived=` | Lista con último conteo confirmado y diferencia vs `expected_qty`. Por defecto excluye `is_active = false` |
| `POST` | `/utensil-items` | Crear ítem |
| `PATCH` | `/utensil-items/{id}` | Editar ítem incluyendo toggle de `blind_count` y `is_active` |
| `POST` | `/utensil-counts` | Staff envía conteo. Crea N registros en un solo request. Respeta `blind_count` |
| `PATCH` | `/utensil-counts/{id}/confirm` | Supervisor confirma o corrige. Evalúa `alert_threshold` y genera alertas |
| `GET` | `/utensil-counts/pending?venue_id=` | Conteos pendientes de confirmación para el supervisor |
| `GET` | `/utensil-counts?item_id=&days=` | Historial de conteos de un ítem |
| `GET` | `/reports/utensil-losses?venue_id=&days=` | Pérdidas acumuladas por ítem y categoría en el período |
| `GET` | `/count-schedules?venue_id=` | Lista programaciones de conteo activas |
| `POST` | `/count-schedules` | Crear programación de conteo |
| `PATCH` | `/count-schedules/{id}` | Editar programación |
| `DELETE` | `/count-schedules/{id}` | Eliminar programación |
| `GET` | `/count-schedules/due?user_id=` | Conteos programados pendientes para un usuario (para el dashboard) |

> **Seguridad:** Todos los endpoints validan `Authorization: Bearer <JWT>`. Adicionalmente, cada endpoint verifica el permiso correspondiente via `require_permission()` como dependency de FastAPI (ver sección 2.6). Un 403 con body `{ "detail": "missing_permission", "required": "inventory_assets.create" }` facilita el debugging.

---

## 6. Requerimientos del Frontend

### 6.1 Dashboard principal — Separación de módulos

La pantalla principal (`/dashboard`) muestra dos secciones independientes:

```
Sección 1: Checklists de hoy
→ Card clickeable → navega a /checklists
→ Badge: "3 pendientes" o "Todo al día ✓"

Sección 2: Inventario pendiente  
→ Card clickeable → navega a /inventory
→ Badge: "2 conteos pendientes" (si tiene permiso inventory_utensils.count)
→ Badge: "1 ticket activo asignado" (si tiene activos en su sede con tickets abiertos)
→ Solo se muestra si el usuario tiene al menos un permiso de inventario
```

Ambas secciones son componentes independientes que se cargan en paralelo. Si el usuario no tiene ningún permiso de inventario, la sección de inventario no se renderiza.

### 6.2 Rutas del módulo

```
-- Staff / usuarios con permisos operativos (móvil)
/inventory                      → Hub: cards de Activos y Utensilios
/inventory/assets               → Lista de activos de la sede
/inventory/assets/[qr_code]     → Ficha del activo (accesible desde QR)
/inventory/utensils             → Lista de conteos asignados
/inventory/utensils/count       → Formulario de conteo

-- Admin / supervisores (panel)
/admin/inventory                → Dashboard de inventario
/admin/inventory/assets         → CRUD de activos + imprimir QR
/admin/inventory/tickets        → Lista de tickets activos con filtros
/admin/inventory/tickets/[id]   → Detalle de ticket con timeline
/admin/inventory/utensils       → CRUD de ítems + toggle blind_count
/admin/inventory/schedules      → Programación de conteos (crear, editar, asignar)
/admin/inventory/pending        → Conteos pendientes de confirmación
/admin/inventory/alerts         → Activos sin revisión + alertas de pérdida
/admin/inventory/reports        → Reporte histórico de pérdidas

-- Permisos (admin)
/admin/settings/roles           → Crear y editar roles personalizados
/admin/settings/users/[id]      → Perfil de usuario + overrides de permisos
```

### 6.3 Pantallas clave

#### Ficha de Activo (`/inventory/assets/[qr_code]`)

Accesible escaneando el QR desde cualquier cámara. Contiene:

* Header: foto del activo, nombre, categoría, badge de status.
* Detalles: serial, marca, modelo, sede, ubicación, fecha de compra, última revisión.
* **Si hay ticket activo:** card destacada con el status del ticket y el último `next_action`. Botón "Ver ticket completo" y, si tiene permiso `add_ticket_entry`, botón "Agregar entrada".
* **Si no hay ticket activo:** botón "Reportar problema" (requiere `report_fault`).
* Historial de tickets cerrados (colapsado por default).

#### Timeline del Ticket (`/admin/inventory/tickets/[id]`)

Timeline vertical cronológico con cada entrada tipificada visualmente:

* 🔴 **Apertura** — falla inicial con prioridad y descripción.
* 🔵 **Visita** — técnico, descripción, costo, fotos adjuntas, `next_action`.
* 📄 **Presupuesto** — monto, estado (aprobado/pendiente), archivo adjunto.
* 🛒 **Compra** — repuesto, costo, fecha estimada de llegada.
* 📝 **Nota** — texto libre, sin costo.
* ✅ **Cierre** — resumen final, costo total calculado.

Botón "Agregar entrada" fijo al fondo de la pantalla (sticky). Al hacer click, abre un bottom sheet con el formulario según el tipo de entrada seleccionado.

#### Formulario de Conteo Móvil (`/inventory/utensils/count`)

Optimizado para completarse en menos de 2 minutos:

* Lista de ítems asignados a la sede del usuario.
* Por cada ítem:
  * Si `blind_count = false`: nombre + última cantidad confirmada en texto pequeño + input numérico.
  * Si `blind_count = true`: nombre únicamente + input numérico. Sin ninguna referencia visual.
* Input numérico con botones `+` y `−` además del campo de texto (más rápido en móvil con el pulgar).
* Si `blind_count = false` y el valor es menor al umbral: borde del input en `warning`, sin bloquear el envío.
* Botón "Enviar conteo" sticky al fondo. Envía todos los ítems en un solo request.

#### Dashboard de Inventario Admin (`/admin/inventory`)

Una sola pantalla con tres bloques. Los bloques 1 y 3 se activan en M10 (activos completo). El bloque 2 se activa en M12 (utensilios completo) — hasta entonces muestra un placeholder "Próximamente".

**Bloque 1 — Estado de activos:**
* Score cards: total / operativos / en reparación / dados de baja.
* Lista de activos `en_reparacion` con días desde apertura del ticket y `next_action` pendiente.
* Lista de activos que superaron el intervalo de revisión de su categoría.

**Bloque 2 — Alertas de utensilios** *(activo desde M12):*
* Conteos pendientes de confirmación con nombre del staff y hora.
* Alertas activas de pérdida: ítem, diferencia detectada, sede.

**Bloque 3 — Tendencia y costos:**
* Hasta M10: bar chart de costos de reparación por categoría de activo.
* Desde M12: se agrega una segunda pestaña con pérdidas acumuladas de utensilios por categoría.

### 6.4 UI de Gestión de Roles (`/admin/settings/roles`)

```
┌────────────────────┬──────────────────────────────────────┐
│  ROLES             │  PERMISOS: Jefe de Cocina            │
│                    │                                      │
│  ● Jefe de Cocina  │  [◉] Checklists          [toggle]   │
│  ○ Supervisor      │    [✓] Ver checklists               │
│  ○ Staff General   │    [✓] Ejecutar checklist           │
│                    │    [✗] Ver todos los checklists      │
│  [+ Crear rol]     │    [✗] Gestionar plantillas         │
│                    │                                      │
│                    │  [◉] Inventario — Activos [toggle]  │
│                    │    [✓] Ver activos                  │
│                    │    [✓] Reportar falla               │
│                    │    [✓] Agregar entrada a ticket     │
│                    │    [✗] Cerrar ticket                │
│                    │    [✗] Crear activos                │
│                    │                                      │
│                    │  [○] Inventario — Utensilios        │
│                    │  [○] Administración                 │
└────────────────────┴──────────────────────────────────────┘
```

Toggle de módulo activa/desactiva todos los permisos del módulo de una vez. Cambios se guardan con auto-save (misma estrategia que el resto de VERUM).

---

## 7. Integración con el Dashboard Principal

La integración es **unidireccional y por referencia** — el dashboard principal solo consume conteos, no renderiza lógica del módulo de inventario directamente.

```typescript
// hooks/useDashboardSummary.ts
// Llamadas paralelas, independientes entre sí

const { data: checklistSummary } = useSWR('/checklists/today/summary', fetcher, {
  refreshInterval: 180_000
})

const { data: inventorySummary } = useSWR('/inventory/today/summary', fetcher, {
  refreshInterval: 180_000
})

// GET /inventory/today/summary devuelve:
// {
//   pending_counts: number,       -- conteos de utensilios pendientes de confirmar
//   active_tickets: number,       -- tickets de activos abiertos en la sede
//   overdue_reviews: number       -- activos sin revisión
// }
```

Si `inventorySummary` retorna error o el usuario no tiene permisos de inventario, la sección de inventario en el dashboard simplemente no se renderiza — sin errores visibles para el usuario.

---

## 8. Plan de Implementación — Milestones

El módulo se construye después del M6 del roadmap principal, en este orden estricto:

1. **Primero permisos** — base que todo lo demás necesita.
2. **Activos completos** — tres milestones verticales hasta tener el sub-módulo 100% funcional.
3. **Utensilios completos** — dos milestones una vez activos esté estable.
4. **Dashboard unificado** — solo al final, cuando hay datos reales de ambos sub-módulos.

```
M7   Permisos granulares                    ← base global
M8   Activos: registro + QR                 ← primera victoria de activos
M9   Activos: tickets de reparación          ← flujo completo multi-visita
M10  Activos: dashboard + alertas            ← activos 100% completo ✓
─────────────────────────────────────────────────────────────
M11  Utensilios: conteo + programación + doble verificación
M12  Utensilios: dashboard + reportes de pérdidas ← utensilios 100% completo ✓
```

> ⚠️ No comenzar M11 hasta que el criterio de éxito de M10 esté verificado.

---

### ✅ M7 — Sistema de Permisos Granular
**Victoria:** El admin puede crear roles personalizados con permisos específicos y asignar un rol único a cada usuario. Los overrides individuales por usuario funcionan.

**SQL a agregar:** `custom_roles`, `permissions`, `role_permissions`, `profile_roles` (con unique en `profile_id`), `profile_permission_overrides`

**Backend:**
* Seed inicial de `permissions` con todos los permission keys del catálogo definido en la sección 2.4.
* Endpoints CRUD de roles y asignación de permisos.
* Función `resolve_permission()` + dependency `require_permission()` de FastAPI (ver sección 2.6) — usada en todos los endpoints nuevos y migrada a los existentes.
* Migrar roles fijos actuales: `admin` → `custom_role` con `is_admin: true`, `encargado` → rol con permisos de supervisión, `staff` → `custom_role` base.

**Frontend:**
* `/admin/settings/roles` — layout dos columnas: lista de roles + checkboxes de permisos por módulo.
* `/admin/settings/users/[id]` — selector de rol único (dropdown) + overrides individuales con badge de llave y campo de nota justificativa.

**Criterio de éxito:** Un usuario con rol "Jefe de Cocina" puede ejecutar checklists pero no crear activos. Configuración completa desde el panel en menos de 2 minutos. Un 403 con `{ "required": "inventory_assets.create" }` al intentar una acción sin permiso.

---

### ✅ M8 — Activos: Registro, QR y Ficha
**Victoria:** El admin puede registrar activos con su información completa, generar e imprimir el QR físico, y cualquier usuario puede llegar a la ficha del activo escaneando ese QR con la cámara del teléfono.

**SQL a agregar:** `asset_categories`, `assets`, `asset_reviews`. Índice `idx_assets_qr` en `assets(qr_code)`.

**Backend:**
* `GET/POST/PATCH/DELETE /asset-categories` — CRUD completo de categorías con `review_interval_days`.
* `GET/POST /assets` — CRUD de activos. `POST` genera `qr_code` UUID automáticamente. `GET` excluye status `baja` por defecto (parámetro `include_archived`).
* `PATCH /assets/{id}` — editar campos (incluyendo status para archivar/reactivar). Nunca modifica `qr_code`.
* `GET /assets/qr/{qr_code}` — resolver activo por QR. Único endpoint que acepta el UUID del QR en lugar del `id`. Requiere solo sesión activa, sin permiso específico.
* `POST /assets/{id}/review` — registrar revisión preventiva (flujo A4). Actualiza `last_reviewed_at`.

**Frontend:**
* `/admin/inventory/assets` — tabla de activos con filtros por sede, categoría y status. Toggle "Mostrar archivados". Botón "Nuevo activo".
* Formulario de creación/edición de activo con todos los campos de la sección 3.7.
* Generación e impresión de QR: librería `qrcode` + `react-to-print`. La tarjeta impresa incluye nombre, sede, ID corto y QR grande.
* `/inventory/assets/[qr_code]` — ficha pública del activo. Si no hay sesión → login → redirect de vuelta. Botón "Marcar como revisado" (flujo A4). Muestra todos los campos pero sin tickets todavía (eso viene en M9).
* Escáner QR en `/inventory/assets/scan` con `html5-qrcode`. Solo se muestra si el navegador soporta `getUserMedia`.

**Criterio de éxito:** Admin crea un activo → imprime QR → pega la etiqueta en el equipo → cualquier usuario escanea el QR con la cámara del teléfono → llega a la ficha del activo sin tener la app abierta previamente. La revisión preventiva actualiza `last_reviewed_at` correctamente.

---

### ✅ M9 — Activos: Tickets de Reparación Multi-visita
**Victoria:** Una falla se reporta, se documenta a lo largo de múltiples visitas y compras, y se cierra cuando el activo está reparado. El status del activo se actualiza automáticamente en cada paso.

**SQL a agregar:** `repair_tickets`, `repair_ticket_entries`, vista `v_repair_ticket_costs`.

**Backend:**
* `POST /assets/{id}/tickets` — abrir ticket. Cambia `assets.status → 'en_reparacion'`. Requiere `inventory_assets.report_fault`.
* `GET /assets/{id}/tickets` — historial de tickets del activo (cerrados y activo).
* `GET /tickets/{ticket_id}` — ticket completo con todas las entradas ordenadas por fecha.
* `POST /tickets/{ticket_id}/entries` — agregar entrada. Actualiza `ticket.status` según `status_after`. **No actualiza `last_reviewed_at`** (eso solo ocurre al cerrar el ticket o en revisión preventiva). Requiere `inventory_assets.add_ticket_entry`.
* `PATCH /tickets/{ticket_id}/close` — cerrar ticket. Cambia `assets.status → 'operativo'` y actualiza `assets.last_reviewed_at`. Requiere `inventory_assets.close_ticket`. Si el usuario solo tiene `add_ticket_entry` e intenta cerrar → 403 + notificación al supervisor.
* Notificación al cierre de ticket a todos los usuarios con `close_ticket` en esa sede.

**Frontend:**
* Ficha del activo (`/inventory/assets/[qr_code]`) ahora muestra:
  * Si hay ticket activo: card con status, `next_action` pendiente y botones según permisos.
  * Si no hay ticket: botón "Reportar problema".
  * Historial de tickets cerrados (colapsado).
* `/admin/inventory/tickets` — lista de todos los tickets activos con filtros de sede, prioridad y días abierto.
* `/admin/inventory/tickets/[id]` — timeline vertical con todas las entradas tipificadas (ver sección 3.5). Botón "Agregar entrada" sticky abre un bottom sheet con selector de tipo y formulario dinámico.
* Bottom sheet por tipo de entrada:
  * **Visita:** técnico, descripción, costo, fotos, `next_action`, nuevo status del ticket.
  * **Presupuesto:** descripción, monto, estado (aprobado/pendiente), archivo adjunto.
  * **Compra:** repuesto, costo, fecha estimada de llegada.
  * **Nota:** texto libre + foto opcional.

**Criterio de éxito:** Flujo completo — staff reporta falla → encargado agrega entrada "Visita" + "Presupuesto" + "Compra" a lo largo de varios días → segunda visita cierra el ticket → activo vuelve a "operativo" en la lista → historial queda con costo total calculado.

---

### ✅ M10 — Activos: Dashboard, Alertas y Reportes
**Victoria:** Admin ve en una sola pantalla el estado completo de todos los activos: en reparación, sin revisión y costo acumulado de reparaciones. Activos 100% completo. ✓

**SQL a agregar:** Sin tablas nuevas. Confirmar que `v_repair_ticket_costs` existe.

**Backend:**
* `GET /inventory/assets/summary?org_id=` — datos para el dashboard: score cards (incluyendo activos archivados), lista de activos en reparación con días y `next_action`, lista de activos con revisión vencida.
* `GET /assets/alerts/review-due?org_id=` — activos que superaron `review_interval_days` de su categoría sin revisión preventiva reciente.
* `GET /reports/asset-costs?venue_id=&days=` — costo total de reparaciones por activo y por categoría en el período.
* `GET /inventory/today/summary?venue_id=` — endpoint liviano para el dashboard principal: `{ active_tickets, overdue_reviews }`. Sin datos de utensilios todavía (se completa en M12).

**Frontend:**
* `/admin/inventory` — dashboard de activos con los bloques 1 y la sección de activos del bloque 3 (Recharts). El bloque 2 (utensilios) se muestra como placeholder "Próximamente" hasta M12.
* Card de inventario en el dashboard principal (`/dashboard`) ahora aparece con `active_tickets` y `overdue_reviews`. Sin datos de utensilios todavía.
* `/admin/inventory/reports` — reporte de costos de reparación con filtros de fecha, sede y categoría.

**Criterio de éxito:** Admin abre `/admin/inventory` y ve en menos de 5 segundos cuántos activos están en reparación, cuáles llevan más días sin resolverse y cuánto se ha gastado en reparaciones este mes. La card en el dashboard principal muestra tickets activos correctamente.

---

### ✅ M11 — Utensilios: Conteo, Programación y Doble Verificación
**Victoria:** Staff ejecuta conteos programados desde móvil, supervisor confirma, discrepancias generan alertas. Conteo ciego funciona. Admin puede programar conteos y asignarlos a usuarios.

**SQL a agregar:** `utensil_categories`, `utensil_items`, `utensil_counts`, `count_schedules`, `count_schedule_items`, vista `v_utensil_last_count`.

**Backend:**
* `GET/POST/PATCH/DELETE /utensil-categories` — CRUD completo de categorías.
* `GET/POST /utensil-items` — CRUD de ítems con `blind_count`, `alert_threshold` y `is_active`. `GET` excluye archivados por defecto.
* `PATCH /utensil-items/{id}` — editar ítem incluyendo toggle de `blind_count` y `is_active`.
* `POST /utensil-counts` — staff envía conteo de N ítems en un solo request. El backend omite `expected_qty` y el último conteo en la respuesta si `blind_count = true` para ese ítem.
* `PATCH /utensil-counts/{id}/confirm` — supervisor confirma o corrige. Evalúa `alert_threshold` y genera alerta si corresponde.
* `GET /utensil-counts/pending?venue_id=` — conteos pendientes de confirmación.
* `GET/POST/PATCH/DELETE /count-schedules` — CRUD de programaciones de conteo.
* `GET /count-schedules/due?user_id=` — conteos programados pendientes para un usuario.
* Lógica de avance automático: al completar un conteo programado, `next_due` avanza según la frecuencia.

**Frontend:**
* `/admin/inventory/utensils` — CRUD de ítems y categorías. Toggle `blind_count` y `is_active` por ítem. Toggle "Mostrar archivados".
* `/admin/inventory/schedules` — programación de conteos: lista de programaciones, formulario de creación con selector de alcance (todos / categoría / productos específicos), usuario asignado y frecuencia.
* `/inventory/utensils` — lista de ítems con último conteo (si `blind_count = false`).
* `/inventory/utensils/count` — formulario móvil con inputs `+/−`, respetando `blind_count`.
* `/admin/inventory/pending` — pantalla de confirmación de conteos con vista de diferencias para el supervisor.
* Dashboard principal: card de inventario ahora incluye `pending_counts` de utensilios.

**Criterio de éxito:** Admin programa un conteo semanal de cubertería asignado a un usuario → el usuario ve el conteo pendiente en su dashboard → hace conteo ciego de 5 ítems en menos de 2 minutos → supervisor ve las diferencias y confirma → si alguna diferencia supera `alert_threshold` aparece alerta en el panel del admin.

---

### ✅ M12 — Utensilios: Dashboard y Reportes de Pérdidas
**Victoria:** Admin ve pérdidas acumuladas por categoría y los ítems con mayor pérdida del período. Utensilios 100% completo. Dashboard unificado de inventario activo. ✓

**SQL a agregar:** Sin tablas nuevas.

**Backend:**
* `GET /reports/utensil-losses?venue_id=&days=` — pérdidas acumuladas por ítem y categoría.
* Actualizar `GET /inventory/today/summary` para incluir `pending_counts` de utensilios y conteos programados pendientes.
* `GET /inventory/assets/summary` actualizado para incluir bloque de utensilios.

**Frontend:**
* `/admin/inventory` — dashboard completo con los 3 bloques activos (bloque 2 de utensilios ya no es placeholder).
* `/admin/inventory/reports` — nueva pestaña "Pérdidas de utensilios" con bar chart (Recharts) por categoría y tabla top 5 ítems con mayor pérdida.
* Dashboard principal: card de inventario muestra el resumen completo: tickets + revisiones vencidas + conteos pendientes.

**Criterio de éxito:** Admin abre el dashboard de inventario y tiene visibilidad completa de activos y utensilios en una sola pantalla. La card del dashboard principal refleja el estado real de ambos sub-módulos.

---

## 9. Librerías nuevas requeridas

| Librería | Versión | Milestone | Uso |
|---|---|---|---|
| `qrcode` | latest | M8 | Generar imagen QR desde el UUID del activo |
| `react-to-print` | latest | M8 | Imprimir ficha de QR desde el panel admin |
| `html5-qrcode` | latest | M8 | Escáner QR desde cámara del móvil en PWA |
| `swr` | latest | M10 | Data fetching con revalidación automática para dashboard |

No se agregan librerías de permisos externas — la lógica se implementa directamente en FastAPI con dependency injection y es suficiente para este caso de uso.

---

## 10. Decisiones de Diseño y Criterios Globales

* **QR como URL directa:** el QR siempre lleva a `https://app.verum.com/inventory/assets/{qr_code}`, una URL pública de la app que no requiere la app abierta. Funciona con cualquier cámara.
* **Tickets, no eventos aislados:** las reparaciones son tickets con ciclo de vida, no registros individuales. Esto permite seguimiento multi-semana y cálculo de costo total acumulado via la vista `v_repair_ticket_costs`.
* **Conteo ciego como herramienta de auditoría:** no es el modo default — el admin lo activa selectivamente en ítems con historial sospechoso o para auditorías periódicas.
* **Conteos programados:** el admin programa conteos con frecuencia y alcance configurable, asignados a usuarios específicos. El sistema calcula `next_due` automáticamente.
* **Dashboard principal sin lógica de inventario:** el dashboard solo muestra conteos. Toda la lógica vive en `/inventory` y `/admin/inventory`. Esto permite iterar cada módulo independientemente.
* **Sistema de permisos antes que el inventario:** M7 va primero porque el inventario tiene la lógica de permisos más compleja (report_fault vs add_entry vs close_ticket vs review son cuatro niveles distintos de la misma entidad). Construirlo sobre el sistema de permisos correcto desde el inicio evita refactors.
* **Un rol por usuario, overrides para excepciones:** cada usuario tiene exactamente un rol. Los overrides individuales permiten ajustes sin crear roles adicionales. Esto simplifica la UI y la resolución de permisos.
* **Resolución de permisos en backend, nunca solo en frontend:** el frontend puede ocultar botones según permisos para mejor UX, pero el backend siempre valida independientemente via `require_permission()` como dependency de FastAPI. Un 403 detallado facilita el debugging.
* **Archivado, no eliminación:** activos en status `baja` y utensilios con `is_active = false` son tratados como archivados. No aparecen en las listas por defecto pero son accesibles con un toggle "Mostrar archivados". Su historial se conserva íntegramente.