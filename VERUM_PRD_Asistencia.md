# VERUM_PRD_Asistencia.md: Módulo de Control de Asistencia

> **Versión:** 2.2  
> **Estado:** En desarrollo  
> **Depende de:** VERUM.md (M1–M5), VERUM_PRD_Inventario.md (M6-INV para permisos)  
> **Milestone activo:** M13-ATT  
> **Pendientes:** M14-ATT, M15-ATT, M16-ATT (verificación GPS — fase futura)

> ℹ️ Los milestones de este módulo se enumeran desde M13 porque M1–M12 pertenecen al roadmap principal y al módulo de inventario.

---

## 1. Visión General del Módulo

Este módulo resuelve el problema de control de asistencia en restaurantes: no saber qué día trabajó quién, no detectar llegadas tarde, y no tener datos confiables para liquidar nómina.

### Estrategia de implementación

El módulo se construye en dos fases claramente separadas:

**Fase 1 — MVP funcional (M13-ATT a M15-ATT):**
Sin restricciones de verificación de presencia. El objetivo es que el sistema se adopte, que los datos empiecen a cargarse y que el equipo confíe en la herramienta. La marcación es manual desde la app, sin QR ni GPS obligatorio.

**Fase 2 — Verificación de presencia (M15-ATT):**
Una vez el MVP está estable y en uso, se agrega la capa de verificación GPS. Esta fase es independiente y no requiere cambios en los datos ya registrados — el esquema de base de datos se diseña desde el inicio para soportarla.

### Eventos que registra

* **Entrada al turno** — marca de inicio de jornada.
* **Salida del turno** — marca de fin de jornada.
* **Inicio de pausa** — inicio de descanso/almuerzo.
* **Fin de pausa** — regreso de descanso.

> **No existe un evento de "hora extra" manual.** Las horas extra se calculan automáticamente a partir de la hora real de salida vs. la hora programada. Ver sección 3.2.

### Lo que el admin puede ver

* Quién está trabajando en este momento (vista en vivo).
* Reporte de horas trabajadas por persona y período.
* Alertas de llegadas tarde y ausencias no justificadas.
* Exportación de datos para nómina.

---

## 2. Sistema de Verificación de Presencia (Fase Futura — M15-ATT)

> ⚠️ **Esta sección documenta la fase futura. No se implementa en el MVP.**  
> El MVP (M13–M15) no tiene restricciones. La marcación es libre desde la app.

### 2.1 Mecanismos descartados y por qué

**QR dinámico rotativo (TOTP):** descartado porque requiere una pantalla o tablet permanentemente encendida en la entrada del local. No está disponible en la infraestructura actual.

**Verificación por WiFi (Web Network Information API):** descartada porque iOS Safari no expone el SSID de la red desde iOS 13 por restricciones de privacidad de Apple. Con un equipo mixto de dispositivos, esto excluye a todos los usuarios de iPhone.

### 2.2 Mecanismo seleccionado: Geolocalización GPS

Es el único mecanismo que funciona de forma consistente en todos los dispositivos (Android e iOS) sin hardware adicional.

**Funcionamiento:**
* El admin configura las coordenadas GPS del local y un radio de tolerancia (default: 100 metros) por sede desde `/admin/attendance/config`.
* Al marcar cualquier evento, el frontend solicita `navigator.geolocation.getCurrentPosition()`.
* El backend calcula la distancia entre las coordenadas del empleado y las del local usando la fórmula de Haversine.
* Si la distancia supera el radio configurado → la marca es rechazada.

**Limitaciones conocidas:**
* GPS en interiores puede tener imprecisión de 10–50 metros. El radio de 100m compensa esto.
* Edificios con muros gruesos pueden tener señal GPS débil → el radio se puede ampliar por sede desde la configuración.
* Si el usuario deniega el permiso de ubicación → en M15-ATT la marca es rechazada.

### 2.3 Lógica de validación (M15-ATT)

```
MARCA VÁLIDA:
  distancia(gps_empleado, gps_local) ≤ gps_radius_m

MARCA RECHAZADA:
  distancia > gps_radius_m   →  error GPS_OUT_OF_RANGE
  permiso GPS denegado       →  error GPS_PERMISSION_DENIED
  GPS no disponible          →  error GPS_UNAVAILABLE
```

La activación es por sede y se controla con el flag `gps_verification_enabled` en `attendance_config`. El admin puede activar o desactivar sin necesidad de despliegue nuevo.

---

## 3. Reglas de Negocio

### 3.1 Esquema de Turnos

El sistema soporta tres modalidades que conviven según el empleado:

| Modalidad | Descripción | Ejemplo |
|---|---|---|
| `fixed` | Mismo horario todos sus días laborables | Lunes–Viernes 9am–6pm |
| `rotating` | Cada día de la semana tiene su propio horario de entrada y salida | Ver detalle abajo |
| `flexible` | Sin horario programado | Empleados part-time por hora |

Un empleado puede cambiar de modalidad. Los empleados `flexible` nunca generan tardanzas ni ausencias automáticas — no tienen horario base contra el cual comparar.

#### Modalidad `rotating` — horario por día

En turnos rotativos el admin define el horario de cada día de la semana de forma independiente. Cada día puede tener una hora de inicio y fin distinta, o estar marcado como día libre (`day_off: true`).

**Ejemplo de configuración:**

| Día | Entrada | Salida |
|---|---|---|
| Lunes | 9:00 AM | 6:00 PM |
| Martes | 1:00 PM | 10:00 PM |
| Miércoles | 4:00 PM | 11:00 PM |
| Jueves | día libre | — |
| Viernes | 9:00 AM | 6:00 PM |
| Sábado | 11:00 AM | 8:00 PM |
| Domingo | día libre | — |

Esto se modela con una tabla `shift_days` donde cada fila representa un día de la semana del turno rotativo. A diferencia del modelo anterior de `shift_schedules` (que era por fecha específica), `shift_days` define el patrón semanal recurrente — no hay que reprogramar cada semana.

> **Nota de migración:** la tabla `shift_schedules` del milestone anterior se reemplaza por `shift_days`. Si ya existen datos en `shift_schedules`, migrarlos antes de activar M13-ATT.

### 3.2 Cálculo de Horas Extra (automático)

Las horas extra **no se registran manualmente**. Se calculan automáticamente en dos momentos: al registrar la entrada (extras por llegada temprana) y al registrar la salida (extras por salida tardía).

**Reglas generales:**
* Solo aplica a empleados `fixed` y `rotating`.
* Se cuentan **horas completas cerradas hacia abajo** (`floor`). No se redondea nunca.
* Los minutos parciales no cuentan en ningún caso.

#### Extras por salida tardía

Se calculan al registrar la marca de `clock_out`. La referencia es `end_time` del turno.

**Ejemplos con turno hasta las 5:00 PM:**

| Hora de salida real | Horas extra |
|---|---|
| 4:55 PM | 0 |
| 5:00 PM | 0 |
| 5:59 PM | 0 — no llega a la hora completa |
| 6:00 PM | 1 |
| 6:59 PM | 1 |
| 7:00 PM | 2 |
| 8:45 PM | 3 |

#### Extras por llegada temprana

Se calculan al registrar la marca de `clock_in`. La referencia es `start_time` del turno. La misma regla de `floor` aplica — solo cuentan horas completas anteriores a la hora programada.

**Ejemplos con turno desde las 9:00 AM:**

| Hora de entrada real | Horas extra |
|---|---|
| 9:00 AM | 0 |
| 8:30 AM | 0 — no llega a la hora completa antes |
| 8:01 AM | 0 — no llega a la hora completa antes |
| 8:00 AM | 1 |
| 7:15 AM | 1 |
| 7:00 AM | 2 |

#### Fórmulas

```python
def calcular_extras_salida(hora_salida_real: time, end_time: time) -> int:
    """Extras por salida tardía. floor(), nunca redondea."""
    diferencia_minutos = (hora_salida_real - end_time).total_seconds() / 60
    if diferencia_minutos <= 0:
        return 0
    return int(diferencia_minutos // 60)

def calcular_extras_entrada(hora_entrada_real: time, start_time: time) -> int:
    """Extras por llegada temprana. floor(), nunca redondea."""
    diferencia_minutos = (start_time - hora_entrada_real).total_seconds() / 60
    if diferencia_minutos <= 0:
        return 0
    return int(diferencia_minutos // 60)
```

Ambos resultados se suman en `attendance_logs.overtime_hours`. Si alguien llega 1h antes **y** se queda 2h después, tiene 3h extra totales en ese día.

El campo `overtime_hours` en el registro de `clock_in` almacena las extras tempranas, y en el registro de `clock_out` almacena las extras tardías. La vista `v_daily_attendance` los suma para el reporte.

### 3.3 Cálculo de Tardanza y Retardo

Aplica solo a empleados `fixed` y `rotating`. Se calcula al registrar `clock_in`.

```
minutes_late = max(0, minutos(start_time_programado → hora_entrada_real))
```

Si `minutes_late ≤ late_threshold_minutes` (default: 10 min) → no se considera tardanza y no genera alerta.

#### Caso especial: llegada muy tardía el mismo día

Si un empleado con turno a las 9:00 AM llega a las 12:00 PM por razones personales y marca su entrada, el sistema:

* Registra `clock_in` con `minutes_late: 180`.
* **No genera ausencia** — hay una marca de entrada en el día.
* Las horas trabajadas se cuentan desde las 12:00 PM (hora real de llegada) hasta la salida real. No se acreditan las horas no trabajadas.
* El admin ve el retardo de 3 horas en el reporte y puede agregar una nota de justificación.

El cron job de las 11:50 PM **no toca este día** porque ya existe al menos una marca. La distinción es simple: si hay alguna marca en el día → no es inasistencia.

### 3.4 Pausa

* Solo puede haber una pausa activa a la vez. Intentar iniciar una segunda sin cerrar la primera → error.
* Si la pausa supera `max_break_minutes` (default: 60 min) → se registra una advertencia para el admin.
* El tiempo de pausa se descuenta de las horas brutas para calcular horas netas.

---

## 4. Modelo de Datos

```sql
-- Configuración de asistencia por sede
create table attendance_config (
  id                        uuid default uuid_generate_v4() primary key,
  venue_id                  uuid references venues(id) on delete cascade unique,
  -- GPS (columnas presentes desde M13-ATT, validación activa solo desde M15-ATT)
  gps_lat                   numeric(10, 7),
  gps_lng                   numeric(10, 7),
  gps_radius_m              integer default 100,
  gps_verification_enabled  boolean default false,  -- false en MVP, true desde M15-ATT
  -- Reglas de negocio
  late_threshold_minutes    integer default 10,
  max_break_minutes         integer default 60
);

-- Turnos por empleado
create table shifts (
  id           uuid default uuid_generate_v4() primary key,
  profile_id   uuid references profiles(id) on delete cascade,
  venue_id     uuid references venues(id),
  modality     text check (modality in ('fixed', 'rotating', 'flexible')),
  -- Para 'fixed': días de la semana en que trabaja y horario único
  weekdays     integer[],   -- [1,2,3,4,5] = Mon–Fri (ISO: 1=Monday)
  start_time   time,        -- Hora de entrada (mismo todos los días en 'fixed')
  end_time     time,        -- Hora de salida  (mismo todos los días en 'fixed')
  -- Para 'rotating': el horario por día se define en shift_days
  -- Para 'flexible': todos los campos de horario son null
  is_active    boolean default true,
  created_at   timestamp with time zone default now()
);

-- Horario por día de semana para turnos rotativos
-- Reemplaza shift_schedules (que era por fecha específica)
create table shift_days (
  id           uuid default uuid_generate_v4() primary key,
  shift_id     uuid references shifts(id) on delete cascade,
  weekday      integer not null check (weekday between 1 and 7), -- ISO: 1=Monday, 7=Sunday
  start_time   time,        -- null si day_off = true
  end_time     time,        -- null si day_off = true
  day_off      boolean default false,  -- true = día libre en este turno rotativo
  unique (shift_id, weekday)
);

-- Registro de marcas
create table attendance_logs (
  id              uuid default uuid_generate_v4() primary key,
  profile_id      uuid references profiles(id) on delete cascade,
  venue_id        uuid references venues(id),
  event_type      text check (event_type in (
    'clock_in',       -- Entrada al turno
    'clock_out',      -- Salida del turno
    'break_start',    -- Inicio de pausa
    'break_end'       -- Fin de pausa
  )),
  -- Contexto del turno al momento de marcar
  shift_id        uuid references shifts(id),
  expected_start  time,         -- null si flexible
  expected_end    time,         -- null si flexible
  minutes_late    integer,      -- Solo en 'clock_in'. Positivo = tarde, negativo = temprano
  overtime_hours  integer,      -- En 'clock_in': extras tempranas. En 'clock_out': extras tardías. Floor() en ambos casos.
  -- GPS (presente desde M13-ATT, validado activamente solo desde M15-ATT)
  gps_lat         numeric(10, 7),
  gps_lng         numeric(10, 7),
  gps_accuracy_m  integer,
  gps_distance_m  integer,      -- Distancia al local en metros
  verification_status text check (verification_status in (
    'no_requerida',   -- MVP: sin validación activa
    'verificado',     -- M15-ATT: dentro del radio
    'rechazado',      -- M15-ATT: fuera del radio (no debería llegar a guardarse)
    'sin_gps'         -- M15-ATT: permiso GPS denegado por el usuario
  )) default 'no_requerida',
  -- Edición manual por admin (auditoría)
  edited_by       uuid references profiles(id),
  edit_reason     text,
  -- Meta
  marked_at       timestamp with time zone default now(),
  device_info     text
);

-- Ausencias y justificaciones
create table absences (
  id           uuid default uuid_generate_v4() primary key,
  profile_id   uuid references profiles(id) on delete cascade,
  venue_id     uuid references venues(id),
  date         date not null,
  type         text check (type in (
    'unexcused',    -- No se presentó y no hay justificación
    'excused',      -- Aprobada por el admin
    'leave',        -- Solicitada con anticipación
    'sick',
    'holiday'
  )),
  reason       text,
  approved_by  uuid references profiles(id),
  created_at   timestamp with time zone default now(),
  unique (profile_id, date)
);

-- Vista: resumen diario por empleado (base para reportes y nómina)
create or replace view v_daily_attendance as
select
  al.profile_id,
  p.full_name,
  al.venue_id,
  date_trunc('day', al.marked_at)::date                                       as work_date,
  min(al.marked_at) filter (where al.event_type = 'clock_in')                 as clock_in,
  max(al.marked_at) filter (where al.event_type = 'clock_out')                as clock_out,
  -- Horas brutas (clock_in a clock_out)
  round(extract(epoch from (
    max(al.marked_at) filter (where al.event_type = 'clock_out') -
    min(al.marked_at) filter (where al.event_type = 'clock_in')
  )) / 3600.0, 2)                                                              as gross_hours,
  -- Tiempo de pausa
  round(extract(epoch from (
    max(al.marked_at) filter (where al.event_type = 'break_end') -
    min(al.marked_at) filter (where al.event_type = 'break_start')
  )) / 3600.0, 2)                                                              as break_hours,
  -- Horas netas (bruto - pausa)
  round(
    extract(epoch from (
      max(al.marked_at) filter (where al.event_type = 'clock_out') -
      min(al.marked_at) filter (where al.event_type = 'clock_in')
    )) / 3600.0
    - coalesce(extract(epoch from (
        max(al.marked_at) filter (where al.event_type = 'break_end') -
        min(al.marked_at) filter (where al.event_type = 'break_start')
      )) / 3600.0, 0)
  , 2)                                                                         as net_hours,
  -- Horas extra totales: suma de extras tempranas (clock_in) + tardías (clock_out)
  coalesce(max(al.overtime_hours) filter (where al.event_type = 'clock_in'), 0)
  + coalesce(max(al.overtime_hours) filter (where al.event_type = 'clock_out'), 0)
                                                                               as overtime_hours,
  max(al.minutes_late) filter (where al.event_type = 'clock_in')              as minutes_late,
  a.type                                                                       as absence_type
from attendance_logs al
join profiles p on p.id = al.profile_id
left join absences a
  on a.profile_id = al.profile_id
  and a.date = date_trunc('day', al.marked_at)::date
group by
  al.profile_id, p.full_name, al.venue_id,
  date_trunc('day', al.marked_at)::date, a.type;

-- Índices
create index idx_attendance_profile_date on attendance_logs(profile_id, marked_at);
create index idx_attendance_venue_date   on attendance_logs(venue_id, marked_at);
create index idx_shifts_profile          on shifts(profile_id);
create index idx_absences_profile_date   on absences(profile_id, date);
```

---

## 5. Flujos Operativos

### Flujo AT1 — Marcar asistencia (staff, MVP)

1. Staff abre VERUM → ve su estado del día en el dashboard principal.
2. Toca el botón de acción disponible según su estado actual.
3. Pantalla de confirmación: "¿Confirmas marcar tu entrada a las 09:07 AM?"
4. Al confirmar → `POST /attendance/mark` con el `event_type` correspondiente.
5. El backend determina el turno activo, calcula `minutes_late` u `overtime_hours` según el tipo de evento, y registra la marca.
6. Confirmación en pantalla durante 3 segundos → redirect al dashboard.

### Flujo AT2 — Máquina de estados

El `event_type` disponible se determina por el último evento registrado hoy. El backend valida el estado antes de aceptar cualquier marca.

```
Estado actual              → Acciones disponibles
────────────────────────────────────────────────────────────────
Sin marca hoy              → [clock_in]
clock_in registrado        → [break_start]  [clock_out]
break_start registrado     → [break_end]
break_end registrado       → [clock_out]
clock_out registrado       → solo lectura — ver resumen del día
```

Si el cliente envía un `event_type` inconsistente con el estado actual → error `INVALID_STATE` con el estado correcto en la respuesta.

### Flujo AT3 — Inasistencia (cron job 11:50 PM)

El cron job se ejecuta **una vez al día a las 11:50 PM**. Revisa todos los empleados con turno `fixed` o `rotating` programado para ese día y:

* Si el empleado tiene **al menos una marca** en `attendance_logs` para ese día → **no genera nada**. Ya sea que llegó tarde 3 horas, salió temprano, o solo marcó entrada sin salida — cualquier marca cuenta. El retardo queda registrado en `minutes_late` desde el momento en que marcó.
* Si el empleado **no tiene ninguna marca** en todo el día → crea registro en `absences` con `type: 'unexcused'` y genera alerta en el panel admin.

```python
# Pseudocódigo del cron
def check_absences(date: date):
    turnos_del_dia = get_shifts_for_date(date)  # fixed y rotating con ese weekday
    for turno in turnos_del_dia:
        tiene_marca = attendance_logs.exists(
            profile_id=turno.profile_id,
            venue_id=turno.venue_id,
            date=date
            # cualquier event_type cuenta
        )
        if not tiene_marca:
            absences.create(
                profile_id=turno.profile_id,
                venue_id=turno.venue_id,
                date=date,
                type='unexcused'
            )
            notify_admin(turno.profile_id, date)
```

**Casos documentados:**

| Situación | Resultado del cron |
|---|---|
| No vino en todo el día | ✅ Genera `absence: unexcused` |
| Llegó 3h tarde pero marcó | ❌ No genera ausencia — `minutes_late: 180` ya está registrado |
| Solo marcó entrada, no salida | ❌ No genera ausencia — admin revisará la salida faltante |
| Tenía el día libre (`day_off: true`) | ❌ No aplica — no hay turno programado ese día |
| Permiso aprobado previamente | ❌ Ya existe registro `absence: leave` — el cron no sobreescribe ausencias existentes |

### Flujo AT4 — Solicitud de permiso (staff)

1. Staff va a `/attendance/leaves` → "Solicitar permiso".
2. Selecciona fecha(s), tipo y escribe el motivo.
3. Admin ve la solicitud pendiente en `/admin/attendance/absences`.
4. Aprueba o rechaza con nota opcional.
5. Si se aprueba → registro en `absences` con `type: 'permiso'` y `approved_by`.

### Flujo AT5 — Edición manual de marca (admin)

Solo usuarios con `attendance.manage` pueden editar marcas:

1. Abrir el detalle del día de un empleado.
2. Editar hora de una marca existente o agregar una marca faltante.
3. El sistema registra `edited_by` + `edit_reason` — inmutable en el historial.
4. Si se edita una marca de `salida`, `overtime_hours` se recalcula automáticamente con la hora nueva.

---

## 6. Requerimientos de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/attendance/mark` | Registrar evento. Body: `{ event_type, gps_lat?, gps_lng?, gps_accuracy_m? }`. Calcula tardanza u horas extra internamente según el tipo. |
| `GET` | `/attendance/today/status` | Estado actual del empleado: último evento, hora registrada, botón disponible. |
| `GET` | `/attendance/me?days=30` | Historial personal: días, horas netas, extras, ausencias. |
| `GET` | `/attendance/live?venue_id=` | Vista en vivo: empleados activos (entrada sin salida). |
| `GET` | `/attendance/report?venue_id=&from=&to=&profile_id=` | Reporte por persona y período usando `v_daily_attendance`. |
| `GET` | `/attendance/alerts?venue_id=` | Ausencias del día, tardanzas y marcas a revisar. |
| `GET` | `/attendance/export?venue_id=&report_type=daily&from=&to=&profile_id=` | CSV diario: una fila por empleado por día. |
| `GET` | `/attendance/export?venue_id=&report_type=weekly&from=&to=&profile_id=` | CSV semanal: una fila por empleado con columnas por día de la semana + totales. Si el rango cubre varias semanas, genera una sección por semana. |
| `GET` | `/attendance/export?venue_id=&report_type=custom&from=&to=&profile_id=` | CSV custom: mismo esquema semanal pero con rango de fechas libre (fecha inicio + fecha fin). |
| `POST` | `/attendance/absences` | Admin crea o edita ausencia manualmente. |
| `PATCH` | `/attendance/logs/{id}` | Admin edita una marca. Registra auditoría. Recalcula extras si es `salida`. |
| `POST` | `/attendance/leave-requests` | Staff solicita permiso. |
| `PATCH` | `/attendance/leave-requests/{id}` | Admin aprueba o rechaza. |
| `GET` | `/attendance/config/{venue_id}` | Configuración de la sede. |
| `PUT` | `/attendance/config/{venue_id}` | Guardar umbrales y coordenadas GPS. |
| `GET` | `/shifts?profile_id=&venue_id=` | Turnos de un empleado. |
| `POST` | `/shifts` | Crear turno. |
| `PATCH` | `/shifts/{id}` | Editar turno. |
| `POST` | `/shifts/{id}/days` | Crear o actualizar el horario de un día de la semana en turno `rotating`. Body: `{ weekday, start_time, end_time, day_off }`. |

> **Cron job:** `POST /internal/attendance/check-absences` — ejecutado **una vez al día a las 11:50 PM**. Revisa empleados con turno programado para ese día. Genera `absence: unexcused` solo si no hay **ninguna** marca en `attendance_logs` para ese empleado ese día. No sobreescribe ausencias ya existentes (`leave`, `sick`, etc.).

---

## 7. Requerimientos del Frontend

### 7.1 Integración en el dashboard principal

```
Sección 1: Checklists de hoy       → /checklists
Sección 2: Inventario pendiente    → /inventory
Sección 3: Mi asistencia hoy       → /attendance
```

La card de asistencia muestra el estado contextual:

```
Sin marca:
┌─────────────────────────────────┐
│  ⏰ No has marcado entrada hoy  │
│  Tu turno empieza a las 09:00   │
│  [Marcar entrada →]             │
└─────────────────────────────────┘

Trabajando:
┌─────────────────────────────────┐
│  🟢 Trabajando desde 09:07 AM   │
│  Turno: 09:00 — 18:00           │
│  [Iniciar pausa] [Marcar salida]│
└─────────────────────────────────┘

Jornada completa:
┌─────────────────────────────────┐
│  ✅ Jornada completa             │
│  9h 15min · 1h extra            │
│  [Ver resumen →]                │
└─────────────────────────────────┘
```

### 7.2 Pantalla de marcación (`/attendance`)

Flujo directo sin escáner QR en el MVP:

1. **Vista de estado** — muestra turno del día y botón de acción.
2. **Confirmación** — "¿Confirmas marcar tu entrada a las 09:07 AM?" con [Confirmar] y [Cancelar].
3. **Resultado** — mostrado 3 segundos antes de redirigir al dashboard:

```
Entrada:
✅ Entrada registrada — 09:07 AM
   7 min tarde  (turno desde 09:00)

Salida con horas extra:
✅ Salida registrada — 19:12 PM
   Horas trabajadas: 9h 58min
   Horas extra: 1  (salida después de las 19:00)

Salida sin horas extra:
✅ Salida registrada — 18:30 PM
   Horas trabajadas: 9h 14min
   Sin horas extra
```

### 7.3 Vista en vivo del admin (`/admin/attendance`)

```
ASISTENCIA HOY — Martes 14 Oct
Central Park Bistro                        ↻ hace 1 min

┌───────────────┬──────────┬─────────────┬───────────────┐
│  Empleado     │ Entrada  │ Pausa       │ Estado        │
├───────────────┼──────────┼─────────────┼───────────────┤
│  María G.     │ 09:01    │ —           │ 🟢 Activo     │
│  Carlos R.    │ 09:17 ⚠️ │ 12:05–12:58 │ 🟢 Activo     │
│  Ana L.       │ 09:31 🔴 │ En pausa ↗  │ 🟡 En pausa   │
│  Pedro M.     │ —        │ —           │ 🔴 Sin registro│
└───────────────┴──────────┴─────────────┴───────────────┘

Alertas de hoy:
⚠️ Carlos R. — 17 min tarde
🔴 Ana L. — 31 min tarde
🔴 Pedro M. — Sin registro (turno desde 09:00)  [Justificar ausencia]
```

SWR `refreshInterval: 60_000`. Click en cualquier fila → detalle del día con timeline de marcas y opción de editar.

### 7.4 Exportación y Reportes (`/admin/attendance/reports`)

La pantalla de reportes tiene un selector de tipo de reporte con tres opciones. Los tres comparten el mismo selector de sede y rango de fechas (`from` / `to`), y un filtro opcional de empleado.

---

#### Tipo 1 — Diario

Una fila por empleado por día. Muestra el detalle de cada jornada.

**Pantalla — tabla previa:**

| Empleado | Fecha | Entrada | Salida | H. netas | H. extra | Tardanza | Ausencia |
|---|---|---|---|---|---|---|---|
| María G. | Lun 14 Oct | 09:01 | 18:05 | 8.90h | 0 | 1 min | — |
| María G. | Mar 15 Oct | 08:00 | 19:12 | 10.20h | 1h | 0 | — |
| Carlos R. | Lun 14 Oct | 09:17 | 18:00 | 8.25h | 0 | 17 min | — |
| Ana L. | Lun 14 Oct | — | — | 0 | 0 | — | unexcused |

**Formato CSV:**
```csv
name,date,clock_in,clock_out,net_hours,overtime_hours,late_minutes,absence
"María García",2024-10-14,09:01,18:05,8.90,0,1,
"María García",2024-10-15,08:00,19:12,10.20,1,0,
"Carlos Ruiz",2024-10-14,09:17,18:00,8.25,0,17,
"Ana López",2024-10-14,,,0,0,,unexcused
```

---

#### Tipo 2 — Semanal

Una fila por empleado con una columna por cada día de la semana seleccionada más una columna de totales. Cada celda de día muestra las métricas clave separadas por `/`.

**Pantalla — tabla previa** (semana 14–20 Oct):

| Empleado | Lunes 14 | Martes 15 | Miér. 16 | Jueves 17 | Viernes 18 | Sáb. 19 | Dom. 20 | TOTAL |
|---|---|---|---|---|---|---|---|---|
| María G. | 8.9h / 0ext / 1min | 10.2h / 1ext / 0 | 9.0h / 0ext / 0 | — | 8.5h / 0ext / 5min | libre | libre | 36.6h / 1ext |
| Carlos R. | 8.3h / 0ext / 17min | AUSENTE | 8.0h / 0ext / 0 | 8.0h / 0ext / 0 | 8.0h / 0ext / 0 | — | — | 40.3h / 0ext |

Leyenda de cada celda: `{net_hours}h / {overtime}ext / {late_min}min`. Días libres (`day_off: true`) muestran "libre". Días sin turno muestran "—". Ausencias muestran "AUSENTE".

**Formato CSV** (una fila por empleado, columnas por día):
```csv
name,mon_net,mon_ot,mon_late,mon_absence,tue_net,tue_ot,tue_late,tue_absence,wed_net,wed_ot,wed_late,wed_absence,thu_net,thu_ot,thu_late,thu_absence,fri_net,fri_ot,fri_late,fri_absence,sat_net,sat_ot,sat_late,sat_absence,sun_net,sun_ot,sun_late,sun_absence,week_total_net,week_total_ot
"María García",8.90,0,1,,10.20,1,0,,9.00,0,0,,0,0,0,,8.50,0,5,,,,day_off,,,,day_off,,36.60,1
"Carlos Ruiz",8.25,0,17,,0,0,0,unexcused,8.00,0,0,,8.00,0,0,,8.00,0,0,,,,,,,,,40.25,0
```

Columnas por día: `{day}_net`, `{day}_ot` (overtime hours), `{day}_late` (minutos), `{day}_absence`. Las últimas dos columnas son `week_total_net` y `week_total_ot`.

---

#### Tipo 3 — Custom (rango libre)

Mismo formato que el **diario** pero con cualquier rango de fechas definido por el usuario (`from` / `to`). Si el rango es de 1 semana exacta → mismo resultado que el semanal en formato diario.

El backend usa el mismo query de `v_daily_attendance` que el reporte diario, simplemente con el rango extendido. No hay un formato especial — es diario con más filas.

**Pantalla:** selector de `Fecha inicio` y `Fecha fin` con date pickers. Máximo 90 días por exportación para evitar archivos excesivamente grandes.

**Formato CSV:** idéntico al diario.

---

#### UI del selector de tipo de reporte

```
┌─────────────────────────────────────────────────┐
│  Exportar reporte de asistencia                 │
│                                                 │
│  Sede:    [Central Park Bistro ▾]               │
│  Empleado: [Todos ▾]                            │
│                                                 │
│  Tipo de reporte:                               │
│  ○ Diario      ● Semanal      ○ Custom          │
│                                                 │
│  Semana del:   [14 Oct 2024 ▾]                  │
│  (muestra Lun–Dom automáticamente)              │
│                                                 │
│  [Vista previa]     [Exportar CSV ↓]            │
└─────────────────────────────────────────────────┘
```

* **Diario:** `from` y `to` libres. Default: últimos 7 días.
* **Semanal:** selector de semana (muestra Lunes–Domingo automáticamente). `from` = lunes de esa semana, `to` = domingo.
* **Custom:** date pickers de `from` y `to`. Máximo 90 días.

El botón "Vista previa" carga la tabla en pantalla antes de exportar. El botón "Exportar CSV" llama a `GET /attendance/export` con los parámetros correspondientes.

---

## 8. Permisos del módulo (integración con M6-INV)

**Módulo: `attendance`**

| Permiso key | Descripción |
|---|---|
| `attendance.mark` | Marcar entrada, salida y pausas propias |
| `attendance.view_own` | Ver historial personal |
| `attendance.request_leave` | Solicitar permisos de ausencia |
| `attendance.view_team` | Ver asistencia de otros empleados de la sede |
| `attendance.manage` | Gestionar ausencias, aprobar permisos, editar marcas |
| `attendance.view_reports` | Ver reportes y exportar nómina |
| `attendance.configure` | Configurar GPS y umbrales de la sede |

---

## 9. Privacidad y Auditoría

* **GPS solo al marcar (M15-ATT):** nunca en segundo plano. Se solicita puntualmente durante la marcación.
* **Datos mínimos:** coordenada del momento de la marca, no historial de movimiento.
* **Columnas GPS desde el inicio:** presentes en el esquema desde M13-ATT aunque no se validen. Cuando M15-ATT se active, solo se cambia `gps_verification_enabled: true` — sin migraciones de esquema ni pérdida de datos históricos.
* **Inmutabilidad para el staff:** el staff no puede editar ni eliminar sus marcas. Toda edición del admin queda firmada con `edited_by` + `edit_reason`.
* **Transparencia (M15-ATT):** la pantalla de marcación mostrará claramente que se está capturando la ubicación y para qué.

---

## 10. Plan de Implementación — Milestones

```
M13-ATT  Pausas, ausencias y cron job              ← MILESTONE ACTIVO
M14-ATT  Reportes, historial y exportación         ← pendiente
──────────────────────────────────────────────────────────────────
M15-ATT  Verificación GPS                          ← anti-fraude (fase futura)
```

> ℹ️ Los milestones arrancan en M13 porque M1–M12 pertenecen al roadmap principal (VERUM.md) y al módulo de inventario (VERUM_PRD_Inventario.md).

> ⚠️ No comenzar M15-ATT hasta que M14-ATT esté en uso activo y el equipo haya adoptado el sistema.

---

### ✅ M13-ATT — Pausas, Ausencias y Cron Job
**Victoria:** Pausas registradas. Inasistencias detectadas al final del día. Turnos rotativos con horario por día funcionando. Staff puede solicitar permisos.

**SQL a agregar:** `shift_days` (reemplaza `shift_schedules` del milestone anterior), `absences`.

> **Migración:** si existen datos en `shift_schedules` del milestone anterior, migrarlos a `shift_days` antes de activar este milestone.

**Backend:**
* `POST /attendance/mark` actualizado para `break_start` y `break_end`.
* Error `ALREADY_ON_BREAK` si se intenta iniciar pausa con otra activa.
* Alerta si pausa supera `max_break_minutes`.
* Extras tempranas calculadas al registrar `clock_in`: `calcular_extras_entrada(hora_real, start_time)`.
* Lógica de resolución de turno para `rotating`: consulta `shift_days` por `weekday` del día actual.
* Cron job `check-absences` — **11:50 PM diario**. Genera `absence: unexcused` solo si no hay ninguna marca en el día. No sobreescribe ausencias existentes.
* `POST /attendance/absences` — admin crea/edita ausencia.
* `PATCH /attendance/logs/{id}` — edición manual con auditoría. Recalcula `overtime_hours` si se edita `clock_in` o `clock_out`.
* `POST/PATCH /attendance/leave-requests` — solicitudes de permiso.
* `POST /shifts/{id}/days` — crear/actualizar horario por día para turnos `rotating`.

**Frontend:**
* Máquina de estados completa: botones de pausa según `event_type` del último registro.
* `/admin/attendance/shifts` — formulario de turno `rotating` con tabla de 7 días (Lun–Dom), cada fila con hora inicio, hora fin y toggle de día libre.
* `/admin/attendance` — alertas de inasistencias con botón "Justificar".
* `/admin/attendance/absences` — gestión y aprobación de permisos.
* `/attendance/leaves` — historial de permisos del staff y solicitud nueva.

**Criterio de éxito:** Admin configura turno rotativo Lunes 9am–6pm, Martes 1pm–10pm, Miércoles 4pm–11pm → staff llega el martes a las 12pm → `minutes_late: 60` registrado, sin inasistencia → empleado sin ninguna marca el miércoles → cron de 11:50pm crea `absence: unexcused` → alerta en panel del admin.

---

### ✅ M14-ATT — Reportes, Historial y Exportación
**Victoria:** Admin genera reporte con 3 formatos de exportación (diario, semanal, custom). Staff ve su historial. MVP completo.

**SQL a agregar:** Sin tablas nuevas.

**Backend:**
* `GET /attendance/report` — tabla previa usando `v_daily_attendance`.
* `GET /attendance/export?report_type=daily&from=&to=` — CSV diario: una fila por empleado por día con `name, date, clock_in, clock_out, net_hours, overtime_hours, late_minutes, absence`.
* `GET /attendance/export?report_type=weekly&from=&to=` — CSV semanal: una fila por empleado con columnas `{day}_net`, `{day}_ot`, `{day}_late`, `{day}_absence` para cada día (mon–sun) + `week_total_net`, `week_total_ot`. Si el rango cubre múltiples semanas, devuelve una sección por semana.
* `GET /attendance/export?report_type=custom&from=&to=` — mismo esquema semanal con rango libre. Máximo 90 días por exportación.
* `GET /attendance/me` — historial personal con desglose por día.
* `GET /attendance/alerts` — tardanzas y ausencias del período.

**Frontend:**
* `/admin/attendance/reports` — tabla previa con filtros de sede, período y empleado.
* `/admin/attendance/export` — pantalla con tres pestañas (Diario / Semanal / Custom), botón "Vista previa" y botón "Exportar CSV". Ver detalle en sección 7.4.
* `/attendance/history` — calendario coloreado: verde (trabajó), rojo (ausente), gris (sin turno). Click en un día → detalle con timeline de marcas.

**Criterio de éxito:** Admin selecciona formato semanal → ve tabla con columna por día (Lun–Dom) y totales → exporta CSV → lo abre en Excel con las columnas exactas por día sin procesamiento adicional. Admin selecciona custom del 1 al 15 → exporta quincena agrupada por semanas.

---

### 🔒 M15-ATT — Verificación GPS (Fase Futura)
**Victoria:** Una marca desde fuera del radio del local es rechazada. El esquema no cambia — solo se activa el flag.

> Se planifica e implementa en una fase posterior, una vez el MVP esté en uso activo. Fecha a definir.

**SQL a agregar:** Sin tablas ni columnas nuevas. El esquema ya está preparado desde M13-ATT.

**Backend:**
* Servicio `haversine_distance(lat1, lng1, lat2, lng2) → meters`.
* `POST /attendance/mark` — validar distancia cuando `gps_verification_enabled = true`.
* Nuevos errores: `GPS_OUT_OF_RANGE`, `GPS_PERMISSION_DENIED`, `GPS_UNAVAILABLE`.

**Frontend:**
* `/attendance` — solicitar permiso de geolocalización antes de mostrar botones de marcación.
* Mensajes claros para los 3 casos de error GPS.

**Activación:** el admin cambia `gps_verification_enabled: true` en `/admin/attendance/config` de la sede. Sin redeploy, sin migración. Los registros históricos del MVP mantienen `verification_status: 'no_requerida'`.

**Criterio de éxito:** Staff intenta marcar desde fuera del radio de 100m → error "Estás fuera del local, acércate al restaurante" → no se registra la marca → staff dentro del local marca sin problema.