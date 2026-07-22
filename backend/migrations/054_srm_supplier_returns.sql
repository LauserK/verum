-- backend/migrations/054_srm_supplier_returns.sql

-- 1. Modificar el CHECK constraint de movement_type en stock_movements para incluir 'return_out'
ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type IN (
    'purchase', 'production_in', 'production_out', 'sale', 
    'transfer_out', 'transfer_in', 'adjustment_in', 'adjustment_out', 
    'initial', 'return_out'
  ));

-- 2. Crear tabla de devoluciones a proveedores
CREATE TABLE IF NOT EXISTS public.supplier_returns (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  return_number   TEXT NOT NULL,          -- DEV-0001, generado automáticamente
  receipt_id      UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  supplier_id     UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  po_id           UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  reason          TEXT CHECK (reason IN (
    'damaged', 'wrong_item', 'excess_qty', 'quality', 'expired'
  )) NOT NULL,
  status          TEXT CHECK (status IN (
    'pending', 'sent', 'credit_note_received', 'closed'
  )) DEFAULT 'pending' NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (org_id, return_number)
);

-- 3. Crear tabla de líneas de devolución
CREATE TABLE IF NOT EXISTS public.supplier_return_lines (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  return_id       UUID REFERENCES public.supplier_returns(id) ON DELETE CASCADE NOT NULL,
  item_id         UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  lot_id          UUID REFERENCES public.stock_lots(id) ON DELETE SET NULL,
  qty_base        NUMERIC(18,6) NOT NULL CHECK (qty_base > 0),
  unit_cost_base  NUMERIC(18,6),
  line_total      NUMERIC(18,2),
  reason          TEXT CHECK (reason IN (
    'damaged', 'wrong_item', 'excess_qty', 'quality', 'expired'
  ))
);

-- 4. Crear tabla de notas de crédito del proveedor
CREATE TABLE IF NOT EXISTS public.supplier_credit_notes (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  return_id             UUID REFERENCES public.supplier_returns(id) ON DELETE CASCADE NOT NULL,
  supplier_id           UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  credit_note_number    TEXT,
  amount                NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  issue_date            DATE,
  applied_to_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  status                TEXT CHECK (status IN ('pending', 'applied', 'refunded'))
                        DEFAULT 'pending' NOT NULL,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. Habilitar RLS
ALTER TABLE public.supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_credit_notes ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas permisivas para usuarios autenticados
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_returns;
CREATE POLICY "Authenticated users can do everything"
  ON public.supplier_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_return_lines;
CREATE POLICY "Authenticated users can do everything"
  ON public.supplier_return_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_credit_notes;
CREATE POLICY "Authenticated users can do everything"
  ON public.supplier_credit_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Crear índices
CREATE INDEX IF NOT EXISTS idx_returns_supplier ON public.supplier_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_returns_receipt  ON public.supplier_returns(receipt_id);
CREATE INDEX IF NOT EXISTS idx_returns_po       ON public.supplier_returns(po_id);
CREATE INDEX IF NOT EXISTS idx_return_lines     ON public.supplier_return_lines(return_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_return ON public.supplier_credit_notes(return_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON public.supplier_credit_notes(applied_to_invoice_id);

-- 8. Insertar permisos
INSERT INTO public.permissions (module, action, key, description) VALUES
  ('purchasing', 'return', 'purchasing.return', 'Crear devoluciones a proveedores')
ON CONFLICT (key) DO NOTHING;
