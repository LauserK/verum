-- backend/migrations/017_count_schedules.sql

-- 1. Cabecera de programación de conteos
create table if not exists count_schedules (
  id            uuid default uuid_generate_v4() primary key,
  org_id        uuid references organizations(id) on delete cascade,
  venue_id      uuid references venues(id),
  assigned_to   uuid references profiles(id), -- Si es null, cualquiera en la sede puede hacerlo
  name          text not null,              -- Ej: "Inventario Mensual de Loza"
  frequency     text check (frequency in (
    'daily', 'weekly', 'biweekly', 'monthly', 'one_time'
  )) not null,
  scope         text check (scope in (
    'all',        -- Todo lo activo en la sede
    'category',   -- Solo una categoría
    'custom'      -- Lista específica de productos
  )) not null,
  category_id   uuid references utensil_categories(id), -- Solo si scope = 'category'
  next_due      date not null,
  last_completed_at timestamp with time zone,
  is_active     boolean default true,
  created_by    uuid references profiles(id),
  created_at    timestamp with time zone default now()
);

-- 2. Ítems específicos de una programación (solo si scope = 'custom')
create table if not exists count_schedule_items (
  schedule_id   uuid references count_schedules(id) on delete cascade,
  item_id       uuid references utensils(id) on delete cascade,
  primary key (schedule_id, item_id)
);

-- 3. Vincular ejecuciones con su orden original
alter table utensil_counts add column if not exists schedule_id uuid references count_schedules(id) on delete set null;

-- Índices
create index if not exists idx_count_schedules_venue on count_schedules(venue_id);
create index if not exists idx_count_schedules_assigned on count_schedules(assigned_to);
create index if not exists idx_count_schedules_next on count_schedules(next_due) where is_active = true;
