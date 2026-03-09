# VERUM.md: Sistema de Control Operativo

## 1. Visión General del Proyecto

Este proyecto es una plataforma de gestión operativa para restaurantes y empresas de servicios. Permite digitalizar procesos manuales mediante checklists dinámicos, captura de evidencia (fotos) y monitoreo en tiempo real desde un dashboard administrativo.

### Objetivos Principales:

* **Operatividad:** Ejecución de checklists rápidos desde móviles (PWA).
* **Control:** Verificación de puntos críticos (temperaturas, limpieza, inventarios, notificaciones).
* **Visibilidad:** Dashboard para gerencia con métricas de cumplimiento.

---

## 2. Stack Tecnológico

* **Frontend:** Next.js 14+ (App Router), Tailwind CSS, Shadcn/UI.
* **Backend:** Python 3.11+, FastAPI, Pydantic v2.
* **Base de Datos & Auth:** Supabase (PostgreSQL, Auth, Storage).
* **Infraestructura:** Vercel (Frontend), Render (Backend), Supabase (Data).

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

## 4. Arquitectura de Datos (Supabase SQL)

El sistema debe seguir esta jerarquía relacional:

```sql
-- 1. Perfiles (Extiende Auth.Users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('admin', 'staff')),
  organization_id uuid references organizations(id)
);

-- 2. Organizaciones y Sedes
create table organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null
);

create table venues (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references organizations(id),
  name text not null,
  address text
);

-- 3. Checklists y Preguntas
create table checklist_templates (
  id uuid default uuid_generate_v4() primary key,
  venue_id uuid references venues(id),
  title text not null,
  description text,
  frequency text, -- 'daily', 'shift', 'weekly'
  -- ✅ NUEVO: prerequisito para desbloquear este checklist
  prerequisite_template_id uuid references checklist_templates(id) null
);

create table questions (
  id uuid default uuid_generate_v4() primary key,
  template_id uuid references checklist_templates(id) on delete cascade,
  label text not null,
  -- ✅ AMPLIADO: nuevos tipos de pregunta visibles en el diseño
  type text check (type in (
    'check',        -- Checkbox simple ✓
    'text',         -- Texto libre
    'number',       -- Valor numérico
    'photo',        -- Captura de imagen con label/etiqueta
    'slider',       -- Rango numérico (ej: temperatura 80°C - 100°C)
    'yes_no',       -- Botones Sí / No
    'multi_option', -- Selección entre opciones (ej: Excellent / Good / Reject)
    'select'        -- Dropdown (ej: Stock Source)
  )),
  is_required boolean default true,
  -- ✅ NUEVO: configuración específica por tipo de pregunta (JSON)
  -- Para 'slider':       { "min": 80, "max": 100, "unit": "°C", "target_min": 90, "target_max": 96 }
  -- Para 'multi_option': { "options": ["Excellent", "Good", "Reject"] }
  -- Para 'select':       { "options": ["In-house Bakery", "External Supplier"] }
  -- Para 'photo':        { "label": "STATION 1" }
  config jsonb null
);

-- 4. Ejecuciones y Respuestas
create table submissions (
  id uuid default uuid_generate_v4() primary key,
  template_id uuid references checklist_templates(id),
  user_id uuid references profiles(id),
  venue_id uuid references venues(id),
  shift text, -- 'morning', 'mid', 'closing'
  -- ✅ estado del submission para el flujo de 2 pasos (Check → Review)
  status text check (status in ('draft', 'completed')) default 'draft',
  -- ✅ notas del auditor al final de la revisión
  auditor_notes text null,
  -- ✅ confirmación explícita del auditor antes de submit
  auditor_confirmed boolean default false,
  -- ✅ AUTO-SAVE: timestamp del último guardado automático (para mostrar "Guardado hace X min")
  last_saved_at timestamp with time zone null,
  completed_at timestamp with time zone null -- null hasta que status = 'completed'
);

create table answers (
  id uuid default uuid_generate_v4() primary key,
  submission_id uuid references submissions(id) on delete cascade,
  question_id uuid references questions(id),
  value text, -- Almacena texto, número, opción seleccionada o link de foto en Storage
  -- ✅ metadata de la foto (etiqueta como "STATION 1", "DINING ROOM")
  photo_label text null,
  -- ✅ distingue fallas críticas de no-críticas
  is_critical_failure boolean default false,
  is_non_critical_issue boolean default false,
  -- ✅ AUTO-SAVE: permite upsert eficiente sin duplicar respuestas
  -- Constraint: una sola respuesta por pregunta por submission
  unique (submission_id, question_id)
);

-- ✅ AUTO-SAVE: índice para acelerar el upsert en cada respuesta guardada
create index idx_answers_submission_question on answers (submission_id, question_id);
```

---

## 4. Requerimientos de la API (FastAPI)

* **Endpoints Principales:**
  * `POST /auth/sync`: Sincroniza el usuario de Supabase Auth con la tabla `profiles`.
  * `GET /checklists/{venue_id}`: Obtiene las plantillas activas para un local, incluyendo su estado de bloqueo según `prerequisite_template_id` y las submissions del turno actual. Si existe un `draft` activo para el usuario, devuelve su `id` y las respuestas ya guardadas para poder reanudar.
  * `POST /submissions`: Crea un nuevo submission en estado `draft` al momento en que el usuario **abre** el checklist. Devuelve el `submission_id` que el frontend usará para todos los auto-saves. Si ya existe un `draft` del mismo usuario para ese template en el turno actual, devuelve el existente (idempotente).
  * `PUT /submissions/{id}/answers`: **Endpoint de auto-save.** Recibe un array de respuestas y ejecuta un `upsert` masivo sobre la tabla `answers` usando el constraint único `(submission_id, question_id)`. Actualiza `submissions.last_saved_at = now()`. Puede recibir una sola respuesta o varias a la vez.
  * `PATCH /submissions/{id}`: Actualiza campos del submission: `status`, `auditor_notes`, `auditor_confirmed`. Al pasar `status: 'completed'`, registra `completed_at`, ejecuta lógica de alertas y desbloquea checklists dependientes.
  * `GET /reports/compliance`: Calcula el % de tareas completadas para el Admin, incluyendo conteo de issues críticos y no-críticos.

* **Lógica del Auto-Save (`PUT /submissions/{id}/answers`):**
  * Usa `INSERT ... ON CONFLICT (submission_id, question_id) DO UPDATE SET value = EXCLUDED.value, ...` para evitar duplicados.
  * Solo actualiza `last_saved_at` en `submissions`, **no cambia el `status`** (sigue en `draft`).
  * Responde con `{ saved_at: "<timestamp>" }` para que el frontend actualice el indicador visual.
  * Las fotos son la excepción: el frontend primero sube la imagen a Supabase Storage, obtiene la URL pública, y luego envía esa URL como `value` a este endpoint.

* **Lógica de Alertas (solo al hacer `PATCH status: 'completed'`):**
  * Si alguna `answer` tiene `is_critical_failure = true` → notificación inmediata al admin.
  * Si hay respuestas con `is_non_critical_issue = true` → se incluyen en el resumen del Step 2 y en el reporte.

* **Seguridad:** Todas las rutas deben validar el `Authorization: Bearer <JWT>` emitido por Supabase.

---

## 5. Requerimientos del Frontend (Next.js)

* **Mobile First:** La interfaz de ejecución debe parecer una App nativa.
* **PWA:** Configurar `next-pwa` para permitir la instalación en el escritorio del móvil.
* **Client-Side Image Compression:** Usar `browser-image-compression` para reducir fotos a <200KB antes de subirlas a Supabase Storage.
* **Estados de Carga:** Implementar Skeletons para las llamadas a la API de Render (mitigar el *cold start*).

### Auto-Save Automático (estilo Google Forms)

El guardado automático opera en el frontend mediante un hook `useAutoSave` que coordina todos los cambios del formulario:

**Ciclo de vida:**
1. El usuario abre el checklist → el frontend llama `POST /submissions` y guarda el `submission_id` en el estado del componente.
2. Si `GET /checklists/{venue_id}` devuelve un `draft` activo, el frontend pre-carga las respuestas guardadas en el formulario (permite reanudar si el usuario cierra accidentalmente).
3. Cada vez que el usuario modifica una respuesta, se encola en un buffer local.
4. El hook dispara `PUT /submissions/{id}/answers` con el buffer acumulado según la estrategia del tipo de campo (ver abajo).
5. La UI muestra un indicador de estado de guardado en la parte superior del formulario.

**Estrategia de guardado por tipo de campo:**

| Tipo de campo | Estrategia | Detalle |
|---|---|---|
| `check`, `yes_no`, `multi_option`, `select` | **Inmediato** | Se guarda en cuanto cambia el valor |
| `text`, `number` | **Debounce 800ms** | Espera que el usuario deje de escribir |
| `slider` | **Debounce 500ms** | Espera que suelte el slider |
| `photo` | **Async en 2 pasos** | 1) Sube imagen a Supabase Storage → 2) Guarda URL via auto-save |

**Indicador visual de estado (esquina superior del formulario):**

```
⏳ Guardando...     →  mientras hay requests en vuelo
✓  Guardado         →  después del último request exitoso (desaparece a los 3s)
⚠️  Sin conexión    →  si el request falla (reintenta automáticamente al reconectar)
```

**Hook sugerido (`useAutoSave`):**
```typescript
// hooks/useAutoSave.ts
// - Recibe: submissionId, answers (map de question_id → value)
// - Mantiene: saveStatus ('idle' | 'saving' | 'saved' | 'error')
// - Expone: saveAnswer(questionId, value) — llamado por cada componente de pregunta
// - Internamente usa useRef para el debounce timer y un Set de respuestas pendientes
// - En caso de error: reintenta con backoff exponencial (1s, 2s, 4s, máx 3 intentos)
```

**Manejo de fotos (flujo especial):**
```
Usuario toma foto
  → browser-image-compression (<200KB)
  → upload a Supabase Storage (directamente desde el cliente con anon key)
  → obtiene URL pública
  → saveAnswer(questionId, { value: url, photo_label: label })
  → PUT /submissions/{id}/answers
```

### Flujo de Ejecución de Checklist (2 Pasos)

El formulario de checklist sigue un flujo de dos etapas, visible en el diseño:

1. **Step 1 — Check:** El staff responde todas las preguntas del checklist. El auto-save opera en segundo plano durante toda esta etapa. Al presionar "Review Audit", el formulario navega al Step 2 (el `status` sigue en `draft`).
2. **Step 2 — Review:** Pantalla de revisión final que muestra un resumen: foto de evidencia, metadata del turno, conteo de tareas completadas, lista de issues no-críticos, evidencias fotográficas con sus etiquetas, y notas del auditor. El staff debe confirmar (`auditor_confirmed = true`) y presionar "Submit Audit", que llama `PATCH /submissions/{id}` con `status: 'completed'`.

| Tipo          | Componente UI                                      |
|---------------|----------------------------------------------------|
| `check`       | Checkbox con ícono de paloma                       |
| `text`        | Input de texto                                     |
| `number`      | Input numérico                                     |
| `photo`       | Botón de captura + preview + campo de etiqueta     |
| `slider`      | Slider con rango min/max, target y unidad          |
| `yes_no`      | Botones toggle "Yes" / "No"                        |
| `multi_option`| Botones de selección múltiple (ej: Excellent/Good/Reject) |
| `select`      | Dropdown nativo                                    |

### Dashboard de Checklists

* Mostrar estado de cada checklist: `COMPLETED`, `IN PROGRESS` (con % y contador de tareas), `PENDING`, `LOCKED`.
* Los checklists con `prerequisite_template_id` deben mostrarse bloqueados hasta que el submission de la plantilla previa esté en estado `completed`.

---

## 6. Variables de Entorno (.env)

```env
# Frontend
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
NEXT_PUBLIC_API_URL=your_render_url

# Backend
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

---

## 7. Plan de Implementación — Vertical Slices (Pequeñas Victorias)

El desarrollo se organiza en **milestones funcionales**: cada uno entrega algo que se puede ver y usar de punta a punta antes de pasar al siguiente. La infraestructura base (Supabase + FastAPI) se prepara una sola vez al inicio y luego se expande incrementalmente.

---

### 🏗️ Prerequisito: Infraestructura Base (hacer una sola vez)

Antes del Milestone 1, preparar el entorno que todos los milestones usarán:

- Crear proyecto en Supabase. Ejecutar **solo las tablas necesarias para el M1**: `organizations`, `venues`, `profiles`.
- Crear proyecto FastAPI mínimo (un solo archivo `main.py`) con conexión a Supabase y middleware de validación JWT. Desplegar en Render.
- Crear proyecto Next.js 14 con App Router, Tailwind y Shadcn/UI. Configurar variables de entorno.

> ⚠️ No crear todas las tablas SQL de una vez. Cada milestone indica qué tablas o columnas nuevas agregar.

---

### ✅ Milestone 1 — Login funcional
**Victoria:** El staff puede iniciar sesión y ver una pantalla de bienvenida autenticada.

**Tablas SQL a agregar:** `organizations`, `venues`, `profiles`

**Backend:**
- `POST /auth/sync` — Al primer login, crea el registro en `profiles` con `role: 'staff'`.

**Frontend:**
- Pantalla de Login con Employee ID y Password (Supabase Auth).
- Redirect automático: si hay sesión activa → `/dashboard`; si no → `/login`.
- Logout funcional.
- Skeleton/loading state durante la autenticación.

**Criterio de éxito:** Un usuario creado en Supabase Auth puede hacer login, ver su nombre en pantalla y hacer logout.

---

### ✅ Milestone 2 — Ver checklists en la pantalla principal
**Victoria:** El staff ve la lista de checklists del día con sus estados (Pending, In Progress, Completed, Locked).

**Tablas SQL a agregar:** `checklist_templates`, `questions`, `submissions` (solo columnas: `id`, `template_id`, `user_id`, `venue_id`, `shift`, `status`)

**Backend:**
- `GET /checklists/{venue_id}` — Devuelve las plantillas activas con su estado calculado para el turno actual. Lógica de bloqueo por `prerequisite_template_id`.

**Frontend:**
- Vista `/dashboard` con lista de checklists agrupados por turno.
- Cards con estado visual: `COMPLETED` (verde), `IN PROGRESS` (azul + % + contador), `PENDING` (gris), `LOCKED` (candado).
- Navbar inferior con tabs: Audits / History / Reports / Settings.
- Datos de prueba: crear 2–3 `checklist_templates` y `questions` directamente en Supabase para testear.

**Criterio de éxito:** La lista se carga desde la API real, refleja el estado correcto y el usuario bloqueado no puede acceder al checklist dependiente.

---

### ✅ Milestone 3 — Llenar un checklist (sin auto-save)
**Victoria:** El staff puede abrir un checklist, responder todas las preguntas y navegar entre ellas.

**Tablas SQL a agregar:** Agregar a `questions` los campos: `config jsonb`. Agregar a `submissions`: `last_saved_at`, `auditor_notes`, `auditor_confirmed`, `completed_at`. Agregar tabla `answers` completa.

**Backend:**
- `POST /submissions` — Crea el draft al abrir el checklist (idempotente).
- `GET /submissions/{id}` — Devuelve el submission con sus respuestas (para reanudar).

**Frontend:**
- Vista `/checklist/[id]` con Step 1 (Check): renderiza cada pregunta según su `type`.
- Todos los componentes de preguntas: `check`, `text`, `number`, `yes_no`, `multi_option`, `select`, `slider`, `photo`.
- Botón "Review Audit" navega al Step 2 (pantalla de revisión final).
- Step 2: muestra resumen, notas del auditor, confirmación y botón "Submit Audit".
- `PATCH /submissions/{id}` al hacer submit → `status: 'completed'`.

**Criterio de éxito:** Se puede completar un checklist de punta a punta y su estado cambia a `COMPLETED` en el dashboard.

---

### ✅ Milestone 4 — Auto-save automático
**Victoria:** Cada respuesta se guarda en Supabase en segundo plano. Si el usuario cierra y reabre, retoma donde dejó.

**Tablas SQL a agregar:** Agregar constraint `UNIQUE (submission_id, question_id)` a `answers` e índice `idx_answers_submission_question`.

**Backend:**
- `PUT /submissions/{id}/answers` — Upsert masivo de respuestas. Actualiza `last_saved_at`.

**Frontend:**
- Hook `useAutoSave` con estrategia por tipo de campo (inmediato / debounce 800ms / debounce 500ms).
- Indicador visual: ⏳ Guardando → ✓ Guardado → ⚠️ Sin conexión.
- Al abrir un checklist en progreso: pre-carga las respuestas guardadas.
- Flujo de fotos: compresión → Supabase Storage → URL → auto-save.

**Criterio de éxito:** Al cerrar el navegador a mitad de un checklist y volver, todas las respuestas previas están precargadas.

---

### ✅ Milestone 5 — Panel Administrativo
**Victoria:** El admin puede crear organizaciones, sedes y plantillas de checklist, y ver las respuestas enviadas.

**Tablas SQL a agregar:** Ninguna (todas las tablas ya existen).

**Backend:**
- `POST /organizations` y `POST /venues` — Crear entidades.
- `POST /checklist-templates` y `POST /questions` — Crear plantillas con preguntas.
- `GET /reports/compliance` — % de cumplimiento, issues críticos y no-críticos por venue/turno/fecha.

**Frontend:**
- Rutas de admin (`/admin/*`) protegidas por `role: 'admin'`.
- `/admin/organizations` — CRUD de organizaciones y sedes.
- `/admin/templates` — Crear/editar plantillas de checklist y sus preguntas.
- `/admin/submissions` — Ver respuestas enviadas por submission, con detalle de cada respuesta.
- `/admin/dashboard` — Métricas de cumplimiento: % completado, heatmap por turno, conteo de issues.

**Criterio de éxito:** El admin puede crear una plantilla nueva desde el panel, y el staff la ve en su dashboard al siguiente turno.

---

### ✅ Milestone 6 — Optimización Final
**Victoria:** La app se comporta como una app nativa instalable en el móvil.

- Configurar `next-pwa` para instalación en homescreen.
- Activar compresión de imágenes con `browser-image-compression` (<200KB).
- Revisar y optimizar Skeletons en todas las vistas que llaman a Render (mitigar cold start).
- Auditoría de performance en Lighthouse (target: PWA score > 90).