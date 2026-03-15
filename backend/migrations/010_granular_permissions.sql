-- backend/migrations/010_granular_permissions.sql
create table custom_roles (
  id          uuid default uuid_generate_v4() primary key,
  org_id      uuid references organizations(id) on delete cascade,
  name        text not null,
  description text,
  is_admin    boolean default false,
  created_at  timestamp with time zone default now()
);

create table permissions (
  id          uuid default uuid_generate_v4() primary key,
  module      text not null,
  action      text not null,
  key         text unique not null,
  description text
);

create table role_permissions (
  role_id       uuid references custom_roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table profile_roles (
  profile_id  uuid references profiles(id) on delete cascade unique,
  role_id     uuid references custom_roles(id) on delete cascade,
  primary key (profile_id)
);

create table profile_permission_overrides (
  profile_id    uuid references profiles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  granted       boolean not null,
  reason        text,
  created_by    uuid references profiles(id),
  created_at    timestamp with time zone default now(),
  primary key (profile_id, permission_id)
);
