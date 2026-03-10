-- ==============================================================================
-- 006_admin_features.sql
-- Adds due_time, schedule to checklist_templates and started_at to submissions.
-- ==============================================================================

-- 1. Add due_time (hora límite) to checklist_templates
ALTER TABLE checklist_templates
ADD COLUMN due_time TIME NULL;

-- 2. Add schedule (días de la semana, 0=Dom, 1=Lun, ..., 6=Sáb)
ALTER TABLE checklist_templates
ADD COLUMN schedule INT[] NULL;

-- 3. Add started_at to submissions (first auto-save timestamp)
ALTER TABLE submissions
ADD COLUMN started_at TIMESTAMPTZ NULL;
