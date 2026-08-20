-- backend/migrations/063_sales_billing.sql

-- 1. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    venue_id            UUID REFERENCES venues(id) ON DELETE SET NULL,
    workstation_id      UUID REFERENCES workstations(id) ON DELETE SET NULL,
    
    document_type       TEXT CHECK (document_type IN (
        'invoice', 'credit_note', 'debit_note', 'proforma', 'delivery_note'
    )) DEFAULT 'invoice' NOT NULL,
    document_number     TEXT NOT NULL,
    fiscal_number       TEXT,
    numbering_source    TEXT CHECK (numbering_source IN (
        'verum_sequence', 'fiscal_printer', 'external'
    )) DEFAULT 'verum_sequence',
    
    customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name       TEXT NOT NULL,
    customer_tax_id     TEXT,
    customer_address    TEXT,
    
    date                DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date            DATE,
    
    status              TEXT CHECK (status IN (
        'draft', 'confirmed', 'partial', 'paid', 'void'
    )) DEFAULT 'draft' NOT NULL,
    
    currency_code       TEXT NOT NULL,
    exchange_rate       NUMERIC(18,6) DEFAULT 1,
    
    subtotal            NUMERIC(18,2) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(18,2) DEFAULT 0,
    
    total_taxable       NUMERIC(18,2) DEFAULT 0,
    total_exempt        NUMERIC(18,2) DEFAULT 0,
    total_tax           NUMERIC(18,2) DEFAULT 0,
    total_surcharges    NUMERIC(18,2) DEFAULT 0,
    total               NUMERIC(18,2) NOT NULL DEFAULT 0,
    
    amount_paid         NUMERIC(18,2) DEFAULT 0,
    balance_due         NUMERIC(18,2) DEFAULT 0,
    
    related_invoice_id  UUID REFERENCES invoices(id) ON DELETE SET NULL,
    pos_session_id      UUID, -- POS session relationship
    
    notes               TEXT,
    internal_notes      TEXT,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    voided_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
    voided_at           TIMESTAMP WITH TIME ZONE,
    void_reason         TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (org_id, document_type, document_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON public.invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(org_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_workstation ON public.invoices(workstation_id);

-- 2. Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id          UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    sale_item_id        UUID REFERENCES sale_items(id) ON DELETE SET NULL,
    variant_id          UUID REFERENCES sale_item_variants(id) ON DELETE SET NULL,
    description         TEXT NOT NULL,
    product_code        TEXT,
    quantity            NUMERIC(12,3) NOT NULL,
    unit_price          NUMERIC(18,6) NOT NULL,
    discount_pct        NUMERIC(5,2) DEFAULT 0,
    discount_amount     NUMERIC(18,2) DEFAULT 0,
    tax_id              UUID REFERENCES taxes(id) ON DELETE SET NULL,
    tax_name            TEXT,
    tax_rate            NUMERIC(5,4) DEFAULT 0,
    is_exempt           BOOLEAN DEFAULT FALSE,
    subtotal            NUMERIC(18,2) NOT NULL,
    tax_amount          NUMERIC(18,2) DEFAULT 0,
    total               NUMERIC(18,2) NOT NULL,
    unit_food_cost      NUMERIC(18,6) DEFAULT 0,
    modifiers           JSONB DEFAULT '[]'::jsonb,
    position            INTEGER DEFAULT 0,
    notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- 3. Invoice Tax Summary Table
CREATE TABLE IF NOT EXISTS public.invoice_tax_summary (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id      UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    tax_id          UUID REFERENCES taxes(id) ON DELETE SET NULL,
    tax_name        TEXT NOT NULL,
    tax_rate        NUMERIC(5,4) NOT NULL,
    taxable_base    NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
    UNIQUE (invoice_id, tax_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_tax_summary ON public.invoice_tax_summary(invoice_id);

-- 4. RLS Setup
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_tax_summary ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY['invoices', 'invoice_items', 'invoice_tax_summary'];
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Org members full access" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Org members full access" ON public.%I '
            'FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
        );
    END LOOP;
END $$;
