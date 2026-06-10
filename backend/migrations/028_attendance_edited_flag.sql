-- backend/migrations/028_attendance_edited_flag.sql

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
  a.type as absence_type,
  bool_or(al.edited_by is not null) as is_edited
from attendance_logs al
join profiles p on p.id = al.profile_id
left join absences a on a.profile_id = al.profile_id and a.date = date_trunc('day', al.marked_at)::date
group by al.profile_id, p.full_name, al.venue_id, date_trunc('day', al.marked_at)::date, a.type;
