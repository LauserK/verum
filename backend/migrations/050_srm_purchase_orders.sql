-- backend/migrations/050_srm_purchase_orders.sql

-- 1. Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id              UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  po_number           TEXT NOT NULL, -- Format: PO-YYYY-NNNN, unique per org
  supplier_id         UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT NOT NULL,
  price_list_id       UUID REFERENCES public.supplier_price_lists(id) ON DELETE SET NULL,
  origin_type         TEXT CHECK (origin_type IN ('manual', 'mrp', 'reorder')) DEFAULT 'manual' NOT NULL,
  catering_request_id UUID REFERENCES public.catering_requests(id) ON DELETE SET NULL,
  requested_date      DATE,
  promised_date       DATE,
  currency            TEXT DEFAULT 'USD' NOT NULL,
  subtotal            NUMERIC(18,2) NOT NULL,
  tax_amount          NUMERIC(18,2) DEFAULT 0 NOT NULL,
  total               NUMERIC(18,2) NOT NULL,
  payment_terms_days  INTEGER DEFAULT 0 NOT NULL,
  status              TEXT CHECK (status IN (
    'draft', 'pending', 'approved', 'sent',
    'partially_received', 'received', 'invoiced', 'closed', 'cancelled'
  )) DEFAULT 'draft' NOT NULL,
  sent_at             TIMESTAMP WITH TIME ZONE,
  sent_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_to_email       TEXT,
  warehouse_id        UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
  notes               TEXT,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (org_id, po_number)
);

-- 2. Create purchase_order_lines table
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  po_id                   UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  item_id                 UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
  qty_ordered_base        NUMERIC(18,6) NOT NULL CHECK (qty_ordered_base > 0),
  presentation_id         UUID REFERENCES public.uom_presentations(id) ON DELETE SET NULL,
  qty_ordered_presentation NUMERIC(18,6),
  qty_received_base       NUMERIC(18,6) DEFAULT 0 NOT NULL CHECK (qty_received_base >= 0),
  qty_pending_base        NUMERIC(18,6) NOT NULL CHECK (qty_pending_base >= 0),
  unit_cost_base          NUMERIC(18,6) NOT NULL CHECK (unit_cost_base >= 0),
  unit_cost_presentation  NUMERIC(18,6),
  line_total              NUMERIC(18,2) NOT NULL,
  status                  TEXT CHECK (status IN ('pending', 'partially_received', 'received', 'cancelled')) DEFAULT 'pending' NOT NULL
);

-- 3. Create po_approvals table
CREATE TABLE IF NOT EXISTS public.po_approvals (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  po_id       UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  action      TEXT CHECK (action IN ('approved', 'rejected', 'requested_changes')) NOT NULL,
  approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_approvals ENABLE ROW LEVEL SECURITY;

-- 5. Create default permissive policies for authenticated users
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.purchase_orders;
CREATE POLICY "Authenticated users can do everything" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.purchase_order_lines;
CREATE POLICY "Authenticated users can do everything" ON public.purchase_order_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.po_approvals;
CREATE POLICY "Authenticated users can do everything" ON public.po_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_po_status_date ON public.purchase_orders(status, requested_date);
CREATE INDEX IF NOT EXISTS idx_po_lines_po ON public.purchase_order_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_item ON public.purchase_order_lines(item_id);
