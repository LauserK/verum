-- ====================================================================
-- Migration: 066_currencies_and_exchange_rates.sql
-- Description: Multi-currency support and exchange rate tracking for Verum
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.currencies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    is_base         BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_currencies_org ON public.currencies(org_id);

CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    from_currency   TEXT NOT NULL,
    to_currency     TEXT NOT NULL,
    rate            NUMERIC(18,6) NOT NULL CHECK (rate > 0),
    effective_date  TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup ON public.exchange_rates(org_id, from_currency, to_currency, effective_date DESC);

-- Enable RLS
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can access currencies"
    ON public.currencies
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY "Org members can access exchange_rates"
    ON public.exchange_rates
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
