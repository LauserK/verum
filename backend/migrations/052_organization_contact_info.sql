-- Migration 052: Add contact info columns to organizations table
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing default organization with contact info for purchase orders representation
UPDATE public.organizations 
SET 
  tax_id = 'J-40899652-3',
  address = 'Sede Principal VERUM, Caracas, Venezuela',
  phone = '+58 (212) 555-0199',
  email = 'operaciones@verum.com'
WHERE tax_id IS NULL OR tax_id = '';
