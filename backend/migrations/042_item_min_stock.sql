-- backend/migrations/042_item_min_stock.sql
-- Agregar columna de stock mínimo al catálogo de artículos
ALTER TABLE items ADD COLUMN min_stock NUMERIC(18, 6) NOT NULL DEFAULT 0.0;
