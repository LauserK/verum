-- backend/migrations/073_pos_seats_split_bill.sql
-- POS M4: Seats, Split Bill, and Table Transfers

-- 1. Extend pos_table_orders
ALTER TABLE public.pos_table_orders
  ADD COLUMN IF NOT EXISTS seats JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pre_bill_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS merged_from UUID[],
  ADD COLUMN IF NOT EXISTS payment_pending BOOLEAN DEFAULT false;

-- Drop and recreate status check constraint to include 'pre_bill'
ALTER TABLE public.pos_table_orders DROP CONSTRAINT IF EXISTS pos_table_orders_status_check;
ALTER TABLE public.pos_table_orders ADD CONSTRAINT pos_table_orders_status_check
  CHECK (status IN ('active', 'pre_bill', 'billed', 'cancelled'));

-- 2. Extend payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS seat_label TEXT,
  ADD COLUMN IF NOT EXISTS covered_items UUID[];

-- 3. Extend invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS table_order_id UUID REFERENCES pos_table_orders(id) ON DELETE SET NULL;

-- 4. Transfer Log Table
CREATE TABLE IF NOT EXISTS public.pos_transfer_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_table_id TEXT NOT NULL,
  target_table_id TEXT NOT NULL,
  transfer_type TEXT CHECK (transfer_type IN ('full', 'items', 'seat', 'merge')),
  items_transferred JSONB,
  performed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pos_transfer_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Org members full access" ON public.pos_transfer_log;
    CREATE POLICY "Org members full access" ON public.pos_transfer_log
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;
