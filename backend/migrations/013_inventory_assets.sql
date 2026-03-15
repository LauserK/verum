-- backend/migrations/013_inventory_assets.sql

-- 1. Categorías de activos (admin configura)
create table if not exists asset_categories (
  id        uuid default uuid_generate_v4() primary key,
  org_id    uuid references organizations(id) on delete cascade,
  name      text not null,           -- "Refrigeración", "Cocción", "POS"
  icon      text,                    -- Nombre de ícono Lucide
  review_interval_days integer default 30  -- Umbral de alerta de revisión
);

-- 2. Activos individuales
create table if not exists assets (
  id            uuid default uuid_generate_v4() primary key,
  org_id        uuid references organizations(id) on delete cascade,
  venue_id      uuid references venues(id),
  category_id   uuid references asset_categories(id),
  name          text not null,
  serial        text,
  brand         text,
  model         text,
  purchase_date date,
  status        text check (status in (
    'operativo',
    'en_reparacion',
    'baja'
  )) default 'operativo',
  location_note text,
  last_reviewed_at timestamp with time zone,
  photo_url     text,
  qr_code       text unique not null, -- UUID generado al crear. Inmutable.
  created_at    timestamp with time zone default now()
);

-- Índices para la tabla de activos
create index if not exists idx_assets_venue on assets(venue_id);
create index if not exists idx_assets_status on assets(status);
create index if not exists idx_assets_qr on assets(qr_code);

-- 3. Registro de revisiones preventivas
create table if not exists asset_reviews (
  id            uuid default uuid_generate_v4() primary key,
  asset_id      uuid references assets(id) on delete cascade,
  reviewed_by   uuid references profiles(id),
  notes         text,
  photo_url     text,
  created_at    timestamp with time zone default now()
);

-- Índice para las revisiones
create index if not exists idx_asset_reviews_asset on asset_reviews(asset_id);
