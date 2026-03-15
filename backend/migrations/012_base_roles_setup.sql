-- backend/migrations/012_base_roles_setup.sql
DO $$
DECLARE
    org_record RECORD;
    role_admin_id UUID;
    role_supervisor_id UUID;
    role_staff_id UUID;
BEGIN
    -- Iterate over each organization to create base roles
    FOR org_record IN SELECT id FROM organizations LOOP
        
        -- 1. Create 'Gerente de Operaciones' (Admin level)
        INSERT INTO custom_roles (org_id, name, description, is_admin)
        VALUES (org_record.id, 'Gerente de Operaciones', 'Control total de la sede, usuarios y configuraciones.', true)
        RETURNING id INTO role_admin_id;

        -- 2. Create 'Supervisor de Turno'
        INSERT INTO custom_roles (org_id, name, description, is_admin)
        VALUES (org_record.id, 'Supervisor de Turno', 'Gestión de checklists, auditoría de otros turnos y control de inventario.', false)
        RETURNING id INTO role_supervisor_id;

        -- 3. Create 'Personal de Línea'
        INSERT INTO custom_roles (org_id, name, description, is_admin)
        VALUES (org_record.id, 'Personal de Línea', 'Ejecución de checklists, reporte de fallas y conteos de inventario.', false)
        RETURNING id INTO role_staff_id;

        -- Associate Permissions to 'Supervisor de Turno'
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_supervisor_id, id FROM permissions 
        WHERE key IN (
            'checklists.view', 'checklists.execute', 'checklists.view_all', 'checklists.manage_templates',
            'inventory_assets.view', 'inventory_assets.report_fault', 'inventory_assets.add_ticket_entry', 
            'inventory_assets.close_ticket', 'inventory_assets.print_qr', 'inventory_assets.review',
            'inventory_utensils.view', 'inventory_utensils.count', 'inventory_utensils.confirm_count',
            'admin.view_dashboard', 'admin.view_reports'
        );

        -- Associate Permissions to 'Personal de Línea'
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_staff_id, id FROM permissions 
        WHERE key IN (
            'checklists.view', 'checklists.execute',
            'inventory_assets.view', 'inventory_assets.report_fault', 'inventory_assets.add_ticket_entry',
            'inventory_utensils.view', 'inventory_utensils.count'
        );

    END LOOP;
END $$;
