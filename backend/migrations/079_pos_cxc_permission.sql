-- backend/migrations/079_pos_cxc_permission.sql
-- Description: Register pos.create_cxc permission and assign it to existing roles

INSERT INTO public.permissions (module, action, key, description) VALUES
    ('pos', 'create_cxc', 'pos.create_cxc', 'Autorizar o crear Cuentas por Cobrar (CXC)')
ON CONFLICT (key) DO UPDATE 
SET description = EXCLUDED.description,
    action = EXCLUDED.action,
    module = EXCLUDED.module;

-- Assign to existing custom roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.custom_roles r
CROSS JOIN public.permissions p
WHERE p.key = 'pos.create_cxc'
ON CONFLICT (role_id, permission_id) DO NOTHING;
