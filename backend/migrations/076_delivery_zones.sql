-- backend/migrations/076_delivery_zones.sql

-- 1. Delivery Zones Table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name        TEXT NOT NULL,
    cost        NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_org ON public.delivery_zones(org_id, is_active);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.delivery_zones;
DROP POLICY IF EXISTS "Users access own org delivery_zones" ON public.delivery_zones;
CREATE POLICY "Users access own org delivery_zones"
    ON public.delivery_zones FOR ALL TO authenticated
    USING (
        org_id IN (SELECT get_my_org_ids())
    )
    WITH CHECK (
        org_id IN (SELECT get_my_org_ids())
    );

-- 3. Add delivery fields to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS delivery_zone_name TEXT,
ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(18,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- 4. Add delivery fields to pos_table_orders if exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_table_orders') THEN
        ALTER TABLE public.pos_table_orders 
        ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(18,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS delivery_address TEXT;
    END IF;
END $$;
