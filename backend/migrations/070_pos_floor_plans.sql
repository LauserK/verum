-- backend/migrations/070_pos_floor_plans.sql

-- 1. Floor Plans Table
CREATE TABLE IF NOT EXISTS public.floor_plans (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    venue_id    UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    name        TEXT NOT NULL,
    width       INT NOT NULL DEFAULT 800,
    height      INT NOT NULL DEFAULT 600,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_floor_plans_venue ON public.floor_plans(venue_id);

-- 2. Tables Table
CREATE TABLE IF NOT EXISTS public.tables (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    floor_plan_id   UUID REFERENCES floor_plans(id) ON DELETE CASCADE NOT NULL,
    name            TEXT NOT NULL,
    shape           TEXT CHECK (shape IN ('rectangle', 'circle')) DEFAULT 'rectangle',
    x               INT NOT NULL DEFAULT 0,
    y               INT NOT NULL DEFAULT 0,
    width           INT NOT NULL DEFAULT 60,
    height          INT NOT NULL DEFAULT 60,
    capacity        INT NOT NULL DEFAULT 2,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tables_floor_plan ON public.tables(floor_plan_id, is_active);

-- 3. Alter Workstations Table
ALTER TABLE public.workstations
    ADD COLUMN IF NOT EXISTS allowed_modes TEXT[] DEFAULT ARRAY['dine_in', 'takeout', 'delivery', 'pickup', 'bar']::TEXT[];

-- 4. RLS Setup
ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'floor_plans', 'tables'
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
