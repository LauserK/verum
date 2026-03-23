-- backend/migrations/021_drop_submissions_shift_constraint.sql
-- Elimina la restricción que solo permite 'morning', 'mid', 'closing' para permitir UUIDs de turnos reales.
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_shift_check;
