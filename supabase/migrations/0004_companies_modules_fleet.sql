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
