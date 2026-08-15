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
