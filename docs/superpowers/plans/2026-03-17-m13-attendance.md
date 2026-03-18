# M13-ATT: Attendance Control MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the foundational Attendance module (MVP) allowing staff to clock in/out, take breaks, and admins to configure shifts, view live attendance, and manage absences.

**Architecture:** 
- **Database:** Introduces `attendance_config`, `shifts`, `shift_days` (replaces old date-specific `shift_schedules`), `attendance_logs`, `absences`, and `v_daily_attendance` view.
- **Backend (FastAPI):** State machine logic for attendance marking, automatic calculation of overtime (floor hours) and late minutes, endpoints for shift configuration and admin live view. A cron-job endpoint to automatically flag unexcused absences.
- **Frontend (Next.js):** Employee dashboard widget, marking flow, Admin shift configuration UI, and Admin live attendance view.

**Tech Stack:** FastAPI, Supabase PostgreSQL, Next.js, TailwindCSS.

---

## Chunk 1: Database Schema & Permissions

### Task 1: Create Database Migration
Create the SQL schema for attendance according to the PRD.

**Files:**
- Create: `backend/migrations/018_attendance_schema.sql`

- [ ] **Step 1: Write migration for configuration and shifts**
```sql
-- backend/migrations/018_attendance_schema.sql

-- 1. Configuración de asistencia por sede
create table if not exists attendance_config (
  id                        uuid default uuid_generate_v4() primary key,
  venue_id                  uuid references venues(id) on delete cascade unique,
  gps_lat                   numeric(10, 7),
  gps_lng                   numeric(10, 7),
  gps_radius_m              integer default 100,
  gps_verification_enabled  boolean default false,
  late_threshold_minutes    integer default 10,
  max_break_minutes         integer default 60
);

-- 2. Turnos por empleado (replaces old shifts logic if any, but we call it employee_shifts to avoid conflict with existing 'shifts' table which is used for venue shifts)
-- Note: PRD calls it 'shifts'. The existing DB already has a 'shifts' table used for Checklists (venue shifts like 'Morning', 'Mid').
-- We must rename this to 'employee_shifts' to avoid breaking M1-M5.
create table if not exists employee_shifts (
  id           uuid default uuid_generate_v4() primary key,
  profile_id   uuid references profiles(id) on delete cascade,
  venue_id     uuid references venues(id),
  modality     text check (modality in ('fixed', 'rotating', 'flexible')),
  weekdays     integer[],   -- [1,2,3,4,5] = Mon–Fri (ISO: 1=Monday)
  start_time   time,
  end_time     time,
  is_active    boolean default true,
  created_at   timestamp with time zone default now()
);

-- 3. Horario por día de semana para turnos rotativos
create table if not exists shift_days (
  id           uuid default uuid_generate_v4() primary key,
  employee_shift_id uuid references employee_shifts(id) on delete cascade,
  weekday      integer not null check (weekday between 1 and 7),
  start_time   time,
  end_time     time,
  day_off      boolean default false,
  unique (employee_shift_id, weekday)
);

-- 4. Registro de marcas
create table if not exists attendance_logs (
  id              uuid default uuid_generate_v4() primary key,
  profile_id      uuid references profiles(id) on delete cascade,
  venue_id        uuid references venues(id),
  event_type      text check (event_type in ('clock_in', 'clock_out', 'break_start', 'break_end')),
  employee_shift_id uuid references employee_shifts(id),
  expected_start  time,
  expected_end    time,
  minutes_late    integer,
  overtime_hours  integer,
  gps_lat         numeric(10, 7),
  gps_lng         numeric(10, 7),
  gps_accuracy_m  integer,
  gps_distance_m  integer,
  verification_status text check (verification_status in ('no_requerida', 'verificado', 'rechazado', 'sin_gps')) default 'no_requerida',
  edited_by       uuid references profiles(id),
  edit_reason     text,
  marked_at       timestamp with time zone default now(),
  device_info     text
);

-- 5. Ausencias y justificaciones
create table if not exists absences (
  id           uuid default uuid_generate_v4() primary key,
  profile_id   uuid references profiles(id) on delete cascade,
  venue_id     uuid references venues(id),
  date         date not null,
  type         text check (type in ('unexcused', 'excused', 'leave', 'sick', 'holiday')),
  reason       text,
  approved_by  uuid references profiles(id),
  created_at   timestamp with time zone default now(),
  unique (profile_id, date)
);

-- 6. Vista: resumen diario
create or replace view v_daily_attendance as
select
  al.profile_id,
  p.full_name,
  al.venue_id,
  date_trunc('day', al.marked_at)::date as work_date,
  min(al.marked_at) filter (where al.event_type = 'clock_in') as clock_in,
  max(al.marked_at) filter (where al.event_type = 'clock_out') as clock_out,
  round(extract(epoch from (max(al.marked_at) filter (where al.event_type = 'clock_out') - min(al.marked_at) filter (where al.event_type = 'clock_in'))) / 3600.0, 2) as gross_hours,
  round(extract(epoch from (max(al.marked_at) filter (where al.event_type = 'break_end') - min(al.marked_at) filter (where al.event_type = 'break_start'))) / 3600.0, 2) as break_hours,
  round(
    extract(epoch from (max(al.marked_at) filter (where al.event_type = 'clock_out') - min(al.marked_at) filter (where al.event_type = 'clock_in'))) / 3600.0
    - coalesce(extract(epoch from (max(al.marked_at) filter (where al.event_type = 'break_end') - min(al.marked_at) filter (where al.event_type = 'break_start'))) / 3600.0, 0)
  , 2) as net_hours,
  coalesce(max(al.overtime_hours) filter (where al.event_type = 'clock_in'), 0) + coalesce(max(al.overtime_hours) filter (where al.event_type = 'clock_out'), 0) as overtime_hours,
  max(al.minutes_late) filter (where al.event_type = 'clock_in') as minutes_late,
  a.type as absence_type
from attendance_logs al
join profiles p on p.id = al.profile_id
left join absences a on a.profile_id = al.profile_id and a.date = date_trunc('day', al.marked_at)::date
group by al.profile_id, p.full_name, al.venue_id, date_trunc('day', al.marked_at)::date, a.type;

create index if not exists idx_attendance_profile_date on attendance_logs(profile_id, marked_at);
create index if not exists idx_attendance_venue_date   on attendance_logs(venue_id, marked_at);
create index if not exists idx_eshifts_profile         on employee_shifts(profile_id);
create index if not exists idx_absences_profile_date   on absences(profile_id, date);
```

- [ ] **Step 2: Add Seed Permissions**
We need to register the new permissions in the DB.
Create `backend/migrations/019_attendance_permissions.sql`.
```sql
-- backend/migrations/019_attendance_permissions.sql

insert into public.permissions (key, description, module) values
  ('attendance.mark', 'Marcar entrada, salida y pausas propias', 'attendance'),
  ('attendance.view_own', 'Ver historial personal', 'attendance'),
  ('attendance.request_leave', 'Solicitar permisos de ausencia', 'attendance'),
  ('attendance.view_team', 'Ver asistencia de otros empleados de la sede', 'attendance'),
  ('attendance.manage', 'Gestionar ausencias, aprobar permisos, editar marcas', 'attendance'),
  ('attendance.view_reports', 'Ver reportes y exportar nómina', 'attendance'),
  ('attendance.configure', 'Configurar GPS y umbrales de la sede', 'attendance')
on conflict (key) do nothing;
```

- [ ] **Step 3: Commit**
```bash
git add backend/migrations/018_attendance_schema.sql backend/migrations/019_attendance_permissions.sql
git commit -m "feat(db): add attendance schema and permissions (M13)"
```

---

## Chunk 2: Backend - Shift Management API

### Task 2: Implement Shift Configurations

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add Shift Models**
```python
# ── Attendance: Shifts Models (M13) ──
class EmployeeShiftRequest(BaseModel):
    profile_id: str
    venue_id: str
    modality: str
    weekdays: Optional[list[int]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_active: bool = True

class ShiftDayRequest(BaseModel):
    weekday: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    day_off: bool = False
```

- [ ] **Step 2: Add Endpoints**
```python
# ── Attendance: Shifts Endpoints (M13) ──

@app.get("/employee-shifts")
async def list_employee_shifts(profile_id: Optional[str] = None, venue_id: Optional[str] = None, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    query = db.table("employee_shifts").select("*, shift_days(*)")
    if profile_id:
        query = query.eq("profile_id", profile_id)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    res = query.execute()
    return res.data

@app.post("/employee-shifts")
async def create_employee_shift(body: EmployeeShiftRequest, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    res = db.table("employee_shifts").insert(body.dict(exclude_none=True)).execute()
    return res.data[0]

@app.patch("/employee-shifts/{shift_id}")
async def update_employee_shift(shift_id: str, body: EmployeeShiftRequest, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    res = db.table("employee_shifts").update(body.dict(exclude_none=True)).eq("id", shift_id).execute()
    return res.data[0]

@app.post("/employee-shifts/{shift_id}/days")
async def update_shift_day(shift_id: str, body: ShiftDayRequest, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    data = body.dict()
    data["employee_shift_id"] = shift_id
    res = db.table("shift_days").upsert(data, on_conflict="employee_shift_id,weekday").execute()
    return res.data[0]
```

- [ ] **Step 3: Commit**
```bash
git add backend/main.py
git commit -m "feat(api): add employee shifts endpoints (M13)"
```

---

## Chunk 3: Backend - Attendance Marking API

### Task 3: State Machine and Marking

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add Mark Request Model**
```python
# ── Attendance: Marking Models (M13) ──
class MarkAttendanceRequest(BaseModel):
    event_type: str # clock_in, clock_out, break_start, break_end
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    gps_accuracy_m: Optional[int] = None
```

- [ ] **Step 2: Helper Functions for Overtime/Late**
```python
from datetime import date, time as dtime

def get_active_shift_for_today(profile_id: str, venue_id: str, db) -> dict:
    today_dt = datetime.now(CARACAS_TZ)
    iso_weekday = today_dt.isoweekday() # 1=Mon, 7=Sun
    
    # Get active shift
    shift_res = db.table("employee_shifts").select("*").eq("profile_id", profile_id).eq("venue_id", venue_id).eq("is_active", True).execute()
    if not shift_res.data:
        return None
    
    shift = shift_res.data[0]
    
    if shift["modality"] == "flexible":
        return {"id": shift["id"], "expected_start": None, "expected_end": None}
        
    elif shift["modality"] == "fixed":
        if shift["weekdays"] and iso_weekday in shift["weekdays"]:
            return {"id": shift["id"], "expected_start": shift.get("start_time"), "expected_end": shift.get("end_time")}
        return None
        
    elif shift["modality"] == "rotating":
        days_res = db.table("shift_days").select("*").eq("employee_shift_id", shift["id"]).eq("weekday", iso_weekday).execute()
        if days_res.data and not days_res.data[0].get("day_off"):
            return {"id": shift["id"], "expected_start": days_res.data[0].get("start_time"), "expected_end": days_res.data[0].get("end_time")}
        return None
        
    return None

def calculate_late_minutes(real_time_str: str, expected_time_str: str) -> int:
    if not expected_time_str: return 0
    rt = datetime.strptime(real_time_str, "%H:%M:%S").time()
    et = datetime.strptime(expected_time_str, "%H:%M:%S").time()
    diff = (rt.hour * 60 + rt.minute) - (et.hour * 60 + et.minute)
    return max(0, diff)

def calculate_overtime(real_time_str: str, expected_time_str: str, is_entry: bool) -> int:
    if not expected_time_str: return 0
    rt = datetime.strptime(real_time_str, "%H:%M:%S").time()
    et = datetime.strptime(expected_time_str, "%H:%M:%S").time()
    rm = rt.hour * 60 + rt.minute
    em = et.hour * 60 + et.minute
    
    diff = (em - rm) if is_entry else (rm - em)
    if diff <= 0: return 0
    return diff // 60 # Floor hours
```

- [ ] **Step 3: Add `GET /attendance/today/status`**
```python
@app.get("/attendance/today/status")
async def get_attendance_status(current_user=Depends(get_current_user), db=Depends(get_db)):
    profile_res = db.table("profiles").select("venue_id").eq("id", current_user.id).single().execute()
    venue_id = profile_res.data.get("venue_id")
    if not venue_id:
        raise HTTPException(400, "No venue assigned")

    today_str = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
    logs_res = db.table("attendance_logs").select("*").eq("profile_id", current_user.id).eq("venue_id", venue_id).gte("marked_at", f"{today_str}T00:00:00-04:00").order("marked_at", desc=True).limit(1).execute()
    
    last_event = logs_res.data[0]["event_type"] if logs_res.data else None
    
    # State Machine
    available_actions = []
    if not last_event: available_actions = ["clock_in"]
    elif last_event == "clock_in": available_actions = ["break_start", "clock_out"]
    elif last_event == "break_start": available_actions = ["break_end"]
    elif last_event == "break_end": available_actions = ["clock_out"]
    
    return {
        "last_event": last_event,
        "last_marked_at": logs_res.data[0]["marked_at"] if logs_res.data else None,
        "available_actions": available_actions
    }
```

- [ ] **Step 4: Add `POST /attendance/mark`**
```python
@app.post("/attendance/mark")
async def mark_attendance(body: MarkAttendanceRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.mark"))):
    profile_res = db.table("profiles").select("venue_id").eq("id", current_user.id).single().execute()
    venue_id = profile_res.data.get("venue_id")
    if not venue_id:
        raise HTTPException(400, "No venue assigned")
        
    status_res = await get_attendance_status(current_user, db)
    if body.event_type not in status_res["available_actions"]:
        raise HTTPException(400, f"Invalid state. Allowed: {status_res['available_actions']}")
        
    now_dt = datetime.now(CARACAS_TZ)
    now_time_str = now_dt.strftime("%H:%M:%S")
    
    active_shift = get_active_shift_for_today(current_user.id, venue_id, db)
    
    log_data = {
        "profile_id": current_user.id,
        "venue_id": venue_id,
        "event_type": body.event_type,
        "gps_lat": body.gps_lat,
        "gps_lng": body.gps_lng,
        "gps_accuracy_m": body.gps_accuracy_m,
    }
    
    if active_shift:
        log_data["employee_shift_id"] = active_shift["id"]
        log_data["expected_start"] = active_shift["expected_start"]
        log_data["expected_end"] = active_shift["expected_end"]
        
        if body.event_type == "clock_in":
            log_data["minutes_late"] = calculate_late_minutes(now_time_str, active_shift["expected_start"])
            log_data["overtime_hours"] = calculate_overtime(now_time_str, active_shift["expected_start"], is_entry=True)
        elif body.event_type == "clock_out":
            log_data["overtime_hours"] = calculate_overtime(now_time_str, active_shift["expected_end"], is_entry=False)
            
    res = db.table("attendance_logs").insert(log_data).execute()
    return res.data[0]
```

- [ ] **Step 5: Commit**
```bash
git add backend/main.py
git commit -m "feat(api): add attendance marking and state machine logic (M13)"
```

---

## Chunk 4: Backend - Absences & Admin Views

### Task 4: Admin Endpoints and Cron

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Admin Live View**
```python
@app.get("/attendance/live")
async def get_live_attendance(venue_id: str, db=Depends(get_db), _=Depends(require_permission("attendance.view_team"))):
    today_str = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
    # Fetch all logs for today in this venue
    logs_res = db.table("attendance_logs").select("*, profiles(full_name)").eq("venue_id", venue_id).gte("marked_at", f"{today_str}T00:00:00-04:00").order("marked_at", desc=True).execute()
    
    # Group by profile to find latest state
    staff_status = {}
    for log in logs_res.data or []:
        pid = log["profile_id"]
        if pid not in staff_status:
            staff_status[pid] = log
            
    return list(staff_status.values())
```

- [ ] **Step 2: Absences and Leave Requests**
```python
class AbsenceRequest(BaseModel):
    profile_id: str
    venue_id: str
    date: str
    type: str
    reason: Optional[str] = None

@app.post("/attendance/absences")
async def create_absence(body: AbsenceRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    data = body.dict()
    data["approved_by"] = current_user.id
    res = db.table("absences").upsert(data, on_conflict="profile_id,date").execute()
    return res.data[0]
```

- [ ] **Step 3: Internal Cron Job for Absences**
```python
@app.post("/internal/attendance/check-absences")
async def cron_check_absences(db=Depends(get_db)):
    """Called daily at 11:50 PM"""
    today_dt = datetime.now(CARACAS_TZ)
    today_str = today_dt.strftime("%Y-%m-%d")
    iso_weekday = today_dt.isoweekday()
    
    # Find all users who were SUPPOSED to work today
    shifts_res = db.table("employee_shifts").select("*").eq("is_active", True).execute()
    expected_profiles = []
    
    for shift in shifts_res.data or []:
        if shift["modality"] == "fixed" and shift["weekdays"] and iso_weekday in shift["weekdays"]:
            expected_profiles.append(shift)
        elif shift["modality"] == "rotating":
            d_res = db.table("shift_days").select("day_off").eq("employee_shift_id", shift["id"]).eq("weekday", iso_weekday).execute()
            if d_res.data and not d_res.data[0].get("day_off"):
                expected_profiles.append(shift)
                
    # Check if they have ANY log today
    for s in expected_profiles:
        pid = s["profile_id"]
        log_check = db.table("attendance_logs").select("id").eq("profile_id", pid).gte("marked_at", f"{today_str}T00:00:00-04:00").limit(1).execute()
        
        if not log_check.data:
            # Check if they already have an absence (e.g., leave/sick)
            abs_check = db.table("absences").select("id").eq("profile_id", pid).eq("date", today_str).execute()
            if not abs_check.data:
                db.table("absences").insert({
                    "profile_id": pid,
                    "venue_id": s["venue_id"],
                    "date": today_str,
                    "type": "unexcused"
                }).execute()
                
    return {"ok": True, "checked": len(expected_profiles)}
```

- [ ] **Step 4: Commit**
```bash
git add backend/main.py
git commit -m "feat(api): add admin live view and absence cron job (M13)"
```

---

## Chunk 5: Frontend - API Client & Dashboard Widget

### Task 5: Add API methods and Dashboard UI

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/dashboard/page.tsx`
- Create: `frontend/src/app/attendance/page.tsx`

- [ ] **Step 1: Add API Client Methods**
```typescript
// in lib/api.ts
export const attendanceApi = {
    getStatus: () => fetchWithAuth('/attendance/today/status'),
    mark: (event_type: string) => fetchWithAuth('/attendance/mark', { method: 'POST', body: JSON.stringify({ event_type }) }),
    getLive: (venueId: string) => fetchWithAuth(`/attendance/live?venue_id=${venueId}`),
};
```

- [ ] **Step 2: Create Employee Attendance Page (`/attendance/page.tsx`)**
Build the page that shows current status and the available action buttons.
```typescript
'use client'
import { useEffect, useState } from 'react'
import { attendanceApi } from '@/lib/api'
import { Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AttendancePage() {
    const [status, setStatus] = useState<any>(null)
    const router = useRouter()

    useEffect(() => {
        attendanceApi.getStatus().then(setStatus).catch(console.error)
    }, [])

    const handleMark = async (type: string) => {
        if (!confirm(`¿Confirmas marcar ${type}?`)) return
        try {
            await attendanceApi.mark(type)
            alert('Marca registrada')
            router.push('/dashboard')
        } catch (e) {
            alert('Error al marcar')
        }
    }

    if (!status) return <div>Loading...</div>

    const mapAction = {
        'clock_in': { label: 'Marcar Entrada', color: 'bg-primary' },
        'clock_out': { label: 'Marcar Salida', color: 'bg-error' },
        'break_start': { label: 'Iniciar Pausa', color: 'bg-warning' },
        'break_end': { label: 'Fin de Pausa', color: 'bg-success' }
    }

    return (
        <div className="p-4 max-w-md mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Asistencia</h1>
            <div className="bg-surface p-6 rounded-2xl border text-center">
                <p className="text-sm text-text-secondary">Último evento: {status.last_event || 'Ninguno hoy'}</p>
                <div className="mt-6 space-y-3">
                    {status.available_actions.map((action: string) => (
                        <button key={action} onClick={() => handleMark(action)} className={`w-full h-14 rounded-xl text-white font-bold ${mapAction[action as keyof typeof mapAction].color}`}>
                            {mapAction[action as keyof typeof mapAction].label}
                        </button>
                    ))}
                    {status.available_actions.length === 0 && <p className="text-success font-bold">Jornada completada</p>}
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Commit Frontend Base**
```bash
git add frontend/src/lib/api.ts frontend/src/app/attendance/page.tsx
git commit -m "feat(ui): add staff attendance marking page (M13)"
```

---

## Chunk 6: Frontend - Admin Live View

### Task 6: Implement Admin Live Attendance

**Files:**
- Create: `frontend/src/app/admin/attendance/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx` (Add navigation)

- [ ] **Step 1: Admin Attendance Page**
```typescript
'use client'
import { useEffect, useState } from 'react'
import { attendanceApi, getProfile } from '@/lib/api'
import { format } from 'date-fns'

export default function AdminAttendancePage() {
    const [liveData, setLiveData] = useState<any[]>([])
    
    useEffect(() => {
        getProfile().then(p => {
            if (p.venues?.[0]) {
                attendanceApi.getLive(p.venues[0].id).then(setLiveData)
                const interval = setInterval(() => attendanceApi.getLive(p.venues[0].id).then(setLiveData), 60000)
                return () => clearInterval(interval)
            }
        })
    }, [])

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Asistencia en Vivo</h1>
            <div className="bg-surface border rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-raised text-text-secondary">
                        <tr>
                            <th className="p-4">Empleado</th>
                            <th className="p-4">Último Evento</th>
                            <th className="p-4">Hora</th>
                        </tr>
                    </thead>
                    <tbody>
                        {liveData.map(log => (
                            <tr key={log.id} className="border-t border-border">
                                <td className="p-4 font-bold">{log.profiles?.full_name}</td>
                                <td className="p-4">{log.event_type}</td>
                                <td className="p-4">{format(new Date(log.marked_at), 'HH:mm')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Add Navigation Link**
In `frontend/src/app/admin/layout.tsx` add a link to `/admin/attendance` with a Users/Clock icon.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/app/admin/attendance/page.tsx frontend/src/app/admin/layout.tsx
git commit -m "feat(ui): add admin live attendance view (M13)"
```

---
*End of Plan*