-- backend/migrations/031_item_categories.sql

-- Tabla de categorías de artículos
create table if not exists item_categories (
  id          uuid default uuid_generate_v4() primary key,
  org_id      uuid references organizations(id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean default true,
  created_at  timestamp with time zone default now()
);

-- Añadir category_id a la tabla de items
alter table items 
add column if not exists category_id uuid references item_categories(id) on delete set null;

-- Permisos para gestionar categorías
INSERT INTO permissions (module, action, key, description) VALUES
  ('inventory', 'manage_categories', 'inventory.manage_categories', 'Crear y editar categorías de artículos')
ON CONFLICT (key) DO NOTHING;
