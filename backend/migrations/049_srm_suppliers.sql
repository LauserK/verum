-- backend/migrations/049_srm_suppliers.sql

-- 1. Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id              UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  code                TEXT,                    -- SUP-001, etc.
  name                TEXT NOT NULL,
  tax_id              TEXT,                    -- RIF, NIT, RFC
  email               TEXT,
  phone               TEXT,
  address             TEXT,
  payment_terms_days  INTEGER DEFAULT 0 NOT NULL,
  credit_limit        NUMERIC(18,2),
  currency            TEXT DEFAULT 'USD' NOT NULL,
  status              TEXT CHECK (status IN ('active', 'inactive', 'blocked')) DEFAULT 'active' NOT NULL,
  score               NUMERIC(3,1),            -- 0.0 to 5.0
  notes               TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Create supplier_contacts table
CREATE TABLE IF NOT EXISTS public.supplier_contacts (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT,          -- 'ventas', 'logística', etc.
  email       TEXT,
  phone       TEXT,
  is_primary  BOOLEAN DEFAULT false NOT NULL
);

-- 3. Create supplier_items table
CREATE TABLE IF NOT EXISTS public.supplier_items (
  supplier_id    UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  item_id        UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  supplier_sku   TEXT,
  lead_time_days INTEGER,
  is_preferred   BOOLEAN DEFAULT false NOT NULL,
  PRIMARY KEY (supplier_id, item_id)
);

-- 4. Create supplier_price_lists table
CREATE TABLE IF NOT EXISTS public.supplier_price_lists (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  valid_from  DATE NOT NULL,
  valid_until DATE,
  is_active   BOOLEAN DEFAULT true NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. Create supplier_price_list_items table
CREATE TABLE IF NOT EXISTS public.supplier_price_list_items (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  price_list_id           UUID REFERENCES public.supplier_price_lists(id) ON DELETE CASCADE NOT NULL,
  item_id                 UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  unit_cost_base          NUMERIC(18,6) NOT NULL,
  presentation_id         UUID REFERENCES public.uom_presentations(id) ON DELETE SET NULL,
  unit_cost_presentation  NUMERIC(18,6),
  min_qty_base            NUMERIC(18,6),
  notes                   TEXT
);

-- 6. Create po_approval_limits table
CREATE TABLE IF NOT EXISTS public.po_approval_limits (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  role_id     UUID REFERENCES public.custom_roles(id) ON DELETE CASCADE NOT NULL,
  max_amount  NUMERIC(18,2),   -- NULL = sin límite (dueño)
  UNIQUE (org_id, role_id)
);

-- 7. Create po_approval_config table
CREATE TABLE IF NOT EXISTS public.po_approval_config (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id                  UUID REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
  creator_can_approve_own BOOLEAN DEFAULT false NOT NULL,
  require_approval_above  NUMERIC(18,2) DEFAULT 0 NOT NULL
);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_approval_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_approval_config ENABLE ROW LEVEL SECURITY;

-- 9. Create default permissive policies for authenticated users
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.suppliers;
CREATE POLICY "Authenticated users can do everything" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_contacts;
CREATE POLICY "Authenticated users can do everything" ON public.supplier_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_items;
CREATE POLICY "Authenticated users can do everything" ON public.supplier_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_price_lists;
CREATE POLICY "Authenticated users can do everything" ON public.supplier_price_lists FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_price_list_items;
CREATE POLICY "Authenticated users can do everything" ON public.supplier_price_list_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.po_approval_limits;
CREATE POLICY "Authenticated users can do everything" ON public.po_approval_limits FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.po_approval_config;
CREATE POLICY "Authenticated users can do everything" ON public.po_approval_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. Create indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers(org_id, status);
CREATE INDEX IF NOT EXISTS idx_supplier_items ON public.supplier_items(item_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_list_item ON public.supplier_price_list_items(item_id, price_list_id);
