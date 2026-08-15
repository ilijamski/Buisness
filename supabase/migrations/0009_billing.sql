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
