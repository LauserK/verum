-- backend/migrations/023_absence_status.sql
-- Add status and comment to absences to support request workflow

ALTER TABLE absences 
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS admin_comment text NULL,
ADD COLUMN IF NOT EXISTS requested_at timestamp with time zone DEFAULT now();

-- Update existing absences to 'approved' if they are null
UPDATE absences SET status = 'approved' WHERE status IS NULL;
