-- backend/migrations/058_sales_config.sql

-- 1. Tenant Billing Config
CREATE TABLE IF NOT EXISTS public.tenant_billing_config (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
    default_tax_id  UUID REFERENCES taxes(id) ON DELETE SET NULL,
    surcharges      JSONB DEFAULT '[]'::jsonb,
    withholding_enabled BOOLEAN DEFAULT FALSE,
    rounding_mode   TEXT CHECK (rounding_mode IN ('none', 'round_half_up', 'round_up', 'round_down')) DEFAULT 'round_half_up',
    rounding_precision INTEGER DEFAULT 2,
    invoice_footer  TEXT,
    invoice_notes   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Payment Methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name            TEXT NOT NULL,
    method_type     TEXT CHECK (method_type IN (
        'cash', 'card', 'bank_transfer', 'mobile_payment',
        'digital_wallet', 'crypto', 'other'
    )) NOT NULL,
    currency_code   TEXT,
    instructions    TEXT DEFAULT '',
    is_active       BOOLEAN DEFAULT TRUE,
    requires_reference BOOLEAN DEFAULT TRUE,
    position        INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON public.payment_methods(org_id, is_active);

-- 3. Workstations
CREATE TABLE IF NOT EXISTS public.workstations (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    venue_id        UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    name            TEXT NOT NULL,
    printer_type    TEXT CHECK (printer_type IN ('none', 'thermal', 'fiscal')) DEFAULT 'none',
    printer_config  JSONB DEFAULT '{}'::jsonb,
    numbering_source TEXT CHECK (numbering_source IN ('verum_sequence', 'fiscal_printer', 'external')) DEFAULT 'verum_sequence',
    -- sequence_override_id UUID REFERENCES document_sequences(id) ON DELETE SET NULL, -- Deferred to M2
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (org_id, venue_id, name)
);
CREATE INDEX IF NOT EXISTS idx_workstations_venue ON public.workstations(venue_id, is_active);

-- 4. RLS Policies
ALTER TABLE public.tenant_billing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'tenant_billing_config', 'payment_methods', 'workstations'
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
