-- backend/migrations/062_sales_customers_and_sequences.sql

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name                TEXT NOT NULL,
    tax_id              TEXT,
    customer_type       TEXT CHECK (customer_type IN (
        'individual', 'business', 'government', 'foreign'
    )) DEFAULT 'individual',
    email               TEXT,
    phone               TEXT,
    address             TEXT,
    credit_limit        NUMERIC(18,2) DEFAULT 0,
    credit_days         INTEGER DEFAULT 0,
    current_balance     NUMERIC(18,2) DEFAULT 0,
    is_tax_exempt       BOOLEAN DEFAULT FALSE,
    is_withholding_agent BOOLEAN DEFAULT FALSE,
    withholding_rate    NUMERIC(5,4) DEFAULT 0,
    is_active           BOOLEAN DEFAULT TRUE,
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_tax ON public.customers(org_id, tax_id) WHERE tax_id IS NOT NULL;

-- 2. Document Sequences Table
CREATE TABLE IF NOT EXISTS public.document_sequences (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    document_type   TEXT NOT NULL,
    prefix          TEXT DEFAULT '',
    next_number     INTEGER NOT NULL DEFAULT 1,
    padding         INTEGER DEFAULT 8,
    UNIQUE (org_id, document_type)
);

-- 3. PL/pgSQL Function: get_next_doc_number
CREATE OR REPLACE FUNCTION get_next_doc_number(p_org_id UUID, p_type TEXT)
RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_number INTEGER;
    v_padding INTEGER;
BEGIN
    UPDATE public.document_sequences
    SET next_number = next_number + 1
    WHERE org_id = p_org_id AND document_type = p_type
    RETURNING prefix, next_number - 1, padding
    INTO v_prefix, v_number, v_padding;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sequence not found for org=% type=%', p_org_id, p_type;
    END IF;
    
    RETURN v_prefix || lpad(v_number::text, v_padding, '0');
END;
$$ LANGUAGE plpgsql;

-- 4. RLS Setup
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY['customers', 'document_sequences'];
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Org members full access" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Org members full access" ON public.%I '
            'FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
        );
    END LOOP;
END $$;
