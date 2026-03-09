-- Milestone 2: Checklist Templates, Questions, Submissions

-- 3. Checklist Templates
create table if not exists checklist_templates (
  id uuid default uuid_generate_v4() primary key,
  venue_id uuid references venues(id),
  title text not null,
  description text,
  frequency text, -- 'daily', 'shift', 'weekly'
  prerequisite_template_id uuid references checklist_templates(id) null,
  created_at timestamp with time zone default now()
);

-- 4. Questions
create table if not exists questions (
  id uuid default uuid_generate_v4() primary key,
  template_id uuid references checklist_templates(id) on delete cascade,
  label text not null,
  type text check (type in (
    'check',
    'text',
    'number',
    'photo',
    'slider',
    'yes_no',
    'multi_option',
    'select'
  )),
  is_required boolean default true,
  config jsonb null,
  sort_order integer default 0
);

-- 5. Submissions
create table if not exists submissions (
  id uuid default uuid_generate_v4() primary key,
  template_id uuid references checklist_templates(id),
  user_id uuid references profiles(id),
  venue_id uuid references venues(id),
  shift text check (shift in ('morning', 'mid', 'closing')),
  status text check (status in ('draft', 'completed')) default 'draft',
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone null
);
