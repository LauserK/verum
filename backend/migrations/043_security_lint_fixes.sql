-- backend/migrations/043_security_lint_fixes.sql
-- Correcciones de seguridad detectadas por Supabase Linter
-- Fuente: Supabase Performance Security Lints (mbtmdriadqzttpaicpgg).csv
--
-- ESTRATEGIA DE AISLAMIENTO MULTI-TENANT:
--
--   REGLA GLOBAL: Si org_id IS NULL → el registro es compartido/global y
--   cualquier usuario autenticado puede acceder (ej: uom_presentations globales).
--   Si org_id tiene valor → sólo usuarios que pertenezcan a esa org pueden acceder.
--
--   Tablas sin org_id directo (tablas "hijo"):
--     Heredan el aislamiento a través de su tabla padre (receipt_id, issue_id, etc.)
--
--   Cadena de resolución:
--     auth.uid() → profiles.auth_user_id
--                → profile_organizations.profile_id
--                → profile_organizations.organization_id

-- ============================================================
-- 0. FUNCIÓN AUXILIAR: get_my_org_ids()
-- ============================================================
-- Retorna los UUIDs de todas las organizaciones del usuario actual.
-- SECURITY DEFINER necesario para que sea invocable desde contexto de políticas.

CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- profiles.id es directamente el UUID de auth.users (FK a auth.users)
    SELECT organization_id
    FROM profile_organizations
    WHERE profile_id = auth.uid();
$$;

-- ============================================================
-- 1. uom_base  — catálogo global del sistema (sin org_id)
-- ============================================================
-- Solo lectura para todos los autenticados. No tiene org_id.

ALTER TABLE public.uom_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.uom_base;
DROP POLICY IF EXISTS "Authenticated users can read uom_base" ON public.uom_base;
CREATE POLICY "Authenticated users can read uom_base"
    ON public.uom_base FOR SELECT TO authenticated
    USING (true);

-- ============================================================
-- 2. uom_presentations
-- ============================================================
-- org_id NULL  → presentación global del sistema (visible para todos).
-- org_id NOT NULL → pertenece a una org específica.

ALTER TABLE public.uom_presentations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.uom_presentations;
DROP POLICY IF EXISTS "Users access own org or global uom_presentations" ON public.uom_presentations;
CREATE POLICY "Users access own org or global uom_presentations"
    ON public.uom_presentations FOR ALL TO authenticated
    USING (
        org_id IS NULL                              -- global: accesible para todos
        OR org_id IN (SELECT get_my_org_ids())      -- privada: sólo su org
    )
    WITH CHECK (
        org_id IN (SELECT get_my_org_ids())         -- sólo puede escribir en su org
    );

-- ============================================================
-- 3. items
-- ============================================================
-- org_id NULL → artículo de catálogo global (visible para todos).
-- org_id NOT NULL → artículo privado de la org.

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.items;
DROP POLICY IF EXISTS "Users access own org or global items" ON public.items;
CREATE POLICY "Users access own org or global items"
    ON public.items FOR ALL TO authenticated
    USING (
        org_id IS NULL
        OR org_id IN (SELECT get_my_org_ids())
    )
    WITH CHECK (
        org_id IN (SELECT get_my_org_ids())
    );

-- ============================================================
-- 4. item_uom_presentations  (tabla de relación item ↔ presentación)
-- ============================================================
-- Hereda aislamiento del item asociado.
-- Si el item es global (org_id IS NULL) → todos pueden leer.

ALTER TABLE public.item_uom_presentations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.item_uom_presentations;
DROP POLICY IF EXISTS "Users access item_uom_presentations of own org or global" ON public.item_uom_presentations;
CREATE POLICY "Users access item_uom_presentations of own org or global"
    ON public.item_uom_presentations FOR ALL TO authenticated
    USING (
        item_id IN (
            SELECT id FROM items
            WHERE org_id IS NULL
               OR org_id IN (SELECT get_my_org_ids())
        )
    )
    WITH CHECK (
        item_id IN (
            SELECT id FROM items
            WHERE org_id IN (SELECT get_my_org_ids())
        )
    );

-- ============================================================
-- 5. warehouses
-- ============================================================
-- org_id NULL → bodega global/compartida (poco probable, pero cubierto).
-- org_id NOT NULL → bodega privada de la org.

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.warehouses;
DROP POLICY IF EXISTS "Users access own org or global warehouses" ON public.warehouses;
CREATE POLICY "Users access own org or global warehouses"
    ON public.warehouses FOR ALL TO authenticated
    USING (
        org_id IS NULL
        OR org_id IN (SELECT get_my_org_ids())
    )
    WITH CHECK (
        org_id IN (SELECT get_my_org_ids())
    );

-- ============================================================
-- 6. stock  (hereda del warehouse)
-- ============================================================

ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.stock;
DROP POLICY IF EXISTS "Users access stock of own org or global warehouses" ON public.stock;
CREATE POLICY "Users access stock of own org or global warehouses"
    ON public.stock FOR ALL TO authenticated
    USING (
        warehouse_id IN (
            SELECT id FROM warehouses
            WHERE org_id IS NULL
               OR org_id IN (SELECT get_my_org_ids())
        )
    )
    WITH CHECK (
        warehouse_id IN (
            SELECT id FROM warehouses
            WHERE org_id IN (SELECT get_my_org_ids())
        )
    );

-- ============================================================
-- 7. stock_lots  (hereda del warehouse)
-- ============================================================

ALTER TABLE public.stock_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.stock_lots;
DROP POLICY IF EXISTS "Users access stock_lots of own org or global warehouses" ON public.stock_lots;
CREATE POLICY "Users access stock_lots of own org or global warehouses"
    ON public.stock_lots FOR ALL TO authenticated
    USING (
        warehouse_id IN (
            SELECT id FROM warehouses
            WHERE org_id IS NULL
               OR org_id IN (SELECT get_my_org_ids())
        )
    )
    WITH CHECK (
        warehouse_id IN (
            SELECT id FROM warehouses
            WHERE org_id IN (SELECT get_my_org_ids())
        )
    );

-- ============================================================
-- 8. stock_movements
-- ============================================================

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.stock_movements;
DROP POLICY IF EXISTS "Users access own org or global stock_movements" ON public.stock_movements;
CREATE POLICY "Users access own org or global stock_movements"
    ON public.stock_movements FOR ALL TO authenticated
    USING (
        org_id IS NULL
        OR org_id IN (SELECT get_my_org_ids())
    )
    WITH CHECK (
        org_id IN (SELECT get_my_org_ids())
    );

-- ============================================================
-- 9. purchase_receipts
-- ============================================================

ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.purchase_receipts;
DROP POLICY IF EXISTS "Users access own org or global purchase_receipts" ON public.purchase_receipts;
CREATE POLICY "Users access own org or global purchase_receipts"
    ON public.purchase_receipts FOR ALL TO authenticated
    USING (
        org_id IS NULL
        OR org_id IN (SELECT get_my_org_ids())
    )
    WITH CHECK (
        org_id IN (SELECT get_my_org_ids())
    );

-- ============================================================
-- 10. purchase_receipt_lines  (hereda de purchase_receipts)
-- ============================================================

ALTER TABLE public.purchase_receipt_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.purchase_receipt_lines;
DROP POLICY IF EXISTS "Users access lines of own org or global purchase_receipts" ON public.purchase_receipt_lines;
CREATE POLICY "Users access lines of own org or global purchase_receipts"
    ON public.purchase_receipt_lines FOR ALL TO authenticated
    USING (
        receipt_id IN (
            SELECT id FROM purchase_receipts
            WHERE org_id IS NULL
               OR org_id IN (SELECT get_my_org_ids())
        )
    )
    WITH CHECK (
        receipt_id IN (
            SELECT id FROM purchase_receipts
            WHERE org_id IN (SELECT get_my_org_ids())
        )
    );

-- ============================================================
-- 11. issue_documents
-- ============================================================

ALTER TABLE public.issue_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.issue_documents;
DROP POLICY IF EXISTS "Users access own org or global issue_documents" ON public.issue_documents;
CREATE POLICY "Users access own org or global issue_documents"
    ON public.issue_documents FOR ALL TO authenticated
    USING (
        org_id IS NULL
        OR org_id IN (SELECT get_my_org_ids())
    )
    WITH CHECK (
        org_id IN (SELECT get_my_org_ids())
    );

-- ============================================================
-- 12. issue_document_lines  (hereda de issue_documents via issue_id)
-- ============================================================

ALTER TABLE public.issue_document_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.issue_document_lines;
DROP POLICY IF EXISTS "Users access lines of own org or global issue_documents" ON public.issue_document_lines;
CREATE POLICY "Users access lines of own org or global issue_documents"
    ON public.issue_document_lines FOR ALL TO authenticated
    USING (
        issue_id IN (
            SELECT id FROM issue_documents
            WHERE org_id IS NULL
               OR org_id IN (SELECT get_my_org_ids())
        )
    )
    WITH CHECK (
        issue_id IN (
            SELECT id FROM issue_documents
            WHERE org_id IN (SELECT get_my_org_ids())
        )
    );

-- ============================================================
-- 13. transfer_documents
-- ============================================================

ALTER TABLE public.transfer_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.transfer_documents;
DROP POLICY IF EXISTS "Users access own org or global transfer_documents" ON public.transfer_documents;
CREATE POLICY "Users access own org or global transfer_documents"
    ON public.transfer_documents FOR ALL TO authenticated
    USING (
        org_id IS NULL
        OR org_id IN (SELECT get_my_org_ids())
    )
    WITH CHECK (
        org_id IN (SELECT get_my_org_ids())
    );

-- ============================================================
-- 14. transfer_document_lines  (hereda de transfer_documents via transfer_id)
-- ============================================================

ALTER TABLE public.transfer_document_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.transfer_document_lines;
DROP POLICY IF EXISTS "Users access lines of own org or global transfer_documents" ON public.transfer_document_lines;
CREATE POLICY "Users access lines of own org or global transfer_documents"
    ON public.transfer_document_lines FOR ALL TO authenticated
    USING (
        transfer_id IN (
            SELECT id FROM transfer_documents
            WHERE org_id IS NULL
               OR org_id IN (SELECT get_my_org_ids())
        )
    )
    WITH CHECK (
        transfer_id IN (
            SELECT id FROM transfer_documents
            WHERE org_id IN (SELECT get_my_org_ids())
        )
    );

-- ============================================================
-- 15. CORREGIR LA VISTA v_daily_attendance (SECURITY DEFINER → INVOKER)
-- ============================================================

DROP VIEW IF EXISTS public.v_daily_attendance;

CREATE VIEW public.v_daily_attendance
WITH (security_invoker = true) AS
SELECT
    al.profile_id,
    p.full_name,
    al.venue_id,
    date_trunc('day', al.marked_at)::date                                          AS work_date,
    min(al.marked_at)  FILTER (WHERE al.event_type = 'clock_in')                   AS clock_in,
    max(al.marked_at)  FILTER (WHERE al.event_type = 'clock_out')                  AS clock_out,
    round(
        extract(epoch FROM (
            max(al.marked_at) FILTER (WHERE al.event_type = 'clock_out')
          - min(al.marked_at) FILTER (WHERE al.event_type = 'clock_in')
        )) / 3600.0, 2
    )                                                                               AS gross_hours,
    round(
        extract(epoch FROM (
            max(al.marked_at) FILTER (WHERE al.event_type = 'break_end')
          - min(al.marked_at) FILTER (WHERE al.event_type = 'break_start')
        )) / 3600.0, 2
    )                                                                               AS break_hours,
    round(
        extract(epoch FROM (
            max(al.marked_at) FILTER (WHERE al.event_type = 'clock_out')
          - min(al.marked_at) FILTER (WHERE al.event_type = 'clock_in')
        )) / 3600.0
      - coalesce(
            extract(epoch FROM (
                max(al.marked_at) FILTER (WHERE al.event_type = 'break_end')
              - min(al.marked_at) FILTER (WHERE al.event_type = 'break_start')
            )) / 3600.0,
            0
        )
    , 2)                                                                            AS net_hours,
    coalesce(max(al.overtime_hours) FILTER (WHERE al.event_type = 'clock_in'),  0)
  + coalesce(max(al.overtime_hours) FILTER (WHERE al.event_type = 'clock_out'), 0) AS overtime_hours,
    max(al.minutes_late) FILTER (WHERE al.event_type = 'clock_in')                 AS minutes_late,
    a.type                                                                          AS absence_type
FROM attendance_logs al
JOIN profiles p ON p.id = al.profile_id
LEFT JOIN absences a
    ON a.profile_id = al.profile_id
   AND a.date = date_trunc('day', al.marked_at)::date
GROUP BY
    al.profile_id,
    p.full_name,
    al.venue_id,
    work_date,
    a.type;
