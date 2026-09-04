-- backend/migrations/075_optimize_process_physical_inventory.sql
-- High performance stored procedure to process physical inventory counts atomically in milliseconds

CREATE OR REPLACE FUNCTION public.process_physical_inventory_rpc(
    p_inventory_id UUID,
    p_user_id UUID,
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inv RECORD;
    v_line RECORD;
    v_stock RECORD;
    v_stock_id UUID;
    v_expected NUMERIC(18, 6);
    v_counted NUMERIC(18, 6);
    v_diff NUMERIC(18, 6);
    v_cost NUMERIC(18, 6);
    v_effective_date TIMESTAMPTZ;
    v_lot_id UUID;
    v_to_consume NUMERIC(18, 6);
    v_remaining NUMERIC(18, 6);
    v_consume_qty NUMERIC(18, 6);
    v_lot RECORD;
    v_processed_count INT := 0;
BEGIN
    -- 1. Lock and validate header
    SELECT * INTO v_inv
    FROM public.physical_inventories
    WHERE id = p_inventory_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Physical inventory not found';
    END IF;

    IF v_inv.status <> 'draft' THEN
        RAISE EXCEPTION 'Inventory count has already been processed';
    END IF;

    v_effective_date := COALESCE(v_inv.execution_date, v_inv.created_at, NOW());

    -- 2. Process each line
    FOR v_line IN
        SELECT *
        FROM public.physical_inventory_lines
        WHERE physical_inventory_id = p_inventory_id
    LOOP
        v_counted := v_line.qty_counted_base;

        -- Get current stock
        SELECT id, qty_base INTO v_stock
        FROM public.stock
        WHERE warehouse_id = v_inv.warehouse_id AND item_id = v_line.item_id
        FOR UPDATE;

        IF FOUND THEN
            v_expected := COALESCE(v_stock.qty_base, 0);
            v_stock_id := v_stock.id;
        ELSE
            v_expected := 0;
            v_stock_id := NULL;
        END IF;

        -- Snapshot expected quantity in line
        UPDATE public.physical_inventory_lines
        SET qty_expected_base = v_expected
        WHERE id = v_line.id;

        v_diff := v_counted - v_expected;

        IF v_diff > 0 THEN
            -- Positive Adjustment: Add lot & movement
            SELECT COALESCE(last_purchase_cost, 0) INTO v_cost
            FROM public.items
            WHERE id = v_line.item_id;

            INSERT INTO public.stock_lots (
                warehouse_id, item_id, lot_number, qty_base, unit_cost_base, received_at, is_exhausted
            ) VALUES (
                v_inv.warehouse_id, v_line.item_id, 'AJUSTE-' || v_inv.document_number, v_diff, v_cost, v_effective_date, false
            ) RETURNING id INTO v_lot_id;

            INSERT INTO public.stock_movements (
                org_id, movement_type, warehouse_id, item_id, lot_id,
                qty_base, unit_cost_base, total_cost, reference_id, reference_type,
                notes, created_by, created_at
            ) VALUES (
                p_org_id, 'adjustment_in', v_inv.warehouse_id, v_line.item_id, v_lot_id,
                v_diff, v_cost, v_diff * v_cost, p_inventory_id, 'physical_inventory',
                'Ajuste por diferencia de inventario ' || v_inv.document_number, p_user_id, v_effective_date
            );

            -- Update stock balance
            IF v_stock_id IS NOT NULL THEN
                UPDATE public.stock
                SET qty_base = qty_base + v_diff
                WHERE id = v_stock_id;
            ELSE
                INSERT INTO public.stock (warehouse_id, item_id, qty_base, qty_reserved)
                VALUES (v_inv.warehouse_id, v_line.item_id, v_diff, 0);
            END IF;

        ELSIF v_diff < 0 THEN
            -- Negative Adjustment: Consume FIFO lots & movement
            v_to_consume := ABS(v_diff);
            v_remaining := v_to_consume;

            FOR v_lot IN
                SELECT id, qty_base, unit_cost_base
                FROM public.stock_lots
                WHERE item_id = v_line.item_id
                  AND warehouse_id = v_inv.warehouse_id
                  AND qty_base > 0
                  AND NOT is_exhausted
                ORDER BY received_at ASC
                FOR UPDATE
            LOOP
                IF v_remaining <= 0 THEN
                    EXIT;
                END IF;

                v_consume_qty := LEAST(v_remaining, v_lot.qty_base);

                UPDATE public.stock_lots
                SET qty_base = qty_base - v_consume_qty,
                    is_exhausted = (qty_base - v_consume_qty <= 0)
                WHERE id = v_lot.id;

                INSERT INTO public.stock_movements (
                    org_id, movement_type, warehouse_id, item_id, lot_id,
                    qty_base, unit_cost_base, total_cost, reference_id, reference_type,
                    notes, created_by, created_at
                ) VALUES (
                    p_org_id, 'adjustment_out', v_inv.warehouse_id, v_line.item_id, v_lot.id,
                    -v_consume_qty, v_lot.unit_cost_base, -v_consume_qty * v_lot.unit_cost_base, p_inventory_id, 'physical_inventory',
                    'Consumo por ajuste físico ' || v_inv.document_number, p_user_id, v_effective_date
                );

                v_remaining := v_remaining - v_consume_qty;
            END LOOP;

            -- If remaining exists without lots, log fallback adjustment
            IF v_remaining > 0 THEN
                SELECT COALESCE(last_purchase_cost, 0) INTO v_cost
                FROM public.items
                WHERE id = v_line.item_id;

                INSERT INTO public.stock_movements (
                    org_id, movement_type, warehouse_id, item_id, lot_id,
                    qty_base, unit_cost_base, total_cost, reference_id, reference_type,
                    notes, created_by, created_at
                ) VALUES (
                    p_org_id, 'adjustment_out', v_inv.warehouse_id, v_line.item_id, NULL,
                    -v_remaining, v_cost, -v_remaining * v_cost, p_inventory_id, 'physical_inventory',
                    'Consumo por ajuste físico ' || v_inv.document_number, p_user_id, v_effective_date
                );
            END IF;

            -- Update overall stock
            IF v_stock_id IS NOT NULL THEN
                UPDATE public.stock
                SET qty_base = GREATEST(0, qty_base - v_to_consume)
                WHERE id = v_stock_id;
            END IF;
        END IF;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    -- 3. Mark physical inventory as processed
    UPDATE public.physical_inventories
    SET status = 'processed',
        processed_by = p_user_id,
        processed_at = NOW()
    WHERE id = p_inventory_id;

    RETURN jsonb_build_object(
        'success', true,
        'lines_processed', v_processed_count,
        'processed_at', NOW()
    );
END;
$$;
