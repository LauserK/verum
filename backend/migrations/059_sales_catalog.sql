-- backend/migrations/059_sales_catalog.sql

-- 1. Modify Existing Tables
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN DEFAULT FALSE;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS default_currency TEXT;

-- 2. Sale Categories
CREATE TABLE IF NOT EXISTS public.sale_categories (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name        TEXT NOT NULL,
    icon        TEXT DEFAULT 'lunch_dining',
    image_url   TEXT,
    position    INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (org_id, name)
);

-- 3. Sale Items
CREATE TABLE IF NOT EXISTS public.sale_items (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    category_id     UUID REFERENCES sale_categories(id) ON DELETE SET NULL,
    code            TEXT,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    sale_price      NUMERIC(18,6),
    food_cost       NUMERIC(18,6) DEFAULT 0,
    tax_id          UUID REFERENCES taxes(id) ON DELETE SET NULL,
    tax_included    BOOLEAN DEFAULT TRUE,
    barcode         TEXT,
    image_url       TEXT,
    images          JSONB DEFAULT '[]'::jsonb,
    has_variants    BOOLEAN DEFAULT FALSE,
    variant_label   TEXT DEFAULT '',
    is_active       BOOLEAN DEFAULT TRUE,
    is_featured     BOOLEAN DEFAULT FALSE,
    position        INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sale_items_org ON public.sale_items(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sale_items_category ON public.sale_items(category_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_code ON public.sale_items(org_id, code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sale_items_barcode ON public.sale_items(barcode) WHERE barcode IS NOT NULL;

-- 4. Sale Item Variants
CREATE TABLE IF NOT EXISTS public.sale_item_variants (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_item_id    UUID REFERENCES sale_items(id) ON DELETE CASCADE NOT NULL,
    name            TEXT NOT NULL,
    price           NUMERIC(18,6) NOT NULL,
    food_cost       NUMERIC(18,6) DEFAULT 0,
    external_code   TEXT,
    is_default      BOOLEAN DEFAULT FALSE,
    position        INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (sale_item_id, name)
);
CREATE INDEX IF NOT EXISTS idx_sale_variants_item ON public.sale_item_variants(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_variants_ext ON public.sale_item_variants(external_code) WHERE external_code IS NOT NULL;

-- 5. RLS Policies
ALTER TABLE public.sale_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_item_variants ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'sale_categories', 'sale_items', 'sale_item_variants'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Org members full access" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Org members full access" ON public.%I '
            'FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
        );
    END LOOP;
END $$;
