-- backend/migrations/071_pos_checkout_config.sql
-- POS Checkout Config: customer_requirement cascade, warehouse per workstation, stock control

-- 1. Tenant-level customer requirement
ALTER TABLE public.tenant_billing_config
  ADD COLUMN IF NOT EXISTS customer_requirement TEXT NOT NULL DEFAULT 'optional'
  CHECK (customer_requirement IN ('required', 'optional', 'disabled'));

-- 2. Sale Mode Config table (per-mode overrides)
CREATE TABLE IF NOT EXISTS public.sale_mode_config (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mode                 TEXT NOT NULL CHECK (mode IN ('tables', 'takeout', 'delivery', 'pickup', 'bar')),
  customer_requirement TEXT CHECK (customer_requirement IN ('required', 'optional', 'disabled')),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, mode)
);

ALTER TABLE public.sale_mode_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Org members full access" ON public.sale_mode_config;
    CREATE POLICY "Org members full access" ON public.sale_mode_config
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- 3. Workstation: add customer_requirement override + warehouse link
ALTER TABLE public.workstations
  ADD COLUMN IF NOT EXISTS customer_requirement TEXT
    CHECK (customer_requirement IN ('required', 'optional', 'disabled')),
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- Backfill: assign default warehouse per venue to existing workstations
UPDATE public.workstations w
  SET warehouse_id = (
    SELECT id FROM warehouses
    WHERE venue_id = w.venue_id
    ORDER BY created_at ASC LIMIT 1
  )
  WHERE w.warehouse_id IS NULL
    AND w.venue_id IS NOT NULL;

-- 4. Sale items: allow selling without stock
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT false;

-- 5. Payments: add change_currency and change_method for cash register reconciliation
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS change_currency TEXT,
  ADD COLUMN IF NOT EXISTS change_method TEXT;

-- 6. Helper RPC: get_stock_balance for item in warehouse
CREATE OR REPLACE FUNCTION public.get_stock_balance(p_warehouse_id UUID, p_item_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_qty NUMERIC;
BEGIN
  -- Sum from unexhausted lots if available
  SELECT COALESCE(SUM(qty_base), 0)
  INTO v_qty
  FROM public.stock_lots
  WHERE warehouse_id = p_warehouse_id
    AND item_id = p_item_id
    AND is_exhausted = false;

  -- Fallback to stock_movements if no lots found
  IF v_qty = 0 THEN
    SELECT COALESCE(SUM(qty_base), 0)
    INTO v_qty
    FROM public.stock_movements
    WHERE warehouse_id = p_warehouse_id
      AND item_id = p_item_id;
  END IF;

  RETURN COALESCE(v_qty, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Helper RPC: increment_customer_balance for CXC sales
CREATE OR REPLACE FUNCTION public.increment_customer_balance(p_customer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.customers
  SET outstanding_balance = COALESCE(outstanding_balance, 0) + p_amount
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

