-- backend/migrations/044_unified_inventory_documents.sql

-- 1. Create Enums if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_document_type') THEN
    CREATE TYPE public.inventory_document_type AS ENUM ('receipt', 'issue', 'transfer');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_document_status') THEN
    CREATE TYPE public.inventory_document_status AS ENUM ('draft', 'in_transit', 'confirmed', 'cancelled');
  END IF;
END $$;

-- 2. Create Header Table
CREATE TABLE IF NOT EXISTS public.inventory_documents (
  id                        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id                    UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  document_type             public.inventory_document_type NOT NULL,
  document_number           TEXT NOT NULL,
  status                    public.inventory_document_status DEFAULT 'draft' NOT NULL,
  
  -- Warehouses
  warehouse_id              UUID REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
  destination_warehouse_id  UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  
  -- Type-specific metadata
  supplier                  TEXT,
  reason                    TEXT,
  
  notes                     TEXT,
  created_by                UUID REFERENCES public.profiles(id) NOT NULL,
  processed_by              UUID REFERENCES public.profiles(id),
  processed_at              TIMESTAMP WITH TIME ZONE,
  cancelled_by              UUID REFERENCES public.profiles(id),
  cancelled_at              TIMESTAMP WITH TIME ZONE,
  created_at                TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_org_document_number UNIQUE (org_id, document_number)
);

-- 3. Create Lines Table
CREATE TABLE IF NOT EXISTS public.inventory_document_lines (
  id                        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id               UUID REFERENCES public.inventory_documents(id) ON DELETE CASCADE NOT NULL,
  item_id                   UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  
  -- Presentation
  qty_presentation          NUMERIC(18, 6) NOT NULL,
  presentation_id           UUID REFERENCES public.uom_presentations(id),
  qty_base                  NUMERIC(18, 6) NOT NULL,
  
  -- Purchase metadata (for 'receipt')
  unit_cost_presentation    NUMERIC(18, 6),
  unit_cost_base            NUMERIC(18, 6),
  lot_number                TEXT,
  expiry_date               DATE,
  
  -- Transfer metadata (for 'transfer' reception)
  qty_received_presentation NUMERIC(18, 6),
  qty_received_base         NUMERIC(18, 6)
);

-- 4. Create Document Sequences Table
CREATE TABLE IF NOT EXISTS public.inventory_document_sequences (
  org_id        UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  document_type public.inventory_document_type NOT NULL,
  last_value    INTEGER DEFAULT 0 NOT NULL,
  PRIMARY KEY (org_id, document_type)
);

-- 5. Enable RLS and create default policies
ALTER TABLE public.inventory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.inventory_documents;
CREATE POLICY "Authenticated users can do everything" ON public.inventory_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.inventory_document_lines;
CREATE POLICY "Authenticated users can do everything" ON public.inventory_document_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.inventory_document_sequences;
CREATE POLICY "Authenticated users can do everything" ON public.inventory_document_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Insert default permissions if missing
INSERT INTO permissions (module, action, key, description) VALUES
  ('inventory', 'receive', 'inventory.receive', 'Registrar ingresos de mercaderías'),
  ('inventory', 'issue', 'inventory.issue', 'Registrar egresos y mermas'),
  ('inventory', 'transfer', 'inventory.transfer', 'Crear traslados entre almacenes'),
  ('inventory', 'transfer_confirm', 'inventory.transfer_confirm', 'Confirmar recepción de traslados')
ON CONFLICT (key) DO NOTHING;

-- 7. Execute Data Migration
DO $$
BEGIN
  -- Migrate cabeceras de compras
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_receipts') THEN
    INSERT INTO public.inventory_documents (id, org_id, document_type, document_number, status, warehouse_id, supplier, notes, created_by, processed_by, processed_at, created_at)
    SELECT 
      id, 
      org_id, 
      'receipt'::public.inventory_document_type,
      'ING-' || LPAD(row_number() OVER (PARTITION BY org_id ORDER BY created_at)::text, 4, '0'),
      'confirmed'::public.inventory_document_status,
      warehouse_id,
      supplier,
      receipt_number,
      created_by,
      created_by,
      confirmed_at,
      created_at
    FROM public.purchase_receipts;
    
    INSERT INTO public.inventory_document_lines (document_id, item_id, qty_presentation, presentation_id, qty_base, unit_cost_presentation, unit_cost_base, lot_number, expiry_date)
    SELECT 
      receipt_id, 
      item_id, 
      qty_presentation, 
      presentation_id, 
      qty_base, 
      unit_cost_base,
      unit_cost_base, 
      lot_number, 
      expiry_date
    FROM public.purchase_receipt_lines;
  END IF;
  
  -- Migrate cabeceras de egresos
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'issue_documents') THEN
    INSERT INTO public.inventory_documents (id, org_id, document_type, document_number, status, warehouse_id, reason, notes, created_by, processed_by, processed_at, created_at)
    SELECT 
      id, 
      org_id, 
      'issue'::public.inventory_document_type,
      'EGR-' || LPAD(row_number() OVER (PARTITION BY org_id ORDER BY created_at)::text, 4, '0'),
      'confirmed'::public.inventory_document_status,
      warehouse_id,
      reason,
      notes,
      created_by,
      created_by,
      created_at,
      created_at
    FROM public.issue_documents;
    
    INSERT INTO public.inventory_document_lines (document_id, item_id, qty_presentation, presentation_id, qty_base)
    SELECT 
      issue_id, 
      item_id, 
      qty_presentation, 
      presentation_id, 
      qty_base
    FROM public.issue_document_lines;
  END IF;
  
  -- Migrate cabeceras de traslados
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transfer_documents') THEN
    INSERT INTO public.inventory_documents (id, org_id, document_type, document_number, status, warehouse_id, destination_warehouse_id, notes, created_by, processed_by, processed_at, created_at)
    SELECT 
      id, 
      org_id, 
      'transfer'::public.inventory_document_type,
      'TRA-' || LPAD(row_number() OVER (PARTITION BY org_id ORDER BY created_at)::text, 4, '0'),
      CASE 
        WHEN status = 'in_transit' THEN 'in_transit'::public.inventory_document_status
        ELSE 'confirmed'::public.inventory_document_status
      END,
      origin_warehouse_id,
      destination_warehouse_id,
      notes,
      created_by,
      confirmed_by,
      confirmed_at,
      created_at
    FROM public.transfer_documents;
    
    INSERT INTO public.inventory_document_lines (document_id, item_id, qty_presentation, presentation_id, qty_base, qty_received_presentation, qty_received_base)
    SELECT 
      transfer_id, 
      item_id, 
      qty_sent_presentation, 
      presentation_id, 
      qty_sent_base,
      qty_received_presentation,
      qty_received_base
    FROM public.transfer_document_lines;
  END IF;
  
  -- Initialize sequences based on migrated records
  INSERT INTO public.inventory_document_sequences (org_id, document_type, last_value)
  SELECT org_id, 'receipt'::public.inventory_document_type, COUNT(*)
  FROM public.inventory_documents
  WHERE document_type = 'receipt'
  GROUP BY org_id
  ON CONFLICT (org_id, document_type) DO UPDATE SET last_value = EXCLUDED.last_value;
  
  INSERT INTO public.inventory_document_sequences (org_id, document_type, last_value)
  SELECT org_id, 'issue'::public.inventory_document_type, COUNT(*)
  FROM public.inventory_documents
  WHERE document_type = 'issue'
  GROUP BY org_id
  ON CONFLICT (org_id, document_type) DO UPDATE SET last_value = EXCLUDED.last_value;
  
  INSERT INTO public.inventory_document_sequences (org_id, document_type, last_value)
  SELECT org_id, 'transfer'::public.inventory_document_type, COUNT(*)
  FROM public.inventory_documents
  WHERE document_type = 'transfer'
  GROUP BY org_id
  ON CONFLICT (org_id, document_type) DO UPDATE SET last_value = EXCLUDED.last_value;
  
  -- Update stock movements reference types
  UPDATE public.stock_movements
  SET reference_type = 'inventory_document'
  WHERE reference_type IN ('purchase_receipt', 'issue_document', 'transfer_document');
  
END $$;

-- 8. Clean up old tables
DROP TABLE IF EXISTS public.purchase_receipt_lines;
DROP TABLE IF EXISTS public.purchase_receipts;
DROP TABLE IF EXISTS public.issue_document_lines;
DROP TABLE IF EXISTS public.issue_documents;
DROP TABLE IF EXISTS public.transfer_document_lines;
DROP TABLE IF EXISTS public.transfer_documents;

-- 9. Create Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_docs_org ON public.inventory_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_docs_wh ON public.inventory_documents(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_doc_lines_header ON public.inventory_document_lines(document_id);
