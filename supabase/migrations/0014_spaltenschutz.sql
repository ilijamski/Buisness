-- Spaltenschutz für Rechte und Abo.
--
-- Row Level Security regelt, WELCHE ZEILEN jemand ändern darf, niemals
-- WELCHE SPALTEN. Beide Tabellen erlauben zu Recht ein Update der eigenen
-- Zeile — `profiles` für den eigenen Namen und Führerschein, `companies`
-- für Firmenname und Vorlaufzeit. Genau darüber ließen sich bisher aber
-- auch die Felder ändern, die über Rechte und Bezahlung entscheiden.
--
-- Nachgewiesen in einem Test gegen die laufende Datenbank:
--
--   * Ein Mitarbeiter konnte sich `role = 'admin'` setzen und sah danach
--     alle Fahrzeuge und alle Einträge seiner Firma statt nur der eigenen.
--     Er konnte sich außerdem per `company_id` in eine FREMDE Firma
--     schreiben und hätte damit deren Daten gesehen.
--   * Ein Firmen-Admin konnte `trial_ends_at` in die ferne Zukunft setzen
--     und hatte dauerhaft Gratiszugang — die Bezahlschranke war für jeden
--     umgehbar, der den Netzwerk-Tab öffnet.
--
-- Beides braucht keine Lücke in der Oberfläche: der anon-Key ist
-- öffentlich, und jeder angemeldete Nutzer kann Tabellenoperationen direkt
-- gegen die REST-API schicken.
--
-- Die Wachen greifen nur für Client-Verbindungen (Rolle `authenticated`
-- oder `anon`). Alle vorgesehenen Wege bleiben unberührt: set_member_role,
-- redeem_promo_code, join_or_create_company und handle_new_user sind
-- SECURITY DEFINER und laufen als `postgres`; der Stripe-Webhook arbeitet
-- mit dem Service-Role-Schlüssel.
--
-- WICHTIG — die Wachen sind SECURITY INVOKER, nicht DEFINER: in einer
-- SECURITY-DEFINER-Funktion meldet `current_user` immer den Eigentümer der
-- Funktion und nie die Rolle des Aufrufers. Die Prüfung liefe dann bei
-- jedem Aufruf ins Leere, ohne dass es auffällt. Genau dieser Fehler ist
-- beim ersten Anlauf passiert und wurde erst durch den erneuten Angriffs-
-- test sichtbar.

/**
 * Schützt Rolle, Firmenzugehörigkeit und Mitarbeiter-Nummer.
 * Änderungen laufen über set_member_role bzw. join_or_create_company.
 */
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role then
      raise exception 'Die Rolle lässt sich nicht direkt ändern.'
        using errcode = 'insufficient_privilege';
    end if;
    if new.company_id is distinct from old.company_id then
      raise exception 'Die Firmenzugehörigkeit lässt sich nicht direkt ändern.'
        using errcode = 'insufficient_privilege';
    end if;
    if new.employee_number is distinct from old.employee_number then
      raise exception 'Die Mitarbeiter-Nummer lässt sich nicht direkt ändern.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

/**
 * Schützt alle Felder, die über den Zugang entscheiden.
 *
 * Ausnahme `stripe_customer_id`: die App verknüpft beim ersten Bezahlvorgang
 * den Stripe-Kunden aus einer normalen Admin-Sitzung heraus. Erlaubt ist
 * deshalb nur das erstmalige Setzen — ein späteres Umbiegen auf einen
 * fremden Kunden bleibt gesperrt.
 */
create or replace function public.guard_company_billing()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.subscription_status    is distinct from old.subscription_status
       or new.plan                is distinct from old.plan
       or new.trial_ends_at       is distinct from old.trial_ends_at
       or new.current_period_end  is distinct from old.current_period_end
       or new.cancel_at_period_end is distinct from old.cancel_at_period_end
       or new.activated_at        is distinct from old.activated_at
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
      raise exception 'Abo-Daten lassen sich nicht direkt ändern.'
        using errcode = 'insufficient_privilege';
    end if;

    if new.stripe_customer_id is distinct from old.stripe_customer_id
       and old.stripe_customer_id is not null then
      raise exception 'Der Stripe-Kunde ist bereits verknüpft.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_guard_billing on public.companies;
create trigger companies_guard_billing
  before update on public.companies
  for each row execute function public.guard_company_billing();

comment on function public.guard_profile_privileges is
  'Sperrt Client-seitige Änderungen an role, company_id und employee_number. RLS kann keine Spalten einschränken.';
comment on function public.guard_company_billing is
  'Sperrt Client-seitige Änderungen an den Abo-Feldern. stripe_customer_id darf nur einmal gesetzt werden.';
