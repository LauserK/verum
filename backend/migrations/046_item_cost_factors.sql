-- backend/migrations/046_item_cost_factors.sql

ALTER TABLE items ADD COLUMN margin_multiplier numeric(18,6) DEFAULT 1.0;
ALTER TABLE items ADD COLUMN yield_factor numeric(18,6) DEFAULT 1.0;
