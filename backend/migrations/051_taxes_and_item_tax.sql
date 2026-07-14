-- backend/migrations/051_taxes_and_item_tax.sql

-- 1. Create taxes table
CREATE TABLE IF NOT EXISTS public.taxes (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  rate            NUMERIC(5,4) NOT NULL DEFAULT 0.1600,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;

-- 3. Create security policies for taxes
DROP POLICY IF EXISTS "Users access own org or global taxes" ON public.taxes;
CREATE POLICY "Users access own org or global taxes"
    ON public.taxes FOR ALL TO authenticated
    USING (
        org_id IS NULL                              -- global system taxes: visible to everyone
        OR org_id IN (SELECT get_my_org_ids())      -- organization-specific taxes: only own org
    )
    WITH CHECK (
        org_id IN (SELECT get_my_org_ids())         -- can only modify taxes belonging to own org
    );

-- 4. Seed default system taxes
INSERT INTO public.taxes (id, name, rate, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000000', 'Exento', 0.0000, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5. Add tax_id reference column to items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS tax_id UUID REFERENCES public.taxes(id) ON DELETE SET NULL;

-- 6. Set default tax for existing items to 'IVA 16%'
UPDATE public.items SET tax_id = 'a0000000-0000-0000-0000-000000000000' WHERE tax_id IS NULL;
