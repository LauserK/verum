create table recipes (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  item_id         uuid references items(id) unique,
  yield_qty_base  numeric(18, 6) not null,
  yield_presentation_id uuid references uom_presentations(id),
  is_active       boolean default true,
  created_at      timestamp with time zone default now()
);

create table recipe_ingredients (
  id              uuid default uuid_generate_v4() primary key,
  recipe_id       uuid references recipes(id) on delete cascade,
  item_id         uuid references items(id),
  qty_base        numeric(18, 6) not null,
  presentation_id uuid references uom_presentations(id),
  order_index     integer not null
);

create table recipe_steps (
  id              uuid default uuid_generate_v4() primary key,
  recipe_id       uuid references recipes(id) on delete cascade,
  order_index     integer not null,
  description     text not null,
  estimated_time_minutes integer default 0
);
