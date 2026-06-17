-- backend/migrations/039_physical_inventory.sql

-- 1. Insert permissions
INSERT INTO permissions (module, action, key, description) VALUES
  ('inventory', 'count', 'inventory.count', 'Realizar conteos físicos de inventario'),
  ('inventory', 'audit_count', 'inventory.audit_count', 'Revisar y procesar conteos de inventario (Kardex)')
ON CONFLICT (key) DO NOTHING;

-- 2. Physical Inventories Header
CREATE TABLE IF NOT EXISTS physical_inventories (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id    UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  document_number TEXT UNIQUE NOT NULL,
  status          TEXT CHECK (status IN ('draft', 'processed')) DEFAULT 'draft',
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  processed_by    UUID REFERENCES profiles(id),
  processed_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Physical Inventories Lines
CREATE TABLE IF NOT EXISTS physical_inventory_lines (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  physical_inventory_id UUID REFERENCES physical_inventories(id) ON DELETE CASCADE,
  item_id               UUID REFERENCES items(id) ON DELETE CASCADE,
  qty_expected_base     NUMERIC(18, 6) NOT NULL,
  qty_counted_base      NUMERIC(18, 6) NOT NULL,
  presentation_id       UUID REFERENCES uom_presentations(id),
  qty_presentation      NUMERIC(18, 6),
  notes                 TEXT,
  UNIQUE (physical_inventory_id, item_id)
);

-- 4. Enable RLS and default policies
ALTER TABLE public.physical_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_inventory_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.physical_inventories;
CREATE POLICY "Authenticated users can do everything" ON public.physical_inventories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.physical_inventory_lines;
CREATE POLICY "Authenticated users can do everything" ON public.physical_inventory_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_physical_inventories_org ON physical_inventories(org_id);
CREATE INDEX IF NOT EXISTS idx_physical_inventories_wh ON physical_inventories(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_physical_inventory_lines_header ON physical_inventory_lines(physical_inventory_id);
