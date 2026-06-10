-- backend/migrations/030_stock_movements_peps.sql

-- Permisos adicionales
INSERT INTO permissions (module, action, key, description) VALUES
  ('inventory', 'receive', 'inventory.receive', 'Registrar ingresos de mercancía'),
  ('inventory', 'issue', 'inventory.issue', 'Registrar salidas y mermas'),
  ('inventory', 'view_kardex', 'inventory.view_kardex', 'Ver historial detallado de movimientos (Kardex)')
ON CONFLICT (key) DO NOTHING;

-- Lotes de inventario (para PEPS/FIFO y trazabilidad)
create table if not exists stock_lots (
  id              uuid default uuid_generate_v4() primary key,
  warehouse_id    uuid references warehouses(id) on delete cascade,
  item_id         uuid references items(id) on delete cascade,
  lot_number      text,
  qty_base        numeric(18, 6) not null,
  unit_cost_base  numeric(18, 6) not null,
  production_date date,
  expiry_date     date,
  received_at     timestamp with time zone default now(),
  is_exhausted    boolean default false
);

create index if not exists idx_stock_lots_fifo on stock_lots(item_id, warehouse_id, received_at) where not is_exhausted;

-- Kardex de movimientos
create table if not exists stock_movements (
  id                  uuid default uuid_generate_v4() primary key,
  org_id              uuid references organizations(id) on delete cascade,
  movement_type       text check (movement_type in (
    'purchase', 'production_in', 'production_out', 'sale', 'transfer_out', 'transfer_in', 'adjustment_in', 'adjustment_out', 'initial'
  )),
  warehouse_id        uuid references warehouses(id) on delete cascade,
  item_id             uuid references items(id) on delete cascade,
  lot_id              uuid references stock_lots(id) on delete set null,
  qty_base            numeric(18, 6) not null,
  unit_cost_base      numeric(18, 6),
  total_cost          numeric(18, 6),
  reference_id        uuid,
  reference_type      text,
  notes               text,
  created_by          uuid references profiles(id),
  created_at          timestamp with time zone default now()
);

-- Documentos de Ingreso (Compras)
create table if not exists purchase_receipts (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  warehouse_id    uuid references warehouses(id) on delete cascade,
  supplier        text,
  receipt_number  text,
  status          text check (status in ('draft', 'confirmed')) default 'draft',
  created_by      uuid references profiles(id),
  confirmed_at    timestamp with time zone,
  created_at      timestamp with time zone default now()
);

create table if not exists purchase_receipt_lines (
  id              uuid default uuid_generate_v4() primary key,
  receipt_id      uuid references purchase_receipts(id) on delete cascade,
  item_id         uuid references items(id) on delete cascade,
  qty_base        numeric(18, 6) not null,
  presentation_id uuid references uom_presentations(id),
  qty_presentation numeric(18, 6),
  unit_cost_base  numeric(18, 6) not null,
  expiry_date     date,
  lot_number      text
);
