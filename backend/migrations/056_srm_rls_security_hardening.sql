-- backend/migrations/056_srm_rls_security_hardening.sql

-- Hardening de seguridad para RLS en las tablas del módulo de Compras (SRM)
-- Filtra accesos en base a las organizaciones a las que pertenece el usuario autenticado (SELECT get_my_org_ids())

-- ==========================================
-- 1. Tablas directas con org_id
-- ==========================================

-- 1.1 suppliers
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.suppliers;
DROP POLICY IF EXISTS "Users access own org suppliers" ON public.suppliers;
CREATE POLICY "Users access own org suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (org_id IN (SELECT get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT get_my_org_ids()));

-- 1.2 po_approval_limits
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.po_approval_limits;
DROP POLICY IF EXISTS "Users access own org po_approval_limits" ON public.po_approval_limits;
CREATE POLICY "Users access own org po_approval_limits"
  ON public.po_approval_limits FOR ALL TO authenticated
  USING (org_id IN (SELECT get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT get_my_org_ids()));

-- 1.3 po_approval_config
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.po_approval_config;
DROP POLICY IF EXISTS "Users access own org po_approval_config" ON public.po_approval_config;
CREATE POLICY "Users access own org po_approval_config"
  ON public.po_approval_config FOR ALL TO authenticated
  USING (org_id IN (SELECT get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT get_my_org_ids()));

-- 1.4 purchase_orders
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users access own org purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users access own org purchase_orders"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (org_id IN (SELECT get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT get_my_org_ids()));

-- 1.5 supplier_invoices
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_invoices;
DROP POLICY IF EXISTS "Users access own org supplier_invoices" ON public.supplier_invoices;
CREATE POLICY "Users access own org supplier_invoices"
  ON public.supplier_invoices FOR ALL TO authenticated
  USING (org_id IN (SELECT get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT get_my_org_ids()));

-- 1.6 supplier_returns
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_returns;
DROP POLICY IF EXISTS "Users access own org supplier_returns" ON public.supplier_returns;
CREATE POLICY "Users access own org supplier_returns"
  ON public.supplier_returns FOR ALL TO authenticated
  USING (org_id IN (SELECT get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT get_my_org_ids()));


-- ==========================================
-- 2. Tablas vinculadas de forma indirecta
-- ==========================================

-- 2.1 supplier_contacts
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_contacts;
DROP POLICY IF EXISTS "Users access own org supplier_contacts" ON public.supplier_contacts;
CREATE POLICY "Users access own org supplier_contacts"
  ON public.supplier_contacts FOR ALL TO authenticated
  USING (supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids())))
  WITH CHECK (supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids())));

-- 2.2 supplier_items
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_items;
DROP POLICY IF EXISTS "Users access own org supplier_items" ON public.supplier_items;
CREATE POLICY "Users access own org supplier_items"
  ON public.supplier_items FOR ALL TO authenticated
  USING (supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids())))
  WITH CHECK (supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids())));

-- 2.3 supplier_price_lists
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_price_lists;
DROP POLICY IF EXISTS "Users access own org supplier_price_lists" ON public.supplier_price_lists;
CREATE POLICY "Users access own org supplier_price_lists"
  ON public.supplier_price_lists FOR ALL TO authenticated
  USING (supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids())))
  WITH CHECK (supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids())));

-- 2.4 supplier_price_list_items
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_price_list_items;
DROP POLICY IF EXISTS "Users access own org supplier_price_list_items" ON public.supplier_price_list_items;
CREATE POLICY "Users access own org supplier_price_list_items"
  ON public.supplier_price_list_items FOR ALL TO authenticated
  USING (price_list_id IN (SELECT id FROM public.supplier_price_lists WHERE supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids()))))
  WITH CHECK (price_list_id IN (SELECT id FROM public.supplier_price_lists WHERE supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids()))));

-- 2.5 purchase_order_lines
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.purchase_order_lines;
DROP POLICY IF EXISTS "Users access own org purchase_order_lines" ON public.purchase_order_lines;
CREATE POLICY "Users access own org purchase_order_lines"
  ON public.purchase_order_lines FOR ALL TO authenticated
  USING (po_id IN (SELECT id FROM public.purchase_orders WHERE org_id IN (SELECT get_my_org_ids())))
  WITH CHECK (po_id IN (SELECT id FROM public.purchase_orders WHERE org_id IN (SELECT get_my_org_ids())));

-- 2.6 po_approvals
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.po_approvals;
DROP POLICY IF EXISTS "Users access own org po_approvals" ON public.po_approvals;
CREATE POLICY "Users access own org po_approvals"
  ON public.po_approvals FOR ALL TO authenticated
  USING (po_id IN (SELECT id FROM public.purchase_orders WHERE org_id IN (SELECT get_my_org_ids())))
  WITH CHECK (po_id IN (SELECT id FROM public.purchase_orders WHERE org_id IN (SELECT get_my_org_ids())));

-- 2.7 supplier_invoice_lines
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS "Users access own org supplier_invoice_lines" ON public.supplier_invoice_lines;
CREATE POLICY "Users access own org supplier_invoice_lines"
  ON public.supplier_invoice_lines FOR ALL TO authenticated
  USING (invoice_id IN (SELECT id FROM public.supplier_invoices WHERE org_id IN (SELECT get_my_org_ids())))
  WITH CHECK (invoice_id IN (SELECT id FROM public.supplier_invoices WHERE org_id IN (SELECT get_my_org_ids())));

-- 2.8 supplier_return_lines
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_return_lines;
DROP POLICY IF EXISTS "Users access own org supplier_return_lines" ON public.supplier_return_lines;
CREATE POLICY "Users access own org supplier_return_lines"
  ON public.supplier_return_lines FOR ALL TO authenticated
  USING (return_id IN (SELECT id FROM public.supplier_returns WHERE org_id IN (SELECT get_my_org_ids())))
  WITH CHECK (return_id IN (SELECT id FROM public.supplier_returns WHERE org_id IN (SELECT get_my_org_ids())));

-- 2.9 supplier_credit_notes
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.supplier_credit_notes;
DROP POLICY IF EXISTS "Users access own org supplier_credit_notes" ON public.supplier_credit_notes;
CREATE POLICY "Users access own org supplier_credit_notes"
  ON public.supplier_credit_notes FOR ALL TO authenticated
  USING (return_id IN (SELECT id FROM public.supplier_returns WHERE org_id IN (SELECT get_my_org_ids())))
  WITH CHECK (return_id IN (SELECT id FROM public.supplier_returns WHERE org_id IN (SELECT get_my_org_ids())));

-- 2.10 supplier_evaluations
DROP POLICY IF EXISTS "Allow authenticated full access to supplier_evaluations" ON public.supplier_evaluations;
DROP POLICY IF EXISTS "Users access own org supplier_evaluations" ON public.supplier_evaluations;
CREATE POLICY "Users access own org supplier_evaluations"
  ON public.supplier_evaluations FOR ALL TO authenticated
  USING (supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids())))
  WITH CHECK (supplier_id IN (SELECT id FROM public.suppliers WHERE org_id IN (SELECT get_my_org_ids())));
