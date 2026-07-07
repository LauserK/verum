-- Agregar columna auto_calculate_cost a la tabla recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS auto_calculate_cost boolean NOT NULL DEFAULT true;
