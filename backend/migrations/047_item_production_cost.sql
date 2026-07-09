-- backend/migrations/047_item_production_cost.sql

-- 1. Create the new column for production cost
ALTER TABLE items ADD COLUMN production_cost numeric(18,6);

-- 2. Revert the last_purchase_cost values (which were previously multiplied by 1.1)
-- to keep the raw original cost.
UPDATE items 
SET last_purchase_cost = last_purchase_cost / 1.1
WHERE type NOT IN ('finished', 'semi_finished')
  AND last_purchase_cost IS NOT NULL;

-- 3. Populate production_cost with the calculated values
-- (last_purchase_cost * margin_multiplier) / yield_factor
UPDATE items 
SET production_cost = COALESCE(
  (last_purchase_cost * COALESCE(margin_multiplier, 1.0)) / COALESCE(NULLIF(yield_factor, 0), 1.0),
  last_purchase_cost
);
