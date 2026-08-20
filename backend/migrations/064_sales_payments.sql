-- backend/migrations/064_sales_payments.sql

-- 1. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id          UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    
    payment_method_id   UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    method_name         TEXT NOT NULL,
    method_type         TEXT NOT NULL,
    
    amount              NUMERIC(18,2) NOT NULL,
    currency_code       TEXT NOT NULL,
    
    exchange_rate       NUMERIC(18,6) DEFAULT 1,
    amount_in_invoice_currency NUMERIC(18,2) NOT NULL,
    
    surcharges_applied  JSONB DEFAULT '[]'::jsonb,
    total_surcharges    NUMERIC(18,2) DEFAULT 0,
    
    reference           TEXT,
    
    cash_tendered       NUMERIC(18,2),
    cash_change         NUMERIC(18,2),
    
    status              TEXT CHECK (status IN (
        'completed', 'pending', 'failed', 'refunded'
    )) DEFAULT 'completed',
    
    notes               TEXT,
    recorded_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments(payment_method_id);

-- 2. RLS Setup
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members full access" ON public.payments;
CREATE POLICY "Org members full access" ON public.payments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
