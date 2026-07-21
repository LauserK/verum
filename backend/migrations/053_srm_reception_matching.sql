-- 1. Modificar tablas de inventario existentes para soportar el vínculo con PO
ALTER TABLE public.inventory_documents 
  ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_document_lines
  ADD COLUMN IF NOT EXISTS po_qty_ordered_base NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS po_line_id UUID REFERENCES public.purchase_order_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discrepancy_base NUMERIC(18, 6);

-- 2. Agregar la tolerancia de matching en la configuración de PO
ALTER TABLE public.po_approval_config
  ADD COLUMN IF NOT EXISTS matching_tolerance_pct NUMERIC(5, 2) DEFAULT 2.0 NOT NULL;

-- 3. Crear tabla de facturas de proveedores
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  supplier_id     UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT NOT NULL,
  po_id           UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  receipt_id      UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  invoice_number  TEXT NOT NULL,
  invoice_date    DATE NOT NULL,
  due_date        DATE,
  currency        TEXT DEFAULT 'USD' NOT NULL,
  subtotal        NUMERIC(18,2) NOT NULL,
  tax_amount      NUMERIC(18,2) DEFAULT 0 NOT NULL,
  total           NUMERIC(18,2) NOT NULL,
  matching_status TEXT CHECK (matching_status IN ('pending', 'matched', 'partial_match', 'mismatch')) DEFAULT 'pending' NOT NULL,
  matching_notes  TEXT,
  payment_status  TEXT CHECK (payment_status IN ('unpaid', 'exported', 'paid')) DEFAULT 'unpaid' NOT NULL,
  exported_at     TIMESTAMP WITH TIME ZONE,
  pdf_url         TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (org_id, supplier_id, invoice_number)
);

-- 4. Crear tabla de líneas de facturas de proveedores
CREATE TABLE IF NOT EXISTS public.supplier_invoice_lines (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id            UUID REFERENCES public.supplier_invoices(id) ON DELETE CASCADE NOT NULL,
  po_line_id            UUID REFERENCES public.purchase_order_lines(id) ON DELETE SET NULL,
  item_id               UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
  qty_invoiced_base     NUMERIC(18,6) NOT NULL CHECK (qty_invoiced_base >= 0),
  unit_cost_base        NUMERIC(18,6) NOT NULL CHECK (unit_cost_base >= 0),
  line_total            NUMERIC(18,2) NOT NULL,
  diff_vs_po_base       NUMERIC(18,6),
  diff_vs_receipt_base  NUMERIC(18,6)
);

-- 5. Habilitar RLS
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas permisivas por defecto para usuarios autenticados
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_invoices;
CREATE POLICY "Authenticated users can do everything" ON public.supplier_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_invoice_lines;
CREATE POLICY "Authenticated users can do everything" ON public.supplier_invoice_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Crear índices
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON public.supplier_invoices(supplier_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON public.supplier_invoices(due_date) WHERE payment_status != 'paid';
CREATE INDEX IF NOT EXISTS idx_invoices_po ON public.supplier_invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON public.supplier_invoice_lines(invoice_id);

-- 8. Insertar permisos
INSERT INTO public.permissions (module, action, key, description) VALUES
  ('purchasing', 'invoice', 'purchasing.invoice', 'Registrar facturas de proveedores'),
  ('purchasing', 'pay', 'purchasing.pay', 'Programar pagos y marcar facturas como pagadas')
ON CONFLICT (key) DO NOTHING;
