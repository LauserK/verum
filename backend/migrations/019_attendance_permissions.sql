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