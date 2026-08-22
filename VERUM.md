# VERUM.md: Plataforma Integral de Gestión y Control Operativo

> **Documento Maestro de Arquitectura y Especificación del Sistema**  
> **Versión:** 3.0  
> **Estado:** Activo / En Producción  
> **Última Actualización:** Agosto 2026  

---

## 1. Visión General del Sistema

**VERUM** es una plataforma integral de gestión y control operativo diseñada para empresas de gastronomía, servicios y retail (restaurantes, cocinas centrales, dark kitchens, catering, cadenas comerciales).

El sistema digitaliza y conecta todos los eslabones de la cadena de valor operativa:
1. **Control y Calidad (Checklists):** Auditorías operativas de apertura, línea, turno y cierre, captura de evidencias fotográficas, alertas de fallas críticas y control de puntos clave (temperaturas, higiene).
2. **Inventario, Activos y Utensilios:** Control de activos fijos con trazabilidad QR y tickets de mantenimiento/reparación; auditorías y conteos ciegos de utensilios con flujo de verificación staff/supervisor.
3. **Producción, Recetas & MRP:** Control de almacenes (PEPS/Kardex valorizado), recetas con costeo automático en cascada y rendimiento, órdenes de producción con KDS interactivo, planificación MRP/Catering y etiquetado Zebra ZPL.
4. **Control de Asistencia & Personal:** Registro de jornadas (entrada/salida/pausas), turnos y horarios, cálculo de retrasos y horas extra, permisos/ausencias y reportes para nómina.
5. **Compras y Proveedores (SRM):** Directorio de proveedores, órdenes de compra (PO), facturación de compras, flujo de recepción física con matching de 3 vías y devoluciones.
6. **Ventas, Facturación & POS:** Catálogo de productos de venta (BOM de insumos y recetas vinculadas), facturación fiscal/libre, multimoneda con tasas cambiarias diarias, gestión de clientes y sesiones POS.
7. **Integraciones Bidireccionales (VerumQuick):** Conexión OAuth 2.0 y sincronización vía Outbox Pattern con terminales externas / Menú Digital Quick.

---

## 2. Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, `next-intl` (i18n ES/EN), `@tanstack/react-query`, `@dnd-kit`, `browser-image-compression`, `html5-qrcode`, `react-to-print`, `xlsx`. |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, Pydantic-Settings, Uvicorn, Pytest, Pytest-Asyncio, HTTPX. |
| **Base de Datos & Auth** | Supabase (PostgreSQL 15+, Row Level Security - RLS, Supabase Auth, Supabase Storage). |
| **Caché & Asincronía** | Redis (opcional/configurable vía `REDIS_URL`), `orjson`, Background Workers (`asyncio` outbox loop). |
| **Infraestructura** | Vercel (Frontend SSR/Edge), Render (Backend FastAPI), Supabase Cloud. |

---

## 3. Sistema de Diseño

### 3.1 Principios

VERUM es una herramienta operativa de uso intensivo en móvil, a veces en condiciones de baja luz (cocinas, almacenes, turnos nocturnos). El sistema de diseño debe priorizar:

- **Legibilidad ante todo:** contraste alto, tipografía clara, targets de toque generosos (mín. 44px).
- **Feedback inmediato:** cada interacción tiene un estado visual claro (loading, success, error, warning).
- **Modo oscuro de primera clase:** no es un afterthought. Ambos modos se definen desde el inicio y son igualmente válidos.

---

### 3.2 Paleta de Colores

Los colores se definen como CSS Custom Properties en `:root` (modo claro) y `[data-theme="dark"]` (modo oscuro). Tailwind consume estas variables vía `tailwind.config.js`.

```css
/* globals.css */

:root {
  /* --- Marca --- */
  --color-primary:        #2563EB;   /* Azul principal: botones, links, progress */
  --color-primary-hover:  #1D4ED8;
  --color-primary-light:  #EFF6FF;   /* Fondo sutil en badges, highlights */

  /* --- Semánticos de estado --- */
  --color-success:        #16A34A;   /* Completed, checks verdes */
  --color-success-light:  #F0FDF4;
  --color-warning:        #D97706;   /* Non-critical issues */
  --color-warning-light:  #FFFBEB;
  --color-error:          #DC2626;   /* Critical failures, errores */
  --color-error-light:    #FEF2F2;
  --color-locked:         #9CA3AF;   /* Checklists bloqueados */

  /* --- Neutros (UI base) --- */
  --color-bg:             #F9FAFB;   /* Fondo de página */
  --color-surface:        #FFFFFF;   /* Cards, modales, inputs */
  --color-surface-raised: #F3F4F6;   /* Hover states, fondos secundarios */
  --color-border:         #E5E7EB;
  --color-border-strong:  #D1D5DB;

  /* --- Tipografía --- */
  --color-text-primary:   #111827;   /* Títulos, labels principales */
  --color-text-secondary: #6B7280;   /* Subtítulos, metadata */
  --color-text-disabled:  #9CA3AF;
  --color-text-inverse:   #FFFFFF;   /* Texto sobre fondos oscuros/primarios */
}

[data-theme="dark"] {
  /* --- Marca --- */
  --color-primary:        #3B82F6;   /* Azul más brillante para contrastar con fondos oscuros */
  --color-primary-hover:  #60A5FA;
  --color-primary-light:  #1E3A5F;

  /* --- Semánticos de estado --- */
  --color-success:        #22C55E;
  --color-success-light:  #052E16;
  --color-warning:        #F59E0B;
  --color-warning-light:  #2D1B00;
  --color-error:          #F87171;
  --color-error-light:    #2D0000;
  --color-locked:         #6B7280;

  /* --- Neutros (UI base) --- */
  --color-bg:             #0F1117;   /* Fondo de página — casi negro, no puro */
  --color-surface:        #1A1D27;   /* Cards, modales */
  --color-surface-raised: #22263A;   /* Hover states, fondos secundarios */
  --color-border:         #2E3347;
  --color-border-strong:  #3D4463;

  /* --- Tipografía --- */
  --color-text-primary:   #F9FAFB;
  --color-text-secondary: #9CA3AF;
  --color-text-disabled:  #6B7280;
  --color-text-inverse:   #111827;
}
```

---

### 3.3 Tipografía

```js
// tailwind.config.js — fontFamily
fontFamily: {
  sans: ['Geist', 'system-ui', 'sans-serif'],  // Cuerpo, labels, UI general
  mono: ['Geist Mono', 'monospace'],            // Valores numéricos, temperaturas, IDs
}
```

| Uso | Clase Tailwind | Tamaño | Peso |
|---|---|---|---|
| Título de pantalla | `text-2xl font-bold` | 24px | 700 |
| Título de card | `text-base font-semibold` | 16px | 600 |
| Label de pregunta | `text-sm font-medium` | 14px | 500 |
| Metadata / timestamp | `text-xs text-secondary` | 12px | 400 |
| Valores numéricos (temp, %) | `text-base font-mono font-semibold` | 16px | 600 |

---

### 3.4 Tokens de Componentes Recurrentes

Estos patrones se repiten en toda la app y deben ser consistentes:

**Badges de estado:**
```
COMPLETED  → bg-success-light  text-success   border-success/20
IN PROGRESS→ bg-primary-light  text-primary   border-primary/20
PENDING    → bg-surface-raised text-secondary  border-border
LOCKED     → bg-surface-raised text-locked    border-border
```

**Botón primario:**
```
bg-primary text-inverse rounded-xl h-12 font-semibold
hover: bg-primary-hover
disabled: opacity-50 cursor-not-allowed
loading: spinner + "Guardando..."
```

**Botón secundario / outline:**
```
border border-border text-text-primary rounded-xl h-12
hover: bg-surface-raised
```

**Cards:**
```
bg-surface border border-border rounded-2xl p-4 shadow-sm
dark: bg-surface border-border (sin shadow, el contraste lo da el borde)
```

**Inputs:**
```
bg-surface border border-border rounded-xl px-4 h-12 text-text-primary
focus: border-primary ring-2 ring-primary/20
dark: bg-surface-raised border-border-strong
```

---

### 3.5 Implementación del Modo Oscuro

Se usa la estrategia `data-theme` en lugar del selector `dark:` de Tailwind para tener control total (no depender del sistema operativo si el usuario prefiere forzar un modo).

**Configuración en `tailwind.config.js`:**
```js
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary:        'var(--color-primary)',
        'primary-hover':'var(--color-primary-hover)',
        'primary-light':'var(--color-primary-light)',
        success:        'var(--color-success)',
        'success-light':'var(--color-success-light)',
        warning:        'var(--color-warning)',
        'warning-light':'var(--color-warning-light)',
        error:          'var(--color-error)',
        'error-light':  'var(--color-error-light)',
        locked:         'var(--color-locked)',
        bg:             'var(--color-bg)',
        surface:        'var(--color-surface)',
        'surface-raised':'var(--color-surface-raised)',
        border:         'var(--color-border)',
        'border-strong':'var(--color-border-strong)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary':'var(--color-text-secondary)',
        'text-disabled':'var(--color-text-disabled)',
        'text-inverse': 'var(--color-text-inverse)',
      }
    }
  }
}
```

**Hook para cambiar tema:**
```typescript
// hooks/useTheme.ts
// - Lee preferencia de: 1) localStorage → 2) prefers-color-scheme del SO
// - Aplica data-theme="dark"|"light" en <html>
// - Exposa: theme, toggleTheme()
// - Persiste la elección en localStorage ('verum-theme')
```

**Regla para Claude Code:** Al escribir cualquier clase de color en el frontend, **siempre usar los tokens** (`bg-surface`, `text-text-primary`, `border-border`) y **nunca hardcodear** colores de Tailwind directamente (`bg-white`, `text-gray-900`, `border-gray-200`). Esto garantiza que el modo oscuro funcione automáticamente en todos los componentes.

---

## 3. Arquitectura Multi-Tenant y Seguridad

### 3.1 Modelo Multi-Tenant y Multi-Sede
* **Super Administrador:** Consola central (`/super-admin`) para aprovisionar organizaciones y administradores raíz.
* **Organizaciones (`organizations`):** Empresas o franquicias aisladas (`org_id`).
* **Sedes / Locales (`venues`):** Puntos de venta, sucursales físicas o almacenes dependientes de una organización.
* **Contexto Activo:** El frontend envía el header `X-Org-ID` en cada solicitud; el backend resuelve automáticamente la pertenencia y alcance del usuario mediante `app.deps.get_active_org_id`.

### 3.2 Sistema de Permisos Granular (RBAC + Overrides)
El sistema utiliza una matriz de permisos de 2 capas:
1. **Roles Personalizados (`custom_roles` + `role_permissions`):** Perfiles definidos por la organización (ej: *Jefe de Cocina*, *Cajero*, *Auditor*, *Gerente de Compras*) asociados a claves de permisos funcionales (`checklists.read`, `inventory.manage`, `production.kds`, `sales.pos`, `purchasing.orders`, etc.).
2. **Overrides Individuales (`user_permission_overrides`):** Asignación explícita de `granted: true/false` por usuario y sede para habilitar o restringir acciones específicas.
3. **Restricción de Marcaje Obligatorio (`attendance.force_clock_in`):** Si un usuario tiene asignada esta política, el sistema bloquea cualquier acción operativa (checklists, producción, inventario) arrojando `403 CLOCK_IN_REQUIRED` hasta que registre su entrada en el módulo de asistencia.

---

## 4. Módulos del Sistema y Arquitectura Funcional

```
                                  ┌─────────────────────────────┐
                                  │      ORGANIZATIONS          │
                                  └──────────────┬──────────────┘
                                                 │
                   ┌─────────────────────────────┼────────────────────────────┐
                   │                             │                            │
            ┌──────▼──────┐               ┌──────▼──────┐              ┌──────▼──────┐
            │   VENUES    │               │  PROFILES   │              │CUSTOM_ROLES │
            └──────┬──────┘               └──────┬──────┘              └──────┬──────┘
                   │                             │                            │
  ┌────────────────┼─────────────────────────────┼────────────────────────────┤
  │                │                             │                            │
┌─▼──────────────┐ │ ┌─────────────────────────┐ │ ┌────────────────────────┐ │ ┌──────────────────────┐
│  CHECKLISTS    │ │ │ INVENTARIO & ALMACENES  │ │ │  PRODUCCIÓN & RECETAS  │ │ │  COMPRAS (SRM)       │
├────────────────┤ │ ├─────────────────────────┤ │ ├────────────────────────┤ │ ├──────────────────────┤
│• templates     │ │ │• warehouses             │ │ │• items (MP/SEMI/PT)    │ │ │• suppliers           │
│• questions     │ │ │• stock_movements (PEPS) │ │ │• recipes & ingredients │ │ │• purchase_orders     │
│• submissions   │ │ │• inventory_documents    │ │ │• production_orders     │ │ │• supplier_invoices   │
│• answers       │ │ │• physical_inventories   │ │ │• catering_orders       │ │ │• srm_returns         │
│                │ │ │• assets & utensils      │ │ │• kds_orders & stations │ │ │• supplier_evaluations│
└────────────────┘ │ └─────────────────────────┘ │ └────────────────────────┘ │ └──────────────────────┘
                   │                             │                            │
                   │ ┌─────────────────────────┐ │ ┌────────────────────────┐ │ ┌──────────────────────┐
                   └─►  ASISTENCIA & RRHH      │ └─►  VENTAS, POS & BILLING │ └─► INTEGRACIONES QUICK  │
                     ├─────────────────────────┤   ├────────────────────────┤   ├──────────────────────┤
                     │• employee_shifts        │   │• sales_items & combos  │   │• quick_integrations  │
                     │• attendance_records     │   │• sales_invoices & items│   │• integration_events  │
                     │• absence_requests       │   │• sales_payments        │   │  (Outbox Sync Worker)│
                     │• break_records          │   │• currencies & rates    │   │                      │
                     └─────────────────────────┘   └────────────────────────┘   └──────────────────────┘
```

### 4.1 Módulo 1: Checklists y Auditorías Operativas
* **Plantillas & Preguntas:** Plantillas con programación horaria (`shift`, `frequency`, `available_from_time`, `due_time`), dependencias (`prerequisite_template_id`) y reusabilidad global (`is_reusable`). Tipos de pregunta: `check`, `text`, `number`, `photo`, `slider`, `yes_no`, `multi_option`, `select`.
* **Flujo de Ejecución en 2 Pasos (Check → Review):**
  1. *Step 1 (Check):* Diligenciamiento con **Auto-Save** en segundo plano (`useAutoSave` con debounce inteligente e inserción idempotente con `ON CONFLICT`).
  2. *Step 2 (Review):* Resumen de hallazgos críticos/no críticos, galería de evidencias fotográficas etiquetadas, notas del auditor y confirmación final (`status: 'completed'`).

### 4.2 Módulo 2: Inventario, Activos y Utensilios
* **Activos Fijos (`assets`):** Registro de maquinaria/equipos, generación de códigos QR imprimibles, tickets de mantenimiento/reparación multi-visita (`repair_tickets`, `ticket_visits`) y costos acumulados de mantenimiento.
* **Control de Utensilios (`utensils`):** Cronogramas de conteo periódico (`count_schedules`), conteos ciegos configurables, registro de stock físico vs teórico y cálculo de mermas/pérdidas hormiga.
* **Documentos de Inventario Unificados (`inventory_documents`):** Recepciones de mercancía, salidas/mermas por merma/daño/ajuste y traslados entre almacenes (`transfers`) con confirmación de recepción.
* **Kardex y Valorización PEPS:** Valuación por capas de entrada (Primeras Entradas, Primeras Salidas), trazabilidad de lotes y snapshots de stock histórico.
* **Conteos Físicos (`physical_inventories`):** Procesos de toma de inventario general por almacén con bloqueo, escaneo de códigos de barra e importación/exportación de planillas Excel.

### 4.3 Módulo 3: Producción, Fichas Técnicas & MRP
* **Maestro de Artículos (`items`):** Clasificación en materia prima (`raw_material`), semiterminado (`semi_finished`), producto terminado (`finished`), empaque (`packaging`) y suministros (`supply`). Unidades de medida base (`g`, `ml`, `unit`) y factores de conversión por presentación.
* **Recetas & Fichas Técnicas (`recipes`):** Árbol de ingredientes con cálculo automático de costo en cascada, porcentaje de merma/rendimiento, margen de seguridad y sub-recetas anidadas.
* **Órdenes de Producción (`production_orders`):** Planificación por turnos y lotes. Deducción automática de inventario de materia prima según fórmula y acreditación de stock de producto terminado en almacén destino.
* **Tablero KDS (`/production/kds`):** Pantalla táctil de cocina en tiempo real para visualizar órdenes pendientes, en preparación y listas, con actualización interactiva de estados.
* **Catering & MRP:** Cálculo de requerimientos netos de insumos para eventos/pedidos proyectados, generación automática de lista de compras y órdenes de producción sugeridas.
* **Etiquetado Zebra ZPL (`/admin/production/labels`):** Generación de etiquetas con código de barras, lote, fecha de elaboración y vencimiento para productos semielaborados o terminados.

### 4.4 Módulo 4: Control de Asistencia y Personal
* **Turnos & Horarios (`employee_shifts`):** Asignación de jornadas con tolerancia de entrada, ventanas de marcación y días laborables.
* **Marcaje Operativo (`/attendance`):** Marcación de Entrada, Pausa (almuerzo/descanso), Fin de Pausa y Salida.
* **Cálculo Automático:** Detección de retrasos (minutos tarde), cálculo de horas extras trabajadas y estado de turno en vivo.
* **Ausencias & Permisos (`absence_requests`):** Solicitudes de permisos médicos, vacaciones o ausencias justificadas con flujo de aprobación administrativa.
* **Reportes de Asistencia:** Matriz de asistencia por rango de fechas, horas efectivas y exportación consolidada para liquidación de nómina.

### 4.5 Módulo 5: Compras y Proveedores (SRM)
* **Directorio de Proveedores (`suppliers`):** Fichas con RIF/Tax ID, condiciones comerciales (días de crédito), contactos y catálogo de precios negociados por insumo.
* **Órdenes de Compra (`purchase_orders`):** Ciclo completo (Borrador → Aprobada → Enviada → Recibida Parcial/Total → Cancelada). Generación y descarga de PDF formal.
* **Three-Way Matching:** Cruce y conciliación entre Orden de Compra (PO), Documento de Recepción física (Almacén) y Factura del Proveedor (`supplier_invoices`).
* **Devoluciones a Proveedores (`srm_returns`):** Registro de mercancía rechazada con motivo, ajuste de cuenta y balance.

### 4.6 Módulo 6: Ventas, Facturación & POS
* **Catálogo de Ventas (`sales_items`):** Productos finales listos para la venta, combos y modificadores. Cada ítem puede vincularse a una receta de producción o a un insumo directo para deducción automática de stock en el momento de la venta.
* **Monedas & Tasas Cambiarias (`currencies`, `exchange_rates`):** Manejo multimoneda (USD base, moneda local como VEF, COP, etc.) con registro diario de tasas oficiales/paralelas y políticas de redondeo.
* **Facturación & Clientes (`sales_invoices`, `sales_customers`):** Emisión de comprobantes fiscales y recibos de venta con desglose de impuestos (`taxes`), numeración correlativa (`sales_sequences`) y registro de múltiples formas de pago (`sales_payments`: efectivo, tarjeta, transferencia, pago móvil).
* **Terminal Punto de Venta (`/pos/session`):** Interfaz para apertura/cierre de caja, emisión rápida de comandas y cobro.

### 4.7 Módulo 7: Integraciones Bidireccionales (VerumQuick)
* **Handshake & Conexión OAuth 2.0:** Flujo de autorización vía popup y webhooks para enlazar sedes de VERUM con cuentas de Quick.
* **Outbox Pattern Asíncrono:** Emisión de eventos (`catalog.sync`, `menu.update`, `stock.alert`) procesados por el worker en segundo plano con firmas HMAC seguras y reintentos automáticos.

---

## 5. Estructura del Repositorio

```
verum/
├── backend/
│   ├── app/
│   │   ├── admin/          # Gestión de roles, permisos, usuarios y sedes
│   │   ├── attendance/     # Marcajes, turnos, ausencias y reportes de RRHH
│   │   ├── auth/           # Sincronización de perfiles Supabase Auth y sesión
│   │   ├── catering/       # Módulos de catering y eventos
│   │   ├── checklists/     # Plantillas, preguntas, auto-save y submissions
│   │   ├── integrations/   # Handshake OAuth, eventos y worker Outbox de Quick
│   │   ├── inventory/      # Activos fijos, tickets de reparación y utensilios
│   │   ├── production/     # Insumos, recetas, almacenes, Kardex, KDS, MRP, docs
│   │   ├── purchasing/     # Proveedores, órdenes de compra (SRM), facturas y matching
│   │   ├── sales/          # Catálogo de venta, POS, facturación y pagos
│   │   ├── superadmin/     # Panel de administración global multi-empresa
│   │   ├── transfers/      # Traslados entre almacenes y confirmaciones
│   │   ├── cache.py        # Adaptador Redis / orjson para cacheo rápido
│   │   └── deps.py         # Dependencias de seguridad, permisos y Org ID
│   ├── migrations/         # 70+ scripts SQL incrementales (001 a 069 + seeds)
│   ├── tests/              # Suite de pruebas unitarias y de integración (Pytest)
│   ├── main.py             # Entrypoint FastAPI y montaje de routers
│   └── database.py         # Conexión cliente Supabase
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/      # Panel Admin (Checklists, Inventario, Producción, SRM, Ventas...)
│   │   │   ├── attendance/ # Vista móvil de marcación de personal
│   │   │   ├── checklist/  # Vista móvil de ejecución de checklists (Step 1 y 2)
│   │   │   ├── dashboard/  # Portal principal operativo del empleado
│   │   │   ├── inventory/  # Vistas operativas de conteo y escaneo QR
│   │   │   ├── login/      # Autenticación y recuperación de credenciales
│   │   │   ├── production/ # KDS de cocina y visualización de órdenes
│   │   │   ├── super-admin/# Consola de administración multi-tenant global
│   │   │   └── venue-selection/ # Selector de sede y contexto activo
│   │   ├── components/     # UI Componentes Shadcn, I18n, Theme, Modales, Tablas
│   │   ├── hooks/          # useAutoSave, useTheme, usePermissions, useVenue
│   │   └── lib/            # Clientes API HTTP, Supabase client y tipados TypeScript
│
├── docs/                   # Especificaciones PRD detalladas y planes de arquitectura
└── VERUM.md                # Este documento maestro
```

---

## 6. Catálogo de Endpoints API (FastAPI)

### 6.1 Autenticación y Contexto (`/auth`)
* `POST /auth/sync`: Sincroniza el usuario de Supabase Auth con la tabla `profiles`.
* `GET /auth/me`: Retorna los datos del perfil actual, organizaciones vinculadas y permisos resueltos.

### 6.2 Checklists (`/checklists`, `/submissions`)
* `GET /checklists/{venue_id}`: Lista plantillas activas, cálculo de bloqueo por prerequisito y drafts en curso.
* `POST /submissions`: Inicializa un submission en `draft` (idempotente).
* `PUT /submissions/{id}/answers`: Auto-save masivo con upsert sobre `answers`.
* `PATCH /submissions/{id}`: Finalización (`status: completed`), notas del auditor y alertas.
* `GET /reports/compliance`: Estadísticas y métricas de cumplimiento para gerencia.

### 6.3 Inventario & Activos (`/inventory`)
* `GET/POST /inventory/assets`: Catálogo de activos y generación de etiquetas QR.
* `GET/POST /inventory/tickets`: Creación y seguimiento de tickets de reparación.
* `POST /inventory/tickets/{id}/visits`: Registro de visitas técnicas y repuestos.
* `GET/POST /inventory/utensils`: Gestión de catálogo de utensilios y conteos periódicos.
* `POST /inventory/schedules`: Configuración de cronogramas de conteo.

### 6.4 Producción, Almacenes y Recetas (`/production`, `/warehouses`)
* `GET/POST /production/items`: Maestro de artículos (materias primas, insumos, terminados).
* `GET/POST /production/recipes`: Fichas técnicas, ingredientes y cálculo de costos.
* `GET/POST /production/orders`: Órdenes de producción y cambio de estado en KDS.
* `GET /production/kds`: Listado en tiempo real de comandas de producción para cocina.
* `GET/POST /production/documents`: Emisión de documentos de inventario (ingreso, egreso, merma).
* `GET/POST /inventory/transfers`: Solicitud, despacho y recepción de traslados.
* `GET /production/kardex`: Reporte histórico de movimientos valorizados en PEPS.
* `GET/POST /production/physical-inventories`: Auditorías de conteo físico y ajustes.

### 6.5 Asistencia & RRHH (`/attendance`, `/employee-shifts`)
* `GET/POST /employee-shifts`: Definición de turnos, horarios y asignación de personal.
* `POST /attendance/clock-in`: Marcación de inicio de jornada laboral.
* `POST /attendance/break-start` & `break-end`: Control de tiempos de descanso/almuerzo.
* `POST /attendance/clock-out`: Marcación de fin de jornada y cálculo de horas extras.
* `GET/POST /attendance/absences`: Registro y aprobación de solicitudes de ausencia/permisos.
* `GET /attendance/reports`: Matriz consolidada de asistencia y horas trabajadas.

### 6.6 Compras y Proveedores (`/purchasing`, `/suppliers`)
* `GET/POST /suppliers`: Directorio y catálogo de precios de proveedores.
* `GET/POST /purchasing/orders`: Creación, aprobación y generación en PDF de Purchase Orders.
* `POST /purchasing/match`: Conciliación de 3 vías (PO vs Remisión de Almacén vs Factura).
* `GET/POST /purchasing/invoices`: Registro de facturas por pagar y comprobantes.
* `GET/POST /purchasing/returns`: Registro y gestión de devoluciones a proveedores.

### 6.7 Ventas, Facturación & POS (`/sales`)
* `GET/POST /sales/items`: Catálogo de productos para la venta y enlace de recetas BOM.
* `GET/POST /sales/invoices`: Emisión de comprobantes fiscales, notas de crédito y ventas.
* `POST /sales/invoices/{id}/payments`: Registro de pagos multimoneda.
* `GET/POST /sales/currencies` & `/exchange-rates`: Tasa de cambio del día y monedas activas.
* `GET/POST /sales/customers`: Directorio y registro de clientes.

### 6.8 Integraciones (`/api/integrations`)
* `GET /api/integrations/quick/auth`: Inicialización de handshake OAuth con VerumQuick.
* `POST /api/integrations/quick/webhook`: Recepción de eventos remotos con firma HMAC.
* `POST /api/integrations/quick/sync`: Disparo forzado de sincronización de catálogo.

---

## 7. Variables de Entorno (.env)

**Backend (`backend/.env`):**
```env
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
REDIS_URL=redis://localhost:6379/0  # Opcional para caché
VERUM_QUICK_URL=https://app.verumquick.com
VERUM_QUICK_HMAC_SECRET=<tu-secret-hmac>
VERUM_QUICK_WEBHOOK_URL=http://localhost:8000/api/integrations/quick/webhook
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_VERUM_QUICK_URL=https://app.verumquick.com
```

---

## 8. Guía de Ejecución y Pruebas

### Servidor Backend (FastAPI):
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Servidor Frontend (Next.js):
```bash
cd frontend
npm install
npm run dev -- --port 3000
```

### Ejecución de Pruebas Automatizadas (TDD):
```bash
# Backend (Pytest)
cd backend
pytest

# Script conjunto
./run_tests.sh  # En Windows: .\run_tests.ps1
```

---

## 9. Convenciones de Código y Calidad (Code Review Standards)

Toda nueva funcionalidad debe adherirse a los siguientes estándares:
1. **Test-Driven Development (TDD):** Escribir pruebas unitarias/integración en `backend/tests/` que validen la regla de negocio antes de la implementación final.
2. **Funciones concisas y modulares:** Métodos con un máximo recomendado de 30 líneas enfocados en una única responsabilidad.
3. **TypeScript estricto:** Prohibido el uso del tipo `any`; modelar contratos e interfaces completas.
4. **Respeto a la arquitectura de capas:** El frontend **nunca** realiza mutaciones o consultas directas a Supabase que evadan las reglas de negocio; toda operación transaccional se canaliza a través de los endpoints de FastAPI.