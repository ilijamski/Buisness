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
