-- ==============================================================================
-- 008_template_due_date.sql
-- Add a due_date column to the checklist_templates table to support scheduling
-- checklists for a specific date rather than just a recurring frequency.
-- ==============================================================================

ALTER TABLE checklist_templates
ADD COLUMN IF NOT EXISTS due_date DATE NULL;
