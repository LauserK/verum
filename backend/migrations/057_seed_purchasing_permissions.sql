-- backend/migrations/057_seed_purchasing_permissions.sql
-- Seed missing purchasing module permissions into permissions table

INSERT INTO public.permissions (module, action, key, description) VALUES
  ('purchasing', 'view', 'purchasing.view', 'Visualizar compras (Órdenes de compra y proveedores)'),
  ('purchasing', 'create', 'purchasing.create', 'Crear órdenes de compra'),
  ('purchasing', 'approve', 'purchasing.approve', 'Aprobar u observar órdenes de compra'),
  ('purchasing', 'send', 'purchasing.send', 'Marcar orden de compra como enviada al proveedor'),
  ('purchasing', 'configure', 'purchasing.configure', 'Configurar límites de aprobación y parámetros de compras'),
  ('purchasing', 'manage_suppliers', 'purchasing.manage_suppliers', 'Gestionar proveedores (Crear, Editar, Eliminar)'),
  ('purchasing', 'supplier_view', 'purchasing.supplier.view', 'Ver catálogo de artículos de proveedores'),
  ('purchasing', 'supplier_edit', 'purchasing.supplier.edit', 'Gestionar catálogo de artículos de proveedores')
ON CONFLICT (key) DO NOTHING;
