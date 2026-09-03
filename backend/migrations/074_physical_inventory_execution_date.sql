-- backend/migrations/074_physical_inventory_execution_date.sql
-- Add execution_date (fecha valor) to physical_inventories

ALTER TABLE public.physical_inventories
  ADD COLUMN IF NOT EXISTS execution_date TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Backfill existing rows
UPDATE public.physical_inventories
SET execution_date = created_at
WHERE execution_date IS NULL;
