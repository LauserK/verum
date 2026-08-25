-- backend/migrations/072_pos_table_orders.sql

CREATE TABLE IF NOT EXISTS public.pos_table_orders (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    venue_id        UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    mode            TEXT CHECK (mode IN ('tables', 'takeout', 'delivery', 'pickup', 'bar')) DEFAULT 'tables',
    table_id        TEXT,
    table_name      TEXT,
    tab_name        TEXT,
    customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name   TEXT,
    customer_tax_id TEXT,
    cart            JSONB NOT NULL DEFAULT '[]'::JSONB,
    total           NUMERIC(18,2) NOT NULL DEFAULT 0,
    order_number    INT,
    workstation_id  UUID REFERENCES workstations(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status          TEXT CHECK (status IN ('active', 'billed', 'cancelled')) DEFAULT 'active',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_table_orders_venue_status ON public.pos_table_orders(venue_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_table_orders_mode_status ON public.pos_table_orders(org_id, mode, status);
CREATE INDEX IF NOT EXISTS idx_pos_table_orders_table_status ON public.pos_table_orders(org_id, table_id, status);

ALTER TABLE public.pos_table_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members full access" ON public.pos_table_orders;
CREATE POLICY "Org members full access" ON public.pos_table_orders
    FOR ALL TO authenticated USING (true) WITH CHECK (true);


