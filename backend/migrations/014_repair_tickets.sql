-- backend/migrations/014_repair_tickets.sql
-- M9: Tickets de Reparación Multi-visita

-- 1. Ticket de reparación (uno por falla, puede tener múltiples entradas)
create table if not exists repair_tickets (
  id            uuid default uuid_generate_v4() primary key,
  asset_id      uuid references assets(id) on delete cascade,
  opened_by     uuid references profiles(id),
  closed_by     uuid references profiles(id),
  title         text not null,
  status        text check (status in (
    'abierto',
    'en_progreso',
    'esperando',
    'resuelto'
  )) default 'abierto',
  priority      text check (priority in ('baja', 'media', 'alta', 'critica')) default 'media',
  opened_at     timestamp with time zone default now(),
  closed_at     timestamp with time zone
);

-- 2. Entradas del ticket (historial cronológico)
create table if not exists repair_ticket_entries (
  id            uuid default uuid_generate_v4() primary key,
  ticket_id     uuid references repair_tickets(id) on delete cascade,
  created_by    uuid references profiles(id),
  type          text check (type in (
    'visita',
    'presupuesto',
    'compra',
    'nota',
    'cierre'
  )),
  description   text not null,
  technician    text,
  cost          numeric(10,2),
  attachments   jsonb,
  next_action   text,
  status_after  text check (status_after in ('abierto','en_progreso','esperando','resuelto')),
  created_at    timestamp with time zone default now()
);

-- 3. Vista: costo total por ticket
create or replace view v_repair_ticket_costs as
select
  t.id as ticket_id,
  t.asset_id,
  t.title,
  t.status,
  t.priority,
  t.opened_at,
  t.closed_at,
  coalesce(sum(e.cost), 0) as total_cost,
  count(e.id) filter (where e.type = 'visita') as visit_count,
  count(e.id) as entry_count
from repair_tickets t
left join repair_ticket_entries e on e.ticket_id = t.id
group by t.id;

-- 4. Índices
create index if not exists idx_tickets_asset   on repair_tickets(asset_id);
create index if not exists idx_tickets_status  on repair_tickets(status);
create index if not exists idx_entries_ticket  on repair_ticket_entries(ticket_id);
