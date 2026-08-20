-- backend/migrations/060_sales_components_and_modifiers.sql

-- 1. Sale Item Components (BOM de Venta)
CREATE TABLE IF NOT EXISTS public.sale_item_components (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_item_id    UUID REFERENCES sale_items(id) ON DELETE CASCADE NOT NULL,
    variant_id      UUID REFERENCES sale_item_variants(id) ON DELETE CASCADE,
    item_id         UUID REFERENCES items(id) ON DELETE RESTRICT NOT NULL,
    component_type  TEXT CHECK (component_type IN ('fixed_qty', 'recipe_proportional')) NOT NULL,
    quantity        NUMERIC(18,6) NOT NULL DEFAULT 1,
    label           TEXT,
    position        INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_components_sale_item ON public.sale_item_components(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_components_variant ON public.sale_item_components(variant_id) WHERE variant_id IS NOT NULL;

-- 2. Sale Modifier Groups
CREATE TABLE IF NOT EXISTS public.sale_modifier_groups (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name            TEXT NOT NULL,
    min_selection   INTEGER DEFAULT 0,
    max_selection   INTEGER DEFAULT 1,
    is_active       BOOLEAN DEFAULT TRUE,
    position        INTEGER DEFAULT 0,
    UNIQUE (org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_mod_groups_org ON public.sale_modifier_groups(org_id);

-- 3. Sale Modifier Options
CREATE TABLE IF NOT EXISTS public.sale_modifier_options (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id        UUID REFERENCES sale_modifier_groups(id) ON DELETE CASCADE NOT NULL,
    item_id         UUID REFERENCES items(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    price           NUMERIC(18,6) DEFAULT 0,
    food_cost       NUMERIC(18,6) DEFAULT 0,
    external_code   TEXT,
    deduct_qty      NUMERIC(18,6),
    is_active       BOOLEAN DEFAULT TRUE,
    position        INTEGER DEFAULT 0,
    UNIQUE (group_id, name)
);
CREATE INDEX IF NOT EXISTS idx_mod_options_ext ON public.sale_modifier_options(external_code) WHERE external_code IS NOT NULL;

-- 4. Junction Tables for Modifiers
CREATE TABLE IF NOT EXISTS public.sale_item_modifier_groups (
    sale_item_id    UUID REFERENCES sale_items(id) ON DELETE CASCADE NOT NULL,
    group_id        UUID REFERENCES sale_modifier_groups(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (sale_item_id, group_id)
);

CREATE TABLE IF NOT EXISTS public.sale_variant_modifier_groups (
    variant_id      UUID REFERENCES sale_item_variants(id) ON DELETE CASCADE NOT NULL,
    group_id        UUID REFERENCES sale_modifier_groups(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (variant_id, group_id)
);

-- 5. RLS Policies
ALTER TABLE public.sale_item_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_item_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_variant_modifier_groups ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'sale_item_components', 'sale_modifier_groups', 'sale_modifier_options',
        'sale_item_modifier_groups', 'sale_variant_modifier_groups'
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
