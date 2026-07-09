-- backend/migrations/048_recipe_safety_margin.sql

-- Add safety_margin column to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS safety_margin numeric(5,2) default 1.00;
