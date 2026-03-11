-- Add available_from_time to checklist templates
ALTER TABLE checklist_templates ADD COLUMN available_from_time time NULL;

-- Update the get_checklists query to also fetch this correctly (handled in backend code usually, but the column must exist)
