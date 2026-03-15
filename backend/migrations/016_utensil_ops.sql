-- backend/migrations/016_utensil_ops.sql

-- 1. Cabecera de conteos periódicos
create table if not exists utensil_counts (
  id            uuid default uuid_generate_v4() primary key,
  venue_id      uuid references venues(id) on delete cascade,
  created_by    uuid references profiles(id),
  status        text check (status in ('pending', 'confirmed')) default 'pending',
  created_at    timestamp with time zone default now(),
  confirmed_at  timestamp with time zone,
  confirmed_by  uuid references profiles(id)
);

-- 2. Detalle de ítems en el conteo
create table if not exists utensil_count_items (
  count_id      uuid references utensil_counts(id) on delete cascade,
  utensil_id    uuid references utensils(id) on delete cascade,
  initial_count integer not null,
  confirmed_count integer,
  primary key (count_id, utensil_id)
);

-- 3. Movimientos de inventario en tiempo real (Ingresos, Salidas, Traslados)
create table if not exists utensil_movements (
  id            uuid default uuid_generate_v4() primary key,
  org_id        uuid references organizations(id) on delete cascade,
  utensil_id    uuid references utensils(id) on delete cascade,
  from_venue_id uuid references venues(id) on delete set null,
  to_venue_id   uuid references venues(id) on delete set null,
  quantity      integer not null,
  type          text check (type in ('entry', 'exit', 'transfer', 'adjustment')),
  created_by    uuid references profiles(id),
  created_at    timestamp with time zone default now(),
  notes         text
);

-- Índices para optimización
create index if not exists idx_utensil_counts_venue on utensil_counts(venue_id);
create index if not exists idx_utensil_counts_status on utensil_counts(status);
create index if not exists idx_utensil_movements_utensil on utensil_movements(utensil_id);
create index if not exists idx_utensil_movements_org on utensil_movements(org_id);
