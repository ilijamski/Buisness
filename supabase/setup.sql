-- Fuhrpark-Manager: komplettes Datenbank-Setup.
--
-- Alle Migrationen in der richtigen Reihenfolge, zusammengefasst zum
-- einmaligen Einfügen in den Supabase-SQL-Editor.
--
-- Gefahrlos wiederholbar: alles nutzt "if not exists" bzw. "create or replace".
-- Die Einzeldateien unter supabase/migrations/ bleiben maßgeblich, wenn du
-- später mit der Supabase-CLI arbeitest.


-- ===================================================================
-- 0001_init.sql
-- ===================================================================
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


-- ===================================================================
-- 0002_receipts.sql
-- ===================================================================
-- Fuhrpark-Manager: fuel/receipt photo upload via Supabase Storage.

-- ---------------------------------------------------------------------------
-- entries.receipt_path — path of the uploaded receipt within the
-- 'receipts' storage bucket, e.g. "<user_id>/<uuid>.jpg". Null if no
-- receipt was attached.
-- ---------------------------------------------------------------------------
alter table public.entries
  add column if not exists receipt_path text;

-- ---------------------------------------------------------------------------
-- Private storage bucket for receipt photos/PDFs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS on storage.objects, scoped to the 'receipts' bucket.
-- Uploads are namespaced by folder: "<auth.uid()>/<file>". Mitarbeiter may
-- only read/write inside their own folder; admins may read (and clean up)
-- everything, mirroring the entries table policies.
-- ---------------------------------------------------------------------------
drop policy if exists "receipts_select_own_or_admin" on storage.objects;
create policy "receipts_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_delete_admin_only" on storage.objects;
create policy "receipts_delete_admin_only"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts' and public.is_admin()
  );


-- ===================================================================
-- 0003_tuv_reminders.sql
-- ===================================================================
-- Fuhrpark-Manager: TÜV reminder tracking table.
--
-- The `tuv-reminder` Edge Function (supabase/functions/tuv-reminder) checks
-- daily for vehicles whose TÜV is due within the next 30 days and emails all
-- admins. This table records which (vehicle_id, tuv_date) pairs have already
-- been notified so a reminder is sent exactly once per due date, even if the
-- daily cron run is occasionally delayed or missed.

create table if not exists public.tuv_reminders (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  tuv_date   date not null,
  sent_at    timestamptz not null default now(),
  primary key (vehicle_id, tuv_date)
);

alter table public.tuv_reminders enable row level security;

-- Written by the Edge Function via the service role key (bypasses RLS).
-- Admins may read the log for visibility; no insert/update/delete policy is
-- needed for regular authenticated users.
drop policy if exists "tuv_reminders_select_admin_only" on public.tuv_reminders;
create policy "tuv_reminders_select_admin_only"
  on public.tuv_reminders for select
  to authenticated
  using (public.is_admin());

create index if not exists vehicles_tuv_date_idx on public.vehicles (tuv_date);


-- ===================================================================
-- 0004_companies_modules_fleet.sql
-- ===================================================================
-- Fuhrpark-Manager: Firmenkonten (Mandanten), Nummernsystem, Fahrerzuordnung,
-- optionale Fachdaten und Modul-Einstellungen.
--
-- Zugriffsmodell ab dieser Migration:
--   * Alles ist an eine Firma (company) gebunden.
--   * Admins sehen/verwalten alles innerhalb ihrer Firma.
--   * Mitarbeiter sehen ausschließlich Fahrzeuge, denen sie aktuell als
--     Fahrer zugewiesen sind (vehicle_assignments ohne ended_on).

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  join_code  text not null unique,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;

-- Kurzer, gut vorlesbarer Beitrittscode (ohne leicht verwechselbare Zeichen).
create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.companies where join_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: Firmenzugehörigkeit, Mitarbeiter-Nummer, Führerschein
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists company_id uuid references public.companies (id) on delete cascade,
  add column if not exists employee_number int,
  add column if not exists license_classes text,
  add column if not exists license_expires_on date,
  add column if not exists active boolean not null default true;

create unique index if not exists profiles_company_employee_number_idx
  on public.profiles (company_id, employee_number)
  where employee_number is not null;

-- ---------------------------------------------------------------------------
-- vehicles: Firmenzugehörigkeit, Fahrzeug-Nummer und alle optionalen
-- Fachfelder. Sämtliche Fachfelder sind nullable — welche davon überhaupt
-- angezeigt bzw. verpflichtend sind, steuern die Modul-Einstellungen.
-- ---------------------------------------------------------------------------
alter table public.vehicles
  add column if not exists company_id uuid references public.companies (id) on delete cascade,
  add column if not exists vehicle_number int,
  add column if not exists vin text,
  add column if not exists notes text,
  add column if not exists active boolean not null default true,
  -- Fristen & Prüfungen
  add column if not exists hu_date date,
  add column if not exists au_date date,
  add column if not exists uvv_date date,
  add column if not exists tachograph_date date,
  add column if not exists insurance_company text,
  add column if not exists insurance_policy_number text,
  add column if not exists insurance_expires_on date,
  add column if not exists registration_date date,
  add column if not exists season_plate_from text,
  add column if not exists season_plate_to text,
  -- Wartung & Technik
  add column if not exists current_mileage int,
  add column if not exists mileage_updated_at timestamptz,
  add column if not exists next_service_date date,
  add column if not exists next_service_mileage int,
  add column if not exists next_tire_change_date date,
  add column if not exists tire_type text,
  add column if not exists tread_depth_mm numeric(4, 1),
  add column if not exists next_brake_check_date date,
  -- Finanzen & Verwaltung
  add column if not exists leasing_provider text,
  add column if not exists leasing_end_date date,
  add column if not exists leasing_monthly_cost numeric(10, 2),
  add column if not exists tax_due_date date,
  add column if not exists tax_amount numeric(10, 2),
  add column if not exists purchase_value numeric(12, 2),
  add column if not exists purchase_date date,
  add column if not exists residual_value numeric(12, 2);

-- Bestandsdaten: das bisherige tuv_date wird zum HU-Termin.
update public.vehicles set hu_date = tuv_date where hu_date is null and tuv_date is not null;

-- Fahrzeug-Nummer: fortlaufend je Firma, automatisch beim Anlegen vergeben.
create unique index if not exists vehicles_company_vehicle_number_idx
  on public.vehicles (company_id, vehicle_number)
  where vehicle_number is not null;

-- Kennzeichen müssen nur innerhalb einer Firma eindeutig sein.
alter table public.vehicles drop constraint if exists vehicles_plate_key;
create unique index if not exists vehicles_company_plate_idx
  on public.vehicles (company_id, plate);

create or replace function public.assign_vehicle_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vehicle_number is null and new.company_id is not null then
    select coalesce(max(vehicle_number), 0) + 1
      into new.vehicle_number
      from public.vehicles
     where company_id = new.company_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_vehicle_created on public.vehicles;
create trigger on_vehicle_created
  before insert on public.vehicles
  for each row execute procedure public.assign_vehicle_number();

-- ---------------------------------------------------------------------------
-- vehicle_assignments: wer fährt aktuell welches Fahrzeug.
-- ended_on IS NULL = aktive Zuordnung. Historie bleibt erhalten.
-- ---------------------------------------------------------------------------
create table if not exists public.vehicle_assignments (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles (id) on delete cascade,
  driver_id   uuid not null references public.profiles (id) on delete cascade,
  started_on  date not null default current_date,
  ended_on    date,
  created_at  timestamptz not null default now()
);

alter table public.vehicle_assignments enable row level security;

-- Ein Fahrzeug hat höchstens einen aktiven Fahrer.
create unique index if not exists vehicle_assignments_active_vehicle_idx
  on public.vehicle_assignments (vehicle_id)
  where ended_on is null;

create index if not exists vehicle_assignments_driver_idx
  on public.vehicle_assignments (driver_id);

-- ---------------------------------------------------------------------------
-- Modul-Einstellungen.
-- Fehlende Zeile bedeutet: Standard (aktiv, nicht verpflichtend) bzw. auf
-- Fahrzeugebene "erbt Firmeneinstellung". Deshalb sind enabled/required auf
-- Fahrzeugebene bewusst nullable.
-- ---------------------------------------------------------------------------
create table if not exists public.company_module_settings (
  company_id uuid not null references public.companies (id) on delete cascade,
  module_key text not null,
  enabled    boolean not null default true,
  required   boolean not null default false,
  primary key (company_id, module_key)
);

alter table public.company_module_settings enable row level security;

create table if not exists public.vehicle_module_settings (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  module_key text not null,
  enabled    boolean,
  required   boolean,
  primary key (vehicle_id, module_key)
);

alter table public.vehicle_module_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen (security definer, um RLS-Rekursion zu vermeiden)
-- ---------------------------------------------------------------------------
create or replace function public.current_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- is_admin() aus 0001 zusätzlich auf "Admin mit Firma" schärfen.
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

-- Zugriff auf ein Fahrzeug: Admin derselben Firma oder aktuell zugewiesener Fahrer.
create or replace function public.can_access_vehicle(v_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.vehicles v
      join public.profiles p on p.id = auth.uid()
     where v.id = v_id
       and v.company_id = p.company_id
       and (
         p.role = 'admin'
         or exists (
           select 1 from public.vehicle_assignments a
            where a.vehicle_id = v.id
              and a.driver_id = p.id
              and a.ended_on is null
         )
       )
  );
$$;

-- ---------------------------------------------------------------------------
-- Registrierung: Firma gründen (Admin) oder per Code beitreten (Mitarbeiter).
-- Steuerung über raw_user_meta_data:
--   { company_name: 'Muster GmbH' }  -> neue Firma, Rolle admin
--   { join_code:    'ABCD2345'    }  -> Beitritt, Rolle mitarbeiter
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_name text := nullif(trim(new.raw_user_meta_data->>'company_name'), '');
  v_join_code    text := nullif(upper(trim(new.raw_user_meta_data->>'join_code')), '');
  v_company_id   uuid;
  v_role         text;
  v_number       int;
begin
  if v_company_name is not null then
    insert into public.companies (name, join_code)
    values (v_company_name, public.generate_join_code())
    returning id into v_company_id;
    v_role := 'admin';
  elsif v_join_code is not null then
    select id into v_company_id from public.companies where join_code = v_join_code;
    if v_company_id is null then
      raise exception 'Unbekannter Firmen-Code: %', v_join_code
        using errcode = 'check_violation';
    end if;
    v_role := coalesce(new.raw_user_meta_data->>'role', 'mitarbeiter');
    if v_role not in ('mitarbeiter', 'admin') then
      v_role := 'mitarbeiter';
    end if;
  else
    -- Ohne Firmenbezug wird kein Profil angelegt; der Login bleibt ohne
    -- Firma wirkungslos und die App leitet zur Registrierung zurück.
    return new;
  end if;

  select coalesce(max(employee_number), 0) + 1
    into v_number
    from public.profiles
   where company_id = v_company_id;

  insert into public.profiles (id, email, full_name, role, company_id, employee_number)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    v_role,
    v_company_id,
    v_number
  )
  on conflict (id) do update
    set company_id      = excluded.company_id,
        role            = excluded.role,
        employee_number = excluded.employee_number;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nachträgliches Onboarding: bestehendes Konto ohne Firma verbinden.
-- Greift, wenn jemand sich ohne Firmenangabe registriert hat (oder eingeladen
-- wurde) und die Firma erst beim ersten Login auswählt.
-- ---------------------------------------------------------------------------
create or replace function public.join_or_create_company(
  p_company_name text default null,
  p_join_code text default null,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_email      text;
  v_company_id uuid;
  v_role       text;
  v_number     int;
  v_existing   uuid;
begin
  if v_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;

  select company_id into v_existing from public.profiles where id = v_user_id;
  if v_existing is not null then
    return v_existing;
  end if;

  select email into v_email from auth.users where id = v_user_id;

  if nullif(trim(p_company_name), '') is not null then
    insert into public.companies (name, join_code)
    values (trim(p_company_name), public.generate_join_code())
    returning id into v_company_id;
    v_role := 'admin';
  elsif nullif(trim(p_join_code), '') is not null then
    select id into v_company_id
      from public.companies
     where join_code = upper(trim(p_join_code));
    if v_company_id is null then
      raise exception 'Unbekannter Firmen-Code' using errcode = 'check_violation';
    end if;
    v_role := 'mitarbeiter';
  else
    raise exception 'Firmenname oder Firmen-Code erforderlich' using errcode = 'check_violation';
  end if;

  select coalesce(max(employee_number), 0) + 1
    into v_number
    from public.profiles
   where company_id = v_company_id;

  insert into public.profiles (id, email, full_name, role, company_id, employee_number)
  values (v_user_id, v_email, nullif(trim(p_full_name), ''), v_role, v_company_id, v_number)
  on conflict (id) do update
    set company_id      = excluded.company_id,
        role            = excluded.role,
        employee_number = excluded.employee_number,
        full_name       = coalesce(public.profiles.full_name, excluded.full_name);

  return v_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: companies
-- ---------------------------------------------------------------------------
drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own"
  on public.companies for select
  to authenticated
  using (id = public.current_company_id());

drop policy if exists "companies_update_admin" on public.companies;
create policy "companies_update_admin"
  on public.companies for update
  to authenticated
  using (id = public.current_company_id() and public.is_admin())
  with check (id = public.current_company_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: profiles (jetzt firmenweit statt global)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or (company_id = public.current_company_id() and public.is_admin())
  );

drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or (company_id = public.current_company_id() and public.is_admin())
  )
  with check (
    id = auth.uid()
    or (company_id = public.current_company_id() and public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- RLS: vehicles — Admin sieht die Firmenflotte, Fahrer nur eigene Fahrzeuge.
-- ---------------------------------------------------------------------------
drop policy if exists "vehicles_select_authenticated" on public.vehicles;
create policy "vehicles_select_company_scoped"
  on public.vehicles for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and (
      public.is_admin()
      or exists (
        select 1 from public.vehicle_assignments a
         where a.vehicle_id = vehicles.id
           and a.driver_id = auth.uid()
           and a.ended_on is null
      )
    )
  );

drop policy if exists "vehicles_insert_admin_only" on public.vehicles;
create policy "vehicles_insert_admin_only"
  on public.vehicles for insert
  to authenticated
  with check (company_id = public.current_company_id() and public.is_admin());

drop policy if exists "vehicles_update_admin_only" on public.vehicles;
create policy "vehicles_update_admin_or_driver"
  on public.vehicles for update
  to authenticated
  using (company_id = public.current_company_id() and public.can_access_vehicle(id))
  with check (company_id = public.current_company_id() and public.can_access_vehicle(id));

drop policy if exists "vehicles_delete_admin_only" on public.vehicles;
create policy "vehicles_delete_admin_only"
  on public.vehicles for delete
  to authenticated
  using (company_id = public.current_company_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: entries — an den Fahrzeugzugriff gekoppelt.
-- Mitarbeiter: eigene Einträge auf eigenen Fahrzeugen. Admin: alles.
-- ---------------------------------------------------------------------------
drop policy if exists "entries_select_own_or_admin" on public.entries;
create policy "entries_select_own_or_admin"
  on public.entries for select
  to authenticated
  using (
    public.can_access_vehicle(vehicle_id)
    and (author_id = auth.uid() or public.is_admin())
  );

drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own"
  on public.entries for insert
  to authenticated
  with check (author_id = auth.uid() and public.can_access_vehicle(vehicle_id));

drop policy if exists "entries_update_admin_only" on public.entries;
create policy "entries_update_admin_only"
  on public.entries for update
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id))
  with check (public.is_admin() and public.can_access_vehicle(vehicle_id));

drop policy if exists "entries_delete_admin_only" on public.entries;
create policy "entries_delete_admin_only"
  on public.entries for delete
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id));

-- Weitere Eintragsarten zulassen (Reifen, Bremsen, Inspektion, Sonstiges).
alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries add constraint entries_type_check
  check (type in ('tanken', 'wartung', 'schaden', 'reifen', 'bremsen', 'inspektion', 'sonstiges'));

-- ---------------------------------------------------------------------------
-- RLS: vehicle_assignments
-- ---------------------------------------------------------------------------
drop policy if exists "vehicle_assignments_select" on public.vehicle_assignments;
create policy "vehicle_assignments_select"
  on public.vehicle_assignments for select
  to authenticated
  using (driver_id = auth.uid() or public.can_access_vehicle(vehicle_id));

drop policy if exists "vehicle_assignments_write_admin" on public.vehicle_assignments;
create policy "vehicle_assignments_write_admin"
  on public.vehicle_assignments for all
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id))
  with check (public.is_admin() and public.can_access_vehicle(vehicle_id));

-- ---------------------------------------------------------------------------
-- RLS: Modul-Einstellungen — alle Firmenmitglieder lesen, nur Admin schreibt.
-- ---------------------------------------------------------------------------
drop policy if exists "company_module_settings_select" on public.company_module_settings;
create policy "company_module_settings_select"
  on public.company_module_settings for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "company_module_settings_write_admin" on public.company_module_settings;
create policy "company_module_settings_write_admin"
  on public.company_module_settings for all
  to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());

drop policy if exists "vehicle_module_settings_select" on public.vehicle_module_settings;
create policy "vehicle_module_settings_select"
  on public.vehicle_module_settings for select
  to authenticated
  using (public.can_access_vehicle(vehicle_id));

drop policy if exists "vehicle_module_settings_write_admin" on public.vehicle_module_settings;
create policy "vehicle_module_settings_write_admin"
  on public.vehicle_module_settings for all
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id))
  with check (public.is_admin() and public.can_access_vehicle(vehicle_id));

-- ---------------------------------------------------------------------------
-- Beleg-Uploads: Zugriff zusätzlich an den Fahrzeugzugriff koppeln bleibt
-- unverändert (eigener Ordner je Nutzer), Admin sieht weiterhin alles.
-- ---------------------------------------------------------------------------
create index if not exists vehicles_company_idx on public.vehicles (company_id);
create index if not exists profiles_company_idx on public.profiles (company_id);


-- ===================================================================
-- 0005_logbook_documents.sql
-- ===================================================================
-- Fuhrpark-Manager: Fahrtenbuch, Werkstatt-Historie, Tankkarten und
-- Fahrzeugdokumente. Alle Tabellen hängen am Fahrzeugzugriff
-- (public.can_access_vehicle) und damit automatisch an Firma + Fahrerzuordnung.

-- ---------------------------------------------------------------------------
-- Fahrtenbuch / Kilometerprotokoll (steuerlich relevant: dienstlich vs. privat)
-- ---------------------------------------------------------------------------
create table if not exists public.logbook_entries (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid not null references public.vehicles (id) on delete cascade,
  driver_id      uuid not null references public.profiles (id) on delete cascade,
  date           date not null default current_date,
  start_mileage  int not null check (start_mileage >= 0),
  end_mileage    int not null check (end_mileage >= 0),
  trip_type      text not null default 'dienstlich' check (trip_type in ('dienstlich', 'privat', 'arbeitsweg')),
  start_location text,
  end_location   text,
  purpose        text,
  created_at     timestamptz not null default now(),
  constraint logbook_mileage_order check (end_mileage >= start_mileage)
);

alter table public.logbook_entries enable row level security;

create index if not exists logbook_vehicle_idx on public.logbook_entries (vehicle_id, date desc);

drop policy if exists "logbook_select_own_or_admin" on public.logbook_entries;
create policy "logbook_select_own_or_admin"
  on public.logbook_entries for select
  to authenticated
  using (
    public.can_access_vehicle(vehicle_id)
    and (driver_id = auth.uid() or public.is_admin())
  );

drop policy if exists "logbook_insert_own" on public.logbook_entries;
create policy "logbook_insert_own"
  on public.logbook_entries for insert
  to authenticated
  with check (driver_id = auth.uid() and public.can_access_vehicle(vehicle_id));

drop policy if exists "logbook_modify_admin" on public.logbook_entries;
create policy "logbook_modify_admin"
  on public.logbook_entries for delete
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id));

-- ---------------------------------------------------------------------------
-- Werkstatt-Historie / Reparaturprotokoll
-- ---------------------------------------------------------------------------
create table if not exists public.workshop_records (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references public.vehicles (id) on delete cascade,
  date         date not null default current_date,
  workshop     text,
  description  text not null,
  mileage      int,
  cost         numeric(10, 2) not null default 0 check (cost >= 0),
  invoice_path text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.workshop_records enable row level security;

create index if not exists workshop_vehicle_idx on public.workshop_records (vehicle_id, date desc);

drop policy if exists "workshop_select" on public.workshop_records;
create policy "workshop_select"
  on public.workshop_records for select
  to authenticated
  using (public.can_access_vehicle(vehicle_id));

drop policy if exists "workshop_write_admin" on public.workshop_records;
create policy "workshop_write_admin"
  on public.workshop_records for all
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id))
  with check (public.is_admin() and public.can_access_vehicle(vehicle_id));

-- ---------------------------------------------------------------------------
-- Tankkarten
-- ---------------------------------------------------------------------------
create table if not exists public.fuel_cards (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  provider    text not null,
  card_number text not null,
  pin_hint    text,
  vehicle_id  uuid references public.vehicles (id) on delete set null,
  valid_until date,
  created_at  timestamptz not null default now()
);

alter table public.fuel_cards enable row level security;

drop policy if exists "fuel_cards_select" on public.fuel_cards;
create policy "fuel_cards_select"
  on public.fuel_cards for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and (
      public.is_admin()
      or (vehicle_id is not null and public.can_access_vehicle(vehicle_id))
    )
  );

drop policy if exists "fuel_cards_write_admin" on public.fuel_cards;
create policy "fuel_cards_write_admin"
  on public.fuel_cards for all
  to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- Fahrzeugdokumente (Fahrzeugschein/-brief, Nachweise für Zusatzausrüstung …)
-- Datei liegt im Storage-Bucket 'documents' unter "<vehicle_id>/<uuid>.<ext>".
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles (id) on delete cascade,
  kind        text not null default 'sonstiges'
              check (kind in ('fahrzeugschein', 'fahrzeugbrief', 'versicherung',
                              'leasingvertrag', 'nachweis', 'sonstiges')),
  title       text not null,
  file_path   text not null,
  valid_until date,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.documents enable row level security;

create index if not exists documents_vehicle_idx on public.documents (vehicle_id, created_at desc);

drop policy if exists "documents_select" on public.documents;
create policy "documents_select"
  on public.documents for select
  to authenticated
  using (public.can_access_vehicle(vehicle_id));

drop policy if exists "documents_insert" on public.documents;
create policy "documents_insert"
  on public.documents for insert
  to authenticated
  with check (public.can_access_vehicle(vehicle_id));

drop policy if exists "documents_delete_admin" on public.documents;
create policy "documents_delete_admin"
  on public.documents for delete
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id));

-- ---------------------------------------------------------------------------
-- Storage-Bucket für Dokumente. Pfad: "<vehicle_id>/<uuid>.<ext>", damit die
-- Policy den Fahrzeugzugriff direkt aus dem ersten Ordnersegment ableiten kann.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and public.can_access_vehicle(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and public.can_access_vehicle(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "documents_storage_delete" on storage.objects;
create policy "documents_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_admin()
    and public.can_access_vehicle(((storage.foldername(name))[1])::uuid)
  );


-- ===================================================================
-- 0006_reminders.sql
-- ===================================================================
-- Fuhrpark-Manager: Erinnerungen für alle Fristen-Module (nicht mehr nur TÜV).
--
-- Die alte Tabelle tuv_reminders wird durch reminder_log ersetzt, das
-- zusätzlich das Modul (hu, au, uvv, …) und Führerschein-Erinnerungen abdeckt.

create table if not exists public.reminder_log (
  subject_type text not null check (subject_type in ('vehicle', 'profile')),
  subject_id   uuid not null,
  module_key   text not null,
  due_date     date not null,
  sent_at      timestamptz not null default now(),
  primary key (subject_type, subject_id, module_key, due_date)
);

alter table public.reminder_log enable row level security;

-- Geschrieben wird ausschließlich von der Edge Function per Service-Role-Key
-- (umgeht RLS). Admins dürfen den Verlauf ihrer Firma einsehen.
drop policy if exists "reminder_log_select_admin" on public.reminder_log;
create policy "reminder_log_select_admin"
  on public.reminder_log for select
  to authenticated
  using (
    public.is_admin()
    and (
      (subject_type = 'vehicle' and exists (
        select 1 from public.vehicles v
         where v.id = reminder_log.subject_id
           and v.company_id = public.current_company_id()
      ))
      or (subject_type = 'profile' and exists (
        select 1 from public.profiles p
         where p.id = reminder_log.subject_id
           and p.company_id = public.current_company_id()
      ))
    )
  );

-- Bestehende TÜV-Erinnerungen übernehmen, damit nach dem Update keine
-- Dubletten für bereits gemeldete Termine verschickt werden.
insert into public.reminder_log (subject_type, subject_id, module_key, due_date, sent_at)
select 'vehicle', vehicle_id, 'hu', tuv_date, sent_at
  from public.tuv_reminders
on conflict do nothing;

drop table if exists public.tuv_reminders;

create index if not exists profiles_license_expiry_idx
  on public.profiles (license_expires_on)
  where license_expires_on is not null;


-- ===================================================================
-- 0007_settings.sql
-- ===================================================================
-- Fuhrpark-Manager: Benutzer-Präferenzen und erweiterte Firmeneinstellungen.

-- ---------------------------------------------------------------------------
-- Persönliche Einstellungen je Konto.
-- Fehlende Zeile = Standardwerte (siehe DEFAULT_USER_SETTINGS in src/lib/settings.ts).
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  theme              text not null default 'light' check (theme in ('light', 'dark', 'system')),
  email_reminders    boolean not null default true,
  default_trip_type  text not null default 'dienstlich'
                     check (default_trip_type in ('dienstlich', 'privat', 'arbeitsweg')),
  compact_lists      boolean not null default false,
  updated_at         timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- Jeder verwaltet ausschließlich seine eigenen Einstellungen.
drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_settings_write_own" on public.user_settings;
create policy "user_settings_write_own"
  on public.user_settings for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Firmeneinstellungen: Vorlaufzeit für Erinnerungen und Kontaktangaben
-- (letztere füllen die Platzhalter in Impressum/Datenschutz).
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists reminder_lead_days int not null default 30
    check (reminder_lead_days between 1 and 365),
  add column if not exists contact_email text,
  add column if not exists contact_address text;

-- ---------------------------------------------------------------------------
-- Kontolöschung: Vorabprüfung, ob das Konto gelöscht werden darf.
-- Der letzte Admin einer Firma mit weiteren Mitgliedern darf nicht gehen,
-- sonst bliebe die Firma ohne Verwaltung zurück.
-- ---------------------------------------------------------------------------
create or replace function public.can_delete_own_account()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id    uuid := auth.uid();
  v_company_id uuid;
  v_role       text;
  v_admins     int;
  v_members    int;
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'Nicht angemeldet.');
  end if;

  select company_id, role into v_company_id, v_role
    from public.profiles where id = v_user_id;

  if v_company_id is null then
    return jsonb_build_object('allowed', true, 'deletes_company', false);
  end if;

  select count(*) filter (where role = 'admin'), count(*)
    into v_admins, v_members
    from public.profiles
   where company_id = v_company_id;

  if v_role = 'admin' and v_admins = 1 and v_members > 1 then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'Du bist der einzige Admin dieser Firma. Ernenne zuerst einen weiteren Admin.'
    );
  end if;

  -- Letztes Mitglied: mit dem Konto verschwindet auch die Firma samt Daten.
  return jsonb_build_object('allowed', true, 'deletes_company', v_members = 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rollenwechsel innerhalb der Firma (damit ein Admin einen Nachfolger
-- ernennen kann, bevor er sein Konto löscht).
-- ---------------------------------------------------------------------------
create or replace function public.set_member_role(p_profile_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if p_role not in ('admin', 'mitarbeiter') then
    raise exception 'Ungültige Rolle' using errcode = 'check_violation';
  end if;

  select company_id into v_company_id from public.profiles where id = auth.uid();

  if v_company_id is null or not public.is_admin() then
    raise exception 'Nur Admins dürfen Rollen ändern' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = p_profile_id and company_id = v_company_id
  ) then
    raise exception 'Mitarbeiter gehört nicht zu dieser Firma' using errcode = 'check_violation';
  end if;

  -- Den letzten Admin nicht zum Mitarbeiter degradieren.
  if p_role = 'mitarbeiter'
     and (select count(*) from public.profiles
           where company_id = v_company_id and role = 'admin') <= 1
     and (select role from public.profiles where id = p_profile_id) = 'admin' then
    raise exception 'Die Firma braucht mindestens einen Admin'
      using errcode = 'check_violation';
  end if;

  update public.profiles set role = p_role where id = p_profile_id;
end;
$$;


-- ===================================================================
-- 0008_corrections_push_invites.sql
-- ===================================================================
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


-- ===================================================================
-- 0009_billing.sql
-- ===================================================================
-- Fuhrpark-Manager: Abo, Probemonat und Testcodes.
--
-- Abgerechnet wird je Firma, nicht je Nutzer: Ein Fuhrpark kauft ein Abo,
-- alle Mitarbeiter dieser Firma arbeiten damit.

-- ---------------------------------------------------------------------------
-- Abo-Zustand an der Firma.
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  add column if not exists plan text
    check (plan in ('monthly', 'yearly')),
  -- Ende des Probemonats bzw. des per Code verlängerten Gratiszeitraums.
  add column if not exists trial_ends_at timestamptz,
  -- Ende des bezahlten Zeitraums (kommt vom Zahlungsanbieter).
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create unique index if not exists companies_stripe_customer_idx
  on public.companies (stripe_customer_id)
  where stripe_customer_id is not null;

-- Bestandsfirmen und alle neuen Firmen bekommen einen Probemonat.
update public.companies
   set trial_ends_at = coalesce(trial_ends_at, created_at + interval '30 days');

alter table public.companies
  alter column trial_ends_at set default (now() + interval '30 days');

-- ---------------------------------------------------------------------------
-- Testcodes.
--
-- Die Tabelle hat bewusst KEINE Select-Policy für normale Nutzer: Codes sind
-- nur über die Einlöse-Funktion prüfbar, niemand kann die Liste auslesen oder
-- gültige Codes erraten, indem er die Tabelle abfragt.
-- ---------------------------------------------------------------------------
create table if not exists public.promo_codes (
  code        text primary key,
  grants_days int not null default 30 check (grants_days between 1 and 3650),
  max_uses    int not null default 1 check (max_uses >= 1),
  used_count  int not null default 0,
  note        text,
  expires_at  timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

-- Protokoll, damit eine Firma denselben Code nicht mehrfach einlöst.
create table if not exists public.promo_redemptions (
  code        text not null references public.promo_codes (code) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  redeemed_by uuid references public.profiles (id) on delete set null,
  redeemed_at timestamptz not null default now(),
  primary key (code, company_id)
);

alter table public.promo_redemptions enable row level security;

drop policy if exists "promo_redemptions_select_own_company" on public.promo_redemptions;
create policy "promo_redemptions_select_own_company"
  on public.promo_redemptions for select
  to authenticated
  using (company_id = public.current_company_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- Plattform-Admins: der Betreiber der App, nicht die Fuhrpark-Admins.
-- Wird manuell befüllt:
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'deine@adresse.de';
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

drop policy if exists "platform_admins_self_select" on public.platform_admins;
create policy "platform_admins_self_select"
  on public.platform_admins for select
  to authenticated
  using (user_id = auth.uid());

-- Nur Plattform-Admins sehen die Codeliste.
drop policy if exists "promo_codes_platform_admin" on public.promo_codes;
create policy "promo_codes_platform_admin"
  on public.promo_codes for select
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Code einlösen: verlängert den Gratiszeitraum der eigenen Firma.
-- Läuft als security definer, damit die Prüfung möglich ist, ohne den
-- Nutzern Leserechte auf promo_codes zu geben.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code       text := upper(trim(p_code));
  v_company_id uuid;
  v_promo      public.promo_codes%rowtype;
  v_base       timestamptz;
  v_new_end    timestamptz;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Nur Admins können Codes einlösen.');
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'error', 'Keine Firma zugeordnet.');
  end if;

  select * into v_promo from public.promo_codes where code = v_code;

  -- Bewusst dieselbe Meldung für "unbekannt", "inaktiv" und "aufgebraucht":
  -- sonst ließe sich über die Fehlermeldung herausfinden, welche Codes existieren.
  if v_promo.code is null
     or not v_promo.active
     or (v_promo.expires_at is not null and v_promo.expires_at < now())
     or v_promo.used_count >= v_promo.max_uses then
    return jsonb_build_object('ok', false, 'error', 'Dieser Code ist ungültig oder bereits aufgebraucht.');
  end if;

  if exists (
    select 1 from public.promo_redemptions
     where code = v_code and company_id = v_company_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Dieser Code wurde von euch bereits eingelöst.');
  end if;

  -- An einen noch laufenden Gratiszeitraum anhängen, sonst ab jetzt rechnen.
  select greatest(coalesce(trial_ends_at, now()), now())
    into v_base
    from public.companies
   where id = v_company_id;

  v_new_end := v_base + make_interval(days => v_promo.grants_days);

  update public.companies
     set trial_ends_at = v_new_end,
         subscription_status = case
           when subscription_status = 'active' then subscription_status
           else 'trialing'
         end
   where id = v_company_id;

  update public.promo_codes
     set used_count = used_count + 1
   where code = v_code;

  insert into public.promo_redemptions (code, company_id, redeemed_by)
  values (v_code, v_company_id, auth.uid());

  return jsonb_build_object(
    'ok', true,
    'days', v_promo.grants_days,
    'trial_ends_at', v_new_end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Codes erzeugen — ausschließlich für Plattform-Admins.
-- ---------------------------------------------------------------------------
create or replace function public.create_promo_code(
  p_grants_days int default 30,
  p_max_uses int default 1,
  p_note text default null,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  if not public.is_platform_admin() then
    raise exception 'Nicht berechtigt' using errcode = 'insufficient_privilege';
  end if;

  loop
    v_code := 'TEST-';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.promo_codes where code = v_code);
  end loop;

  insert into public.promo_codes (code, grants_days, max_uses, note, expires_at)
  values (v_code, p_grants_days, p_max_uses, p_note, p_expires_at);

  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zugangsprüfung: hat die Firma gerade Zugriff?
-- Genutzt von der App und damit die einzige Wahrheit über den Zugang.
-- ---------------------------------------------------------------------------
create or replace function public.company_has_access(p_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.companies c
     where c.id = p_company_id
       and (
         -- Bezahlt und Zeitraum läuft noch (Kulanz bis Periodenende).
         (c.subscription_status = 'active'
           and (c.current_period_end is null or c.current_period_end > now()))
         -- Zahlung hakt, Zeitraum aber noch nicht abgelaufen.
         or (c.subscription_status = 'past_due' and c.current_period_end > now())
         -- Probemonat oder per Code verlängerter Gratiszeitraum.
         or (c.trial_ends_at is not null and c.trial_ends_at > now())
       )
  );
$$;


-- ===================================================================
-- 0010_platform_owner.sql
-- ===================================================================
-- Fuhrpark-Manager: Betreiber-Zugang.
--
-- Ein Auth-Konto lässt sich hier bewusst NICHT direkt anlegen: Passwörter
-- gehören nicht in eine Migration im Git-Verlauf, und Supabase pflegt neben
-- auth.users noch auth.identities und interne Felder, deren Aufbau sich
-- zwischen Versionen ändert.
--
-- Stattdessen eine Freigabeliste: Wer sich mit einer dort eingetragenen
-- Adresse registriert — per E-Mail, Google oder Apple —, wird automatisch
-- Plattform-Admin. Das funktioniert unabhängig davon, ob das Konto schon
-- existiert oder erst später angelegt wird.

create table if not exists public.platform_admin_emails (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.platform_admin_emails enable row level security;

-- Niemand darf die Liste über die App lesen oder ändern; sie wird
-- ausschließlich per Migration bzw. SQL-Editor gepflegt.
-- (RLS aktiv ohne Policy = kein Zugriff für authenticated/anon.)

-- Betreiber eintragen.
insert into public.platform_admin_emails (email, note)
values ('ilija.mski@gmail.com', 'Betreiber')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- Bereits registrierte Konten nachtragen.
-- ---------------------------------------------------------------------------
insert into public.platform_admins (user_id)
select u.id
  from auth.users u
  join public.platform_admin_emails a on lower(a.email) = lower(u.email)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Künftige Registrierungen automatisch freischalten.
-- ---------------------------------------------------------------------------
create or replace function public.promote_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.platform_admin_emails
     where lower(email) = lower(new.email)
  ) then
    insert into public.platform_admins (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_platform_admin on auth.users;
create trigger on_auth_user_platform_admin
  after insert on auth.users
  for each row execute procedure public.promote_platform_admin();

-- ---------------------------------------------------------------------------
-- Der Betreiber soll nicht sein eigenes Produkt bezahlen müssen und darf
-- nicht aus der eigenen Firma ausgesperrt werden, wenn der Probemonat endet.
-- Firmen mit einem Plattform-Admin als Mitglied haben deshalb dauerhaft Zugang.
-- ---------------------------------------------------------------------------
create or replace function public.company_has_access(p_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.companies c
     where c.id = p_company_id
       and (
         -- Bezahlt und Zeitraum läuft noch.
         (c.subscription_status = 'active'
           and (c.current_period_end is null or c.current_period_end > now()))
         -- Zahlung hakt, Zeitraum aber noch nicht abgelaufen.
         or (c.subscription_status = 'past_due' and c.current_period_end > now())
         -- Probemonat oder per Code verlängerter Gratiszeitraum.
         or (c.trial_ends_at is not null and c.trial_ends_at > now())
         -- Firma des Betreibers.
         or exists (
           select 1
             from public.profiles p
             join public.platform_admins pa on pa.user_id = p.id
            where p.company_id = c.id
         )
       )
  );
$$;


-- ===================================================================
-- 0011_platform_stats.sql
-- ===================================================================
-- Fuhrpark-Manager: Auswertung für den Betreiber.
--
-- Die normale RLS lässt niemanden über die eigene Firma hinausschauen — das
-- soll auch so bleiben. Statt dem Betreiber pauschal Leserechte auf alle
-- Kundendaten zu geben, liefern zwei security-definer-Funktionen genau das,
-- was für den Geschäftsbetrieb nötig ist: aggregierte Kennzahlen und eine
-- Kundenliste mit Vertragsdaten. Fahrzeugdetails, Fahrtenbücher, Belege und
-- Mitarbeiterdaten der Kunden bleiben unerreichbar.

-- ---------------------------------------------------------------------------
-- Kennzahlen.
--
-- Preise sind Bruttopreise (inkl. 19 % USt.). Ausgewiesen wird beides:
-- brutto = was abgebucht wird, netto = was tatsächlich beim Betreiber bleibt.
-- ---------------------------------------------------------------------------
create or replace function public.platform_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_monthly_gross_cents constant numeric := 1990;
  v_yearly_gross_cents  constant numeric := 20990;
  v_vat_rate            constant numeric := 0.19;

  v_paying_monthly int;
  v_paying_yearly  int;
  v_mrr_gross      numeric;
  v_result         jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Nicht berechtigt' using errcode = 'insufficient_privilege';
  end if;

  -- Zahlend = aktives Abo, dessen Zeitraum noch läuft.
  select
    count(*) filter (where plan = 'monthly'),
    count(*) filter (where plan = 'yearly')
  into v_paying_monthly, v_paying_yearly
  from public.companies
  where subscription_status = 'active'
    and (current_period_end is null or current_period_end > now());

  -- Jahresabos anteilig auf den Monat umgelegt.
  v_mrr_gross := v_paying_monthly * v_monthly_gross_cents
               + v_paying_yearly * (v_yearly_gross_cents / 12);

  select jsonb_build_object(
    'companies_total',      count(*),
    'companies_paying',     count(*) filter (
                              where subscription_status = 'active'
                                and (current_period_end is null or current_period_end > now())
                            ),
    'companies_trialing',   count(*) filter (
                              where subscription_status <> 'active'
                                and trial_ends_at is not null
                                and trial_ends_at > now()
                            ),
    'companies_past_due',   count(*) filter (where subscription_status = 'past_due'),
    'companies_expired',    count(*) filter (
                              where not public.company_has_access(id)
                            ),
    'companies_canceling',  count(*) filter (
                              where cancel_at_period_end
                                and subscription_status = 'active'
                            ),
    'new_companies_30d',    count(*) filter (where created_at > now() - interval '30 days'),
    'new_companies_prev30d', count(*) filter (
                              where created_at > now() - interval '60 days'
                                and created_at <= now() - interval '30 days'
                            ),
    'plan_monthly',         v_paying_monthly,
    'plan_yearly',          v_paying_yearly
  )
  into v_result
  from public.companies;

  return v_result
    || jsonb_build_object(
         'mrr_gross_cents', round(v_mrr_gross),
         'mrr_net_cents',   round(v_mrr_gross / (1 + v_vat_rate)),
         'arr_gross_cents', round(v_mrr_gross * 12),
         'arr_net_cents',   round(v_mrr_gross * 12 / (1 + v_vat_rate)),
         'users_total',     (select count(*) from public.profiles),
         'vehicles_total',  (select count(*) from public.vehicles),
         'codes_redeemed',  (select count(*) from public.promo_redemptions)
       );
end;
$$;

-- ---------------------------------------------------------------------------
-- Kundenliste: Vertragsdaten, keine Inhalte.
-- ---------------------------------------------------------------------------
create or replace function public.platform_companies()
returns table (
  id                  uuid,
  name                text,
  subscription_status text,
  plan                text,
  trial_ends_at       timestamptz,
  current_period_end  timestamptz,
  cancel_at_period_end boolean,
  has_access          boolean,
  user_count          bigint,
  vehicle_count       bigint,
  created_at          timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Nicht berechtigt' using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      c.id,
      c.name,
      c.subscription_status,
      c.plan,
      c.trial_ends_at,
      c.current_period_end,
      c.cancel_at_period_end,
      public.company_has_access(c.id),
      (select count(*) from public.profiles p where p.company_id = c.id),
      (select count(*) from public.vehicles v where v.company_id = c.id),
      c.created_at
    from public.companies c
    order by c.created_at desc;
end;
$$;
