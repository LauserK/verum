-- Migration 052: Add contact info columns to organizations table
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS email TEXT;
