-- Fuhrpark-Manager: Korrekturen eigener Einträge, Push-Abos, Einladungslinks.

-- ---------------------------------------------------------------------------
-- Eigene Einträge korrigieren.
-- Ein Tippfehler beim Kilometerstand soll nicht den Admin beschäftigen.
-- Fenster: 24 Stunden ab Erstellung — danach zählt der Eintrag als Beleg und
-- nur noch Admins dürfen eingreifen (steuerliche Nachvollziehbarkeit).
-- ---------------------------------------------------------------------------
create or replace function public.within_correction_window(created timestamptz)
returns boolean
language sql
immutable
as $$
  select created > now() - interval '24 hours';
$$;

drop policy if exists "entries_update_admin_only" on public.entries;
create policy "entries_update_own_recent_or_admin"
  on public.entries for update
  to authenticated
  using (
    public.can_access_vehicle(vehicle_id)
    and (
      public.is_admin()
      or (author_id = auth.uid() and public.within_correction_window(created_at))
    )
  )
  with check (
    public.can_access_vehicle(vehicle_id)
    and (
      public.is_admin()
      or (author_id = auth.uid() and public.within_correction_window(created_at))
    )
  );

drop policy if exists "entries_delete_admin_only" on public.entries;
create policy "entries_delete_own_recent_or_admin"
  on public.entries for delete
  to authenticated
  using (
    public.can_access_vehicle(vehicle_id)
    and (
      public.is_admin()
      or (author_id = auth.uid() and public.within_correction_window(created_at))
    )
  );

drop policy if exists "logbook_modify_admin" on public.logbook_entries;
create policy "logbook_delete_own_recent_or_admin"
  on public.logbook_entries for delete
  to authenticated
  using (
    public.can_access_vehicle(vehicle_id)
    and (
      public.is_admin()
      or (driver_id = auth.uid() and public.within_correction_window(created_at))
    )
  );

drop policy if exists "logbook_update_own_recent_or_admin" on public.logbook_entries;
create policy "logbook_update_own_recent_or_admin"
  on public.logbook_entries for update
  to authenticated
  using (
    public.can_access_vehicle(vehicle_id)
    and (
      public.is_admin()
      or (driver_id = auth.uid() and public.within_correction_window(created_at))
    )
  )
  with check (
    public.can_access_vehicle(vehicle_id)
    and (
      public.is_admin()
      or (driver_id = auth.uid() and public.within_correction_window(created_at))
    )
  );

-- ---------------------------------------------------------------------------
-- Push-Abonnements (Web Push und native Tokens).
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text not null default 'web' check (platform in ('web', 'ios', 'android')),
  -- Web Push: Endpoint-URL. Nativ: Gerätetoken.
  endpoint   text not null,
  p256dh     text,
  auth       text,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (endpoint)
);

alter table public.push_subscriptions enable row level security;

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Push-Benachrichtigungen lassen sich getrennt von E-Mail abschalten.
alter table public.user_settings
  add column if not exists push_reminders boolean not null default true;
