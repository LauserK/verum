-- backend/migrations/040_catering_extra_fields.sql

-- Alter catering_requests table to add tentative_production_date and buffer_percentage
ALTER TABLE catering_requests 
ADD COLUMN IF NOT EXISTS tentative_production_date DATE,
ADD COLUMN IF NOT EXISTS buffer_percentage NUMERIC(18, 6) DEFAULT 0.0;
