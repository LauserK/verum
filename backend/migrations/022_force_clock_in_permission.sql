-- Migration: Add force clock-in permission
INSERT INTO permissions (key, description, category) 
VALUES ('attendance.force_clock_in', 'Force user to clock-in before accessing other modules', 'Attendance');
