-- backend/migrations/019_attendance_permissions.sql

INSERT INTO permissions (module, action, key, description) VALUES
  ('attendance', 'mark', 'attendance.mark', 'Marcar entrada, salida y pausas propias'),
  ('attendance', 'view_own', 'attendance.view_own', 'Ver historial personal'),
  ('attendance', 'request_leave', 'attendance.request_leave', 'Solicitar permisos de ausencia'),
  ('attendance', 'view_team', 'attendance.view_team', 'Ver asistencia de otros empleados de la sede'),
  ('attendance', 'manage', 'attendance.manage', 'Gestionar ausencias, aprobar permisos, editar marcas'),
  ('attendance', 'view_reports', 'attendance.view_reports', 'Ver reportes y exportar nómina'),
  ('attendance', 'configure', 'attendance.configure', 'Configurar GPS y umbrales de la sede')
ON CONFLICT (key) DO NOTHING;