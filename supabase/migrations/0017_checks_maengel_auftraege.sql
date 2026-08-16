-- Fahrzeugcheck, Mängel und Aufträge.
--
-- Drei Bausteine, die zusammengehören und in dieser Reihenfolge ineinander
-- greifen — so arbeitet auch Webfleet Vehicle Check:
--
--   1. Der Fahrer geht vor der Fahrt eine Checkliste durch (Abfahrtskontrolle).
--   2. Wo er einen Mangel ankreuzt, entsteht daraus ein Mangel-Eintrag mit
--      Foto und Notiz — nicht als Nebenprodukt, sondern als eigener Vorgang
--      mit Status, damit er nicht in einer Liste alter Checks verschwindet.
--   3. Aufträge sind davon unabhängig: was ein Fahrer am Tag zu erledigen
--      hat, mit Fahrzeug, Adresse und Termin.
--
-- Alles hängt wie die übrigen Fahrzeugtabellen an can_access_vehicle() und
-- damit automatisch an Firma und Fahrerzuordnung: ein Fahrer sieht die
-- Checks und Mängel seines Fahrzeugs, der Firmen-Admin die der ganzen Flotte.

-- ---------------------------------------------------------------------------
-- Getankte Menge als Zahl
-- ---------------------------------------------------------------------------
-- Der Belegscanner liest die Literzahl längst aus dem Foto, hat sie bisher
-- aber nur in den Notiztext geschrieben. Damit ließ sich weder ein Verbrauch
-- noch eine CO2-Bilanz rechnen — beides braucht die Menge als Zahl. Der
-- Kilometerstand wandert aus demselben Grund mit in die Zeile: bisher hat er
-- nur den Zählerstand am Fahrzeug überschrieben, sodass die Strecke zwischen
-- zwei Tankfüllungen nicht mehr rekonstruierbar war.
alter table public.entries add column if not exists liters    numeric(8, 2) check (liters > 0);
alter table public.entries add column if not exists fuel_type text;
alter table public.entries add column if not exists mileage   int check (mileage >= 0);

create index if not exists entries_fuel_idx
  on public.entries (vehicle_id, date) where liters is not null;

-- ---------------------------------------------------------------------------
-- Checklisten-Vorlagen
-- ---------------------------------------------------------------------------
-- Die Punkte stehen als JSON in einer Spalte statt in einer eigenen Tabelle:
-- eine Vorlage wird immer als Ganzes gelesen und als Ganzes bearbeitet, und
-- die einzelnen Punkte werden nie für sich abgefragt. Jeder Punkt ist
-- { "key": "...", "label": "...", "critical": true|false }; `critical`
-- markiert die Punkte, bei denen ein Mangel das Fahrzeug stilllegt
-- (Bremsen, Beleuchtung, Reifen).
create table if not exists public.check_templates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  items       jsonb not null default '[]'::jsonb,
  is_default  boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint check_templates_items_array check (jsonb_typeof(items) = 'array')
);

alter table public.check_templates enable row level security;

create index if not exists check_templates_company_idx
  on public.check_templates (company_id) where active;

drop policy if exists "check_templates_select" on public.check_templates;
create policy "check_templates_select"
  on public.check_templates for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "check_templates_write_admin" on public.check_templates;
create policy "check_templates_write_admin"
  on public.check_templates for all
  to authenticated
  using (public.is_admin() and company_id = public.current_company_id())
  with check (public.is_admin() and company_id = public.current_company_id());

-- ---------------------------------------------------------------------------
-- Durchgeführte Checks
-- ---------------------------------------------------------------------------
create table if not exists public.vehicle_checks (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references public.vehicles (id) on delete cascade,
  driver_id     uuid not null references public.profiles (id) on delete cascade,
  template_id   uuid references public.check_templates (id) on delete set null,
  performed_at  timestamptz not null default now(),
  mileage       int check (mileage >= 0),
  -- 'ok'          = alles in Ordnung
  -- 'maengel'     = Mängel vorhanden, Fahrzeug aber fahrbereit
  -- 'stillgelegt' = kritischer Mangel, Fahrzeug nicht verkehrssicher
  result        text not null default 'ok'
                check (result in ('ok', 'maengel', 'stillgelegt')),
  note          text,
  created_at    timestamptz not null default now()
);

alter table public.vehicle_checks enable row level security;

create index if not exists vehicle_checks_vehicle_idx
  on public.vehicle_checks (vehicle_id, performed_at desc);

drop policy if exists "vehicle_checks_select" on public.vehicle_checks;
create policy "vehicle_checks_select"
  on public.vehicle_checks for select
  to authenticated
  using (public.can_access_vehicle(vehicle_id));

drop policy if exists "vehicle_checks_insert_own" on public.vehicle_checks;
create policy "vehicle_checks_insert_own"
  on public.vehicle_checks for insert
  to authenticated
  with check (driver_id = auth.uid() and public.can_access_vehicle(vehicle_id));

-- Ein einmal eingereichter Check bleibt, wie er eingereicht wurde. Er ist ein
-- Nachweis; wäre er änderbar, wäre er als Nachweis wertlos. Auch der Admin
-- korrigiert ihn nicht, er kann ihn nur löschen.
drop policy if exists "vehicle_checks_delete_admin" on public.vehicle_checks;
create policy "vehicle_checks_delete_admin"
  on public.vehicle_checks for delete
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id));

-- ---------------------------------------------------------------------------
-- Einzelantworten eines Checks
-- ---------------------------------------------------------------------------
create table if not exists public.check_results (
  id          uuid primary key default gen_random_uuid(),
  check_id    uuid not null references public.vehicle_checks (id) on delete cascade,
  item_key    text not null,
  -- Der Text wird mitgeschrieben statt nur auf die Vorlage zu verweisen:
  -- Vorlagen ändern sich, der Nachweis muss zeigen, was damals gefragt wurde.
  label       text not null,
  status      text not null check (status in ('ok', 'mangel', 'entfaellt')),
  note        text,
  photo_path  text,
  created_at  timestamptz not null default now(),
  unique (check_id, item_key)
);

alter table public.check_results enable row level security;

create index if not exists check_results_check_idx on public.check_results (check_id);

drop policy if exists "check_results_select" on public.check_results;
create policy "check_results_select"
  on public.check_results for select
  to authenticated
  using (
    exists (
      select 1 from public.vehicle_checks c
       where c.id = check_id and public.can_access_vehicle(c.vehicle_id)
    )
  );

drop policy if exists "check_results_insert" on public.check_results;
create policy "check_results_insert"
  on public.check_results for insert
  to authenticated
  with check (
    exists (
      select 1 from public.vehicle_checks c
       where c.id = check_id
         and c.driver_id = auth.uid()
         and public.can_access_vehicle(c.vehicle_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Mängel
-- ---------------------------------------------------------------------------
create table if not exists public.defects (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references public.vehicles (id) on delete cascade,
  reported_by  uuid references public.profiles (id) on delete set null,
  check_id     uuid references public.vehicle_checks (id) on delete set null,
  title        text not null,
  description  text,
  severity     text not null default 'mittel'
               check (severity in ('gering', 'mittel', 'kritisch')),
  status       text not null default 'offen'
               check (status in ('offen', 'in_arbeit', 'erledigt', 'verworfen')),
  photo_path   text,
  due_date     date,
  assigned_to  uuid references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  resolution   text,
  cost         numeric(10, 2) check (cost >= 0),
  created_at   timestamptz not null default now()
);

alter table public.defects enable row level security;

create index if not exists defects_vehicle_idx on public.defects (vehicle_id, created_at desc);
create index if not exists defects_offen_idx
  on public.defects (status, due_date) where status in ('offen', 'in_arbeit');

drop policy if exists "defects_select" on public.defects;
create policy "defects_select"
  on public.defects for select
  to authenticated
  using (public.can_access_vehicle(vehicle_id));

-- Melden darf jeder, der das Fahrzeug fährt — genau das ist der Zweck.
drop policy if exists "defects_insert" on public.defects;
create policy "defects_insert"
  on public.defects for insert
  to authenticated
  with check (reported_by = auth.uid() and public.can_access_vehicle(vehicle_id));

-- Bearbeiten (Status, Termin, Kosten) ist Sache des Admins. Ein Fahrer, der
-- den eigenen Mangel auf „erledigt" setzen könnte, hebt den Zweck auf.
drop policy if exists "defects_update_admin" on public.defects;
create policy "defects_update_admin"
  on public.defects for update
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id))
  with check (public.is_admin() and public.can_access_vehicle(vehicle_id));

drop policy if exists "defects_delete_admin" on public.defects;
create policy "defects_delete_admin"
  on public.defects for delete
  to authenticated
  using (public.is_admin() and public.can_access_vehicle(vehicle_id));

-- ---------------------------------------------------------------------------
-- Aufträge
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  vehicle_id    uuid references public.vehicles (id) on delete set null,
  assigned_to   uuid references public.profiles (id) on delete set null,
  title         text not null,
  description   text,
  address       text,
  scheduled_for timestamptz,
  status        text not null default 'geplant'
                check (status in ('geplant', 'unterwegs', 'erledigt', 'abgebrochen')),
  completed_at  timestamptz,
  driver_note   text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.jobs enable row level security;

create index if not exists jobs_company_idx on public.jobs (company_id, scheduled_for);
create index if not exists jobs_assigned_idx
  on public.jobs (assigned_to, scheduled_for) where status in ('geplant', 'unterwegs');

-- Der Fahrer sieht seine eigenen Aufträge, der Admin alle der Firma.
drop policy if exists "jobs_select" on public.jobs;
create policy "jobs_select"
  on public.jobs for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and (assigned_to = auth.uid() or public.is_admin())
  );

drop policy if exists "jobs_write_admin" on public.jobs;
create policy "jobs_write_admin"
  on public.jobs for all
  to authenticated
  using (public.is_admin() and company_id = public.current_company_id())
  with check (public.is_admin() and company_id = public.current_company_id());

-- Der Fahrer darf seinen eigenen Auftrag weiterschalten und eine Notiz
-- hinterlassen. Welche Spalten er dabei ändern darf, regelt der Trigger
-- weiter unten — RLS kann das nicht (siehe 0014).
drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own"
  on public.jobs for update
  to authenticated
  using (assigned_to = auth.uid() and company_id = public.current_company_id())
  with check (assigned_to = auth.uid() and company_id = public.current_company_id());

/**
 * Hält den Fahrer beim eigenen Auftrag auf Status und Notiz fest.
 *
 * Ohne diese Wache könnte er sich über die REST-API einen fremden Auftrag
 * zuschieben, den Termin verschieben oder den Text ändern — die Zeile darf
 * er ja anfassen. Dieselbe Lücke wie bei profiles und companies in 0014,
 * deshalb hier gleich mitgedacht.
 */
create or replace function public.guard_job_driver_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Admins und der Service-Role-Schlüssel bleiben unberührt.
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.title         is distinct from old.title
       or new.description is distinct from old.description
       or new.address     is distinct from old.address
       or new.scheduled_for is distinct from old.scheduled_for
       or new.vehicle_id  is distinct from old.vehicle_id
       or new.assigned_to is distinct from old.assigned_to
       or new.company_id  is distinct from old.company_id
       or new.created_by  is distinct from old.created_by then
      raise exception 'Am Auftrag lassen sich nur Status und Notiz ändern.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_guard_driver_fields on public.jobs;
create trigger jobs_guard_driver_fields
  before update on public.jobs
  for each row execute function public.guard_job_driver_fields();

revoke execute on function public.guard_job_driver_fields() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fotos zu Checks und Mängeln
-- ---------------------------------------------------------------------------
-- Eigener Eimer statt der Belege: Belege sind kaufmännische Unterlagen mit
-- eigener Aufbewahrungsfrist, Mängelfotos sind Betriebsdokumentation. Wer
-- sie trennt, kann sie später getrennt löschen.
insert into storage.buckets (id, name, public)
values ('defects', 'defects', false)
on conflict (id) do nothing;

drop policy if exists "defects_storage_select" on storage.objects;
create policy "defects_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'defects'
    and public.can_access_vehicle(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "defects_storage_insert" on storage.objects;
create policy "defects_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'defects'
    and public.can_access_vehicle(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "defects_storage_delete" on storage.objects;
create policy "defects_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'defects'
    and public.is_admin()
    and public.can_access_vehicle(((storage.foldername(name))[1])::uuid)
  );

comment on table public.check_templates is 'Checklisten für die Abfahrtskontrolle. Punkte als JSON-Array.';
comment on table public.vehicle_checks  is 'Durchgeführte Abfahrtskontrollen. Nach dem Einreichen unveränderlich.';
comment on table public.defects         is 'Gemeldete Mängel mit Bearbeitungsstand.';
comment on table public.jobs            is 'Aufträge für Fahrer. Fahrer ändern nur Status und Notiz (Trigger).';
