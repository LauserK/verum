-- backend/migrations/038_recipe_ingredients_notes.sql
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS notes text;
