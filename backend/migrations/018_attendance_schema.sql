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

-- 2. Turnos por empleado
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
  verification_status text check (verification_status in ('not_required', 'verified', 'rejected', 'no_gps')) default 'not_required',
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