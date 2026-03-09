-- 2. Organizaciones y Sedes
create table if not exists organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null
);

create table if not exists venues (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references organizations(id),
  name text not null,
  address text
);

-- 1. Perfiles (Extiende Auth.Users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('admin', 'staff')),
  organization_id uuid references organizations(id)
);
