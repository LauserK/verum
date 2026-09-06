-- backend/migrations/078_user_pin_code.sql
-- Description: Add pin_code to profiles table for fast user authorization, clock-in, and POS operations

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pin_code VARCHAR(6) NULL;

-- Optional index to facilitate lookups by PIN code
CREATE INDEX IF NOT EXISTS idx_profiles_pin_code ON public.profiles (pin_code) WHERE pin_code IS NOT NULL;
