-- backend/migrations/068_integration_events.sql

CREATE TABLE IF NOT EXISTS public.integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_integration_events_status ON public.integration_events (status);
CREATE INDEX IF NOT EXISTS idx_integration_events_org_id ON public.integration_events (org_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can access integration_events"
    ON public.integration_events
    FOR ALL
    USING (true)
    WITH CHECK (true);

