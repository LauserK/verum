-- Milestone 3.5: Reusable Checklists (On-Demand)

-- Add custom_title and is_private to submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS custom_title text NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;