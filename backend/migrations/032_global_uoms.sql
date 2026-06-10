-- backend/migrations/032_global_uoms.sql

-- Añadir columna is_global a las presentaciones
alter table uom_presentations 
add column if not exists is_global boolean default false;

-- Poblar equivalencias genéricas comunes
-- Nota: Asumimos los IDs de uom_base creados anteriormente ('g', 'ml', 'unit')
-- Usamos subconsultas para obtener los IDs correctos

DO $$ 
DECLARE 
    g_id uuid;
    ml_id uuid;
    unit_id uuid;
BEGIN
    SELECT id INTO g_id FROM uom_base WHERE code = 'g';
    SELECT id INTO ml_id FROM uom_base WHERE code = 'ml';
    SELECT id INTO unit_id FROM uom_base WHERE code = 'unit';

    -- Equivalencias para Gramos (g)
    INSERT INTO uom_presentations (name, base_uom_id, conversion_factor, is_global, is_default)
    VALUES 
        ('Kilogramo (kg)', g_id, 1000, true, false),
        ('Libra (lb)', g_id, 453.59, true, false)
    ON CONFLICT DO NOTHING;

    -- Equivalencias para Mililitros (ml)
    INSERT INTO uom_presentations (name, base_uom_id, conversion_factor, is_global, is_default)
    VALUES 
        ('Litro (L)', ml_id, 1000, true, false),
        ('Onza (oz)', ml_id, 29.57, true, false)
    ON CONFLICT DO NOTHING;

    -- Equivalencias para Unidades (unit)
    INSERT INTO uom_presentations (name, base_uom_id, conversion_factor, is_global, is_default)
    VALUES 
        ('Docena', unit_id, 12, true, false),
        ('Media Docena', unit_id, 6, true, false),
        ('Six-Pack', unit_id, 6, true, false)
    ON CONFLICT DO NOTHING;
END $$;
