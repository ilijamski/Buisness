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
