-- Fuhrpark-Manager: initial schema, roles, and RLS policies
-- Run this against your Supabase project (SQL Editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, carries the role ('mitarbeiter' | 'admin')
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'mitarbeiter' check (role in ('mitarbeiter', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
create table if not exists public.vehicles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  plate      text not null unique,
  type       text,
  tuv_date   date,
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;

-- ---------------------------------------------------------------------------
-- entries: fuel-ups / maintenance / damage log entries per vehicle
-- ---------------------------------------------------------------------------
create table if not exists public.entries (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  type       text not null check (type in ('tanken', 'wartung', 'schaden')),
  cost       numeric(10, 2) not null default 0 check (cost >= 0),
  note       text,
  date       date not null default current_date,
  author_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create index if not exists entries_vehicle_id_idx on public.entries (vehicle_id);
create index if not exists entries_author_id_idx on public.entries (author_id);
create index if not exists entries_date_idx on public.entries (date);

-- ---------------------------------------------------------------------------
-- Helper: is_admin() — security definer so it can read profiles without
-- triggering RLS recursion when used inside profiles' own policies.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Trigger: create a profile row automatically when a new auth user signs up.
-- Role defaults to 'mitarbeiter' unless raw_user_meta_data->>'role' is set
-- (e.g. passed as { data: { role: 'admin' } } during sign-up / invite).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'mitarbeiter')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS policies: profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS policies: vehicles
-- ---------------------------------------------------------------------------
drop policy if exists "vehicles_select_authenticated" on public.vehicles;
create policy "vehicles_select_authenticated"
  on public.vehicles for select
  to authenticated
  using (true);

drop policy if exists "vehicles_insert_admin_only" on public.vehicles;
create policy "vehicles_insert_admin_only"
  on public.vehicles for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "vehicles_update_admin_only" on public.vehicles;
create policy "vehicles_update_admin_only"
  on public.vehicles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "vehicles_delete_admin_only" on public.vehicles;
create policy "vehicles_delete_admin_only"
  on public.vehicles for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS policies: entries
-- Mitarbeiter: may create entries for themselves and see only their own.
-- Admin: sees and manages everything.
-- ---------------------------------------------------------------------------
drop policy if exists "entries_select_own_or_admin" on public.entries;
create policy "entries_select_own_or_admin"
  on public.entries for select
  to authenticated
  using (author_id = auth.uid() or public.is_admin());

drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own"
  on public.entries for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "entries_update_admin_only" on public.entries;
create policy "entries_update_admin_only"
  on public.entries for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "entries_delete_admin_only" on public.entries;
create policy "entries_delete_admin_only"
  on public.entries for delete
  to authenticated
  using (public.is_admin());
