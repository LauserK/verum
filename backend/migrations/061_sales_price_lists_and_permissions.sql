-- backend/migrations/061_sales_price_lists_and_permissions.sql

-- 1. Sale Price Lists
CREATE TABLE IF NOT EXISTS public.sale_price_lists (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    venue_id    UUID REFERENCES venues(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    is_default  BOOLEAN DEFAULT FALSE,
    is_active   BOOLEAN DEFAULT TRUE,
    valid_from  DATE,
    valid_until DATE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (org_id, name)
);

-- 2. Sale Price List Items
CREATE TABLE IF NOT EXISTS public.sale_price_list_items (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    price_list_id   UUID REFERENCES sale_price_lists(id) ON DELETE CASCADE NOT NULL,
    sale_item_id    UUID REFERENCES sale_items(id) ON DELETE CASCADE NOT NULL,
    variant_id      UUID REFERENCES sale_item_variants(id) ON DELETE CASCADE,
    price           NUMERIC(18,6) NOT NULL,
    UNIQUE (price_list_id, sale_item_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_price_list_items ON public.sale_price_list_items(price_list_id, sale_item_id);

-- 3. RLS Policies
ALTER TABLE public.sale_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_price_list_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'sale_price_lists', 'sale_price_list_items'
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

-- 4. Seed Permissions
INSERT INTO public.permissions (module, action, key, description) VALUES
    ('sales', 'view_catalog',       'sales.view_catalog',       'Ver catálogo de venta'),
    ('sales', 'manage_catalog',     'sales.manage_catalog',     'Crear/editar productos, variantes, componentes y modificadores'),
    ('sales', 'manage_prices',      'sales.manage_prices',      'Editar precios y listas de precios'),
    ('sales', 'view_customers',     'sales.view_customers',     'Ver directorio de clientes'),
    ('sales', 'manage_customers',   'sales.manage_customers',   'Crear/editar clientes'),
    ('sales', 'create_invoice',     'sales.create_invoice',     'Crear facturas y proformas'),
    ('sales', 'void_invoice',       'sales.void_invoice',       'Anular facturas'),
    ('sales', 'view_invoices',      'sales.view_invoices',      'Ver facturas e histórico'),
    ('sales', 'manage_payments',    'sales.manage_payments',    'Registrar y gestionar pagos'),
    ('sales', 'create_credit_note', 'sales.create_credit_note', 'Crear notas de crédito'),
    ('sales', 'create_debit_note',  'sales.create_debit_note',  'Crear notas de débito'),
    ('sales', 'manage_config',      'sales.manage_config',      'Configurar facturación, impuestos y surcharges'),
    ('sales', 'manage_workstations','sales.manage_workstations','Configurar estaciones de trabajo'),
    ('sales', 'manage_payment_methods','sales.manage_payment_methods','Configurar métodos de pago'),
    ('pos', 'open_session',         'pos.open_session',         'Abrir sesión de caja'),
    ('pos', 'close_session',        'pos.close_session',        'Cerrar sesión de caja'),
    ('pos', 'cash_movements',       'pos.cash_movements',       'Registrar entradas/salidas de caja')
ON CONFLICT (key) DO NOTHING;
