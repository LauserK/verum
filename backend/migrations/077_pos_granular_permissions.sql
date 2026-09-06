-- backend/migrations/077_pos_granular_permissions.sql
-- Description: Register comprehensive POS terminal granular permissions and assign them to existing roles

-- 1. Insert / Upsert POS permissions
INSERT INTO public.permissions (module, action, key, description) VALUES
    ('pos', 'access_terminal',     'pos.access_terminal',     'Acceder a la pantalla del punto de venta (POS)'),
    ('pos', 'open_session',        'pos.open_session',        'Abrir turno / sesión de caja'),
    ('pos', 'close_session',       'pos.close_session',       'Cerrar sesión de caja y arqueo'),
    ('pos', 'cash_movements',      'pos.cash_movements',      'Registrar entradas y retiros manuales de caja'),
    ('pos', 'apply_discount',      'pos.apply_discount',      'Aplicar descuentos en comanda o ítems'),
    ('pos', 'void_item_sent',      'pos.void_item_sent',      'Anular ítems ya enviados a cocina'),
    ('pos', 'void_order',          'pos.void_order',          'Anular o cancelar comandas abiertas'),
    ('pos', 'transfer_table',      'pos.transfer_table',      'Mover o unir cuentas entre mesas')
ON CONFLICT (key) DO UPDATE 
SET description = EXCLUDED.description,
    action = EXCLUDED.action,
    module = EXCLUDED.module;

-- 2. Assign all POS permissions to all existing custom roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.custom_roles r
CROSS JOIN public.permissions p
WHERE p.module = 'pos'
ON CONFLICT (role_id, permission_id) DO NOTHING;
