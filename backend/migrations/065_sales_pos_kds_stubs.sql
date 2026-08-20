-- backend/migrations/065_sales_pos_kds_stubs.sql

-- 1. POS Sessions Table
CREATE TABLE IF NOT EXISTS public.pos_sessions (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    venue_id            UUID REFERENCES venues(id) ON DELETE SET NULL,
    workstation_id      UUID REFERENCES workstations(id) ON DELETE SET NULL,
    cashier_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status              TEXT CHECK (status IN ('open', 'closing', 'closed')) DEFAULT 'open',
    opening_balance     NUMERIC(18,2) NOT NULL DEFAULT 0,
    opening_currency    TEXT NOT NULL,
    closing_balance     NUMERIC(18,2),
    expected_balance    NUMERIC(18,2),
    difference          NUMERIC(18,2),
    notes               TEXT,
    opened_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at           TIMESTAMP WITH TIME ZONE
);

-- 2. Link Invoices to POS Sessions
ALTER TABLE public.invoices ADD CONSTRAINT fk_invoices_pos_session
    FOREIGN KEY (pos_session_id) REFERENCES pos_sessions(id) ON DELETE SET NULL;

-- 3. Cash Movements Table
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id      UUID REFERENCES pos_sessions(id) ON DELETE CASCADE NOT NULL,
    movement_type   TEXT CHECK (movement_type IN ('in', 'out')) NOT NULL,
    amount          NUMERIC(18,2) NOT NULL,
    currency_code   TEXT NOT NULL,
    reason          TEXT NOT NULL,
    reference       TEXT,
    created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Session Payment Summary Table
CREATE TABLE IF NOT EXISTS public.session_payment_summary (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id      UUID REFERENCES pos_sessions(id) ON DELETE CASCADE NOT NULL,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    method_name     TEXT NOT NULL,
    currency_code   TEXT NOT NULL,
    total_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    total_surcharges NUMERIC(18,2) DEFAULT 0,
    expected_cash   NUMERIC(18,2),
    actual_cash     NUMERIC(18,2),
    cash_difference NUMERIC(18,2),
    UNIQUE (session_id, payment_method_id, currency_code)
);

-- 5. Service KDS Tickets Table
CREATE TABLE IF NOT EXISTS public.service_kds_tickets (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    venue_id        UUID REFERENCES venues(id) ON DELETE SET NULL,
    invoice_id      UUID REFERENCES invoices(id) ON DELETE CASCADE,
    ticket_number   TEXT NOT NULL,
    channel         TEXT CHECK (channel IN (
        'dine_in', 'takeout', 'delivery'
    )) DEFAULT 'dine_in',
    table_ref       TEXT,
    status          TEXT CHECK (status IN (
        'new', 'preparing', 'ready', 'delivered', 'cancelled'
    )) DEFAULT 'new',
    priority        TEXT CHECK (priority IN (
        'normal', 'rush', 'vip'
    )) DEFAULT 'normal',
    items_snapshot   JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at      TIMESTAMP WITH TIME ZONE,
    completed_at    TIMESTAMP WITH TIME ZONE,
    delivered_at    TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_venue ON public.service_kds_tickets(venue_id, status);

-- 6. Alter Existing Table: catering_request_lines
ALTER TABLE public.catering_request_lines
    ADD COLUMN IF NOT EXISTS sale_item_id UUID REFERENCES sale_items(id) ON DELETE SET NULL;
ALTER TABLE public.catering_request_lines
    ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES sale_item_variants(id) ON DELETE SET NULL;

-- 7. RLS Setup
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_payment_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_kds_tickets ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'pos_sessions', 'cash_movements', 'session_payment_summary', 'service_kds_tickets'
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
