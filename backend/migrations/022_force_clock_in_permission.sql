-- Migration: Add force clock-in permission
INSERT INTO permissions (module, action, key, description) 
VALUES ('attendance', 'force_clock_in', 'attendance.force_clock_in', 'Force user to clock-in before accessing other modules')
ON CONFLICT (key) DO NOTHING;
