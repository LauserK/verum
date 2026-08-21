-- Migration 067: VerumQuick Integration Config
-- Adds integrations table and metadata to support external channels like VerumQuick

CREATE TABLE IF NOT EXISTS public.quick_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL,
    secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    workstation_id UUID REFERENCES public.workstations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id)
);

ALTER TABLE public.quick_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can access quick_integrations"
    ON public.quick_integrations
    FOR ALL
    USING (true)
    WITH CHECK (true);
