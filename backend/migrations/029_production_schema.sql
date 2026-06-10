-- backend/migrations/029_production_schema.sql

-- Permisos del módulo
INSERT INTO permissions (module, action, key, description) VALUES
  ('inventory', 'view', 'inventory.view', 'Ver stock e inventario'),
  ('inventory', 'manage_items', 'inventory.manage_items', 'Crear y editar artículos y presentaciones'),
  ('inventory', 'manage_warehouses', 'inventory.manage_warehouses', 'Crear y editar almacenes')
ON CONFLICT (key) DO NOTHING;

-- Unidades de medida base
create table if not exists uom_base (
  id      uuid default uuid_generate_v4() primary key,
  code    text unique not null,
  name    text not null
);

INSERT INTO uom_base (code, name) VALUES
  ('g', 'Gramos'),
  ('ml', 'Mililitros'),
  ('unit', 'Unidades')
ON CONFLICT (code) DO NOTHING;

-- Presentaciones de conversión por artículo
create table if not exists uom_presentations (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  name            text not null,
  base_uom_id     uuid references uom_base(id),
  conversion_factor numeric(18, 6) not null,
  is_default      boolean default false
);

-- Catálogo de artículos
create table if not exists items (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  code            text,
  name            text not null,
  type            text check (type in (
    'raw_material', 'semi_finished', 'finished', 'packaging', 'supply'
  )),
  base_uom_id     uuid references uom_base(id),
  default_display_uom_id uuid references uom_presentations(id),
  yield_alert_enabled  boolean default false,
  yield_alert_threshold_pct numeric(5,2),
  shelf_life_days  integer,
  last_purchase_cost numeric(18,6),
  last_purchase_cost_updated_at timestamp with time zone,
  is_active       boolean default true,
  created_at      timestamp with time zone default now()
);

-- Presentaciones habilitadas por artículo
create table if not exists item_uom_presentations (
  item_id         uuid references items(id) on delete cascade,
  presentation_id uuid references uom_presentations(id) on delete cascade,
  primary key (item_id, presentation_id)
);

-- Almacenes
create table if not exists warehouses (
  id       uuid default uuid_generate_v4() primary key,
  org_id   uuid references organizations(id) on delete cascade,
  venue_id uuid references venues(id),
  name     text not null,
  type     text check (type in (
    'production', 'storage', 'point_of_sale', 'transit'
  )),
  is_active boolean default true
);

-- Stock actual
create table if not exists stock (
  id           uuid default uuid_generate_v4() primary key,
  warehouse_id uuid references warehouses(id) on delete cascade,
  item_id      uuid references items(id) on delete cascade,
  qty_base     numeric(18, 6) not null default 0,
  qty_reserved numeric(18, 6) not null default 0,
  unique (warehouse_id, item_id)
);

create index if not exists idx_stock_warehouse_item on stock(warehouse_id, item_id);
