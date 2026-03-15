-- M10: Inventory Utensils

create table if not exists utensil_categories (
  id          uuid default uuid_generate_v4() primary key,
  org_id      uuid references organizations(id) on delete cascade,
  name        text not null,
  description text
);

create table if not exists utensils (
  id          uuid default uuid_generate_v4() primary key,
  org_id      uuid references organizations(id) on delete cascade,
  category_id uuid references utensil_categories(id) on delete set null,
  name        text not null,
  unit        text default 'unidades', -- 'unidades', 'docenas', 'cajas'
  min_stock   integer default 0,
  is_active   boolean default true,
  created_at  timestamp with time zone default now()
);

create index if not exists idx_utensils_org on utensils(org_id);
create index if not exists idx_utensils_category on utensils(category_id);
