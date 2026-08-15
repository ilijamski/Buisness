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
