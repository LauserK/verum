-- backend/migrations/036_recipes_schema.sql

-- 1. Catering Requests (needed for production_orders reference)
create table if not exists catering_requests (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  name            text not null,
  event_date      date,
  notes           text,
  status          text check (status in ('planning', 'confirmed', 'completed', 'cancelled')) default 'planning',
  created_by      uuid references profiles(id),
  created_at      timestamp with time zone default now()
);

create table if not exists catering_request_lines (
  id              uuid default uuid_generate_v4() primary key,
  request_id      uuid references catering_requests(id) on delete cascade,
  item_id         uuid references items(id),
  qty_base        numeric(18, 6) not null,
  presentation_id uuid references uom_presentations(id),
  qty_presentation numeric(18, 6)
);

-- 2. Recipes
create table if not exists recipes (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  item_id         uuid references items(id) unique,
  yield_qty_base  numeric(18, 6) not null,
  yield_presentation_id uuid references uom_presentations(id),
  is_active       boolean default true,
  created_at      timestamp with time zone default now()
);

create table if not exists recipe_ingredients (
  id              uuid default uuid_generate_v4() primary key,
  recipe_id       uuid references recipes(id) on delete cascade,
  item_id         uuid references items(id),
  qty_base        numeric(18, 6) not null,
  presentation_id uuid references uom_presentations(id),
  order_index     integer not null
);

create table if not exists recipe_steps (
  id              uuid default uuid_generate_v4() primary key,
  recipe_id       uuid references recipes(id) on delete cascade,
  order_index     integer not null,
  description     text not null,
  estimated_time_minutes integer default 0
);

-- 3. Production Orders
create table if not exists production_orders (
  id                  uuid default uuid_generate_v4() primary key,
  org_id              uuid references organizations(id) on delete cascade,
  order_number        text unique not null,
  item_id             uuid references items(id),
  recipe_id           uuid references recipes(id),
  warehouse_id        uuid references warehouses(id),
  target_warehouse_id uuid references warehouses(id),
  qty_ordered_base    numeric(18, 6) not null,
  qty_produced_base   numeric(18, 6),
  presentation_id     uuid references uom_presentations(id),
  qty_ordered_presentation numeric(18, 6),
  status              text check (status in ('pending', 'in_progress', 'paused', 'completed', 'cancelled')) default 'pending',
  priority            text check (priority in ('low', 'normal', 'high', 'urgent')) default 'normal',
  scheduled_date      date,
  started_at          timestamp with time zone,
  completed_at        timestamp with time zone,
  yield_alert_triggered boolean default false,
  yield_variance_pct    numeric(5,2),
  catering_request_id uuid references catering_requests(id) on delete set null,
  notes               text,
  created_by          uuid references profiles(id),
  assigned_to         uuid references profiles(id)
);

create table if not exists production_order_consumptions (
  id                  uuid default uuid_generate_v4() primary key,
  order_id            uuid references production_orders(id) on delete cascade,
  item_id             uuid references items(id),
  lot_id              uuid references stock_lots(id),
  qty_planned_base    numeric(18, 6) not null,
  qty_actual_base     numeric(18, 6),
  unit_cost_base      numeric(18, 6)
);

create table if not exists production_lots (
  id                  uuid default uuid_generate_v4() primary key,
  order_id            uuid references production_orders(id) on delete cascade,
  item_id             uuid references items(id),
  warehouse_id        uuid references warehouses(id),
  lot_number          text unique not null,
  qty_base            numeric(18, 6) not null,
  unit_cost_base      numeric(18, 6),
  production_date     date not null,
  expiry_date         date,
  label_printed       boolean default false,
  created_at          timestamp with time zone default now()
);

-- 4. Permissions
INSERT INTO permissions (module, action, key, description) VALUES
  ('production', 'view', 'production.view', 'Ver órdenes de producción'),
  ('production', 'execute', 'production.execute', 'Iniciar, pausar y completar órdenes'),
  ('production', 'create', 'production.create', 'Crear órdenes de producción'),
  ('production', 'audit', 'production.audit', 'Revisar alertas de rendimiento'),
  ('production', 'manage_recipes', 'production.manage_recipes', 'Crear y editar recetas'),
  ('production', 'manage_catering', 'production.manage_catering', 'Crear y gestionar solicitudes de catering')
ON CONFLICT (key) DO NOTHING;

-- 5. Indexes
create index if not exists idx_catering_requests_org_id on catering_requests(org_id);
create index if not exists idx_catering_request_lines_request_id on catering_request_lines(request_id);
create index if not exists idx_recipes_org_id on recipes(org_id);
create index if not exists idx_recipes_item_id on recipes(item_id);
create index if not exists idx_recipe_ingredients_recipe_id on recipe_ingredients(recipe_id);
create index if not exists idx_recipe_ingredients_item_id on recipe_ingredients(item_id);
create index if not exists idx_recipe_steps_recipe_id on recipe_steps(recipe_id);
create index if not exists idx_production_orders_org_id on production_orders(org_id);
create index if not exists idx_production_orders_item_id on production_orders(item_id);
create index if not exists idx_production_orders_recipe_id on production_orders(recipe_id);
create index if not exists idx_production_orders_warehouse_id on production_orders(warehouse_id);
create index if not exists idx_production_orders_status on production_orders(status);
create index if not exists idx_production_orders_scheduled_date on production_orders(scheduled_date);
create index if not exists idx_production_order_consumptions_order_id on production_order_consumptions(order_id);
create index if not exists idx_production_order_consumptions_item_id on production_order_consumptions(item_id);
create index if not exists idx_production_lots_order_id on production_lots(order_id);
create index if not exists idx_production_lots_item_id on production_lots(item_id);

-- 6. Enable RLS and default policies
DO $$ 
DECLARE
    t text;
    tables_to_fix text[] := ARRAY[
        'catering_requests', 'catering_request_lines', 'recipes', 
        'recipe_ingredients', 'recipe_steps', 'production_orders', 
        'production_order_consumptions', 'production_lots'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_fix LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "Authenticated users can do everything" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;
