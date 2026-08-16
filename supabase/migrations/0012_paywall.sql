-- Zugang erst nach Bezahlung oder Testcode.
--
-- Bisher bekam jede neu angelegte Firma automatisch dreißig Gratistage:
-- `trial_ends_at` hatte den Vorgabewert `now() + interval '30 days'`. Damit
-- stand die App unmittelbar nach der Registrierung offen.
--
-- Gewünscht ist das Gegenteil: Wer sich registriert, landet auf der
-- Abo-Seite und kommt erst weiter, wenn er ein Abo abschließt oder einen
-- Testcode einlöst. Der Vorgabewert entfällt deshalb ersatzlos —
-- `trial_ends_at` bleibt bei neuen Firmen leer, und `company_has_access()`
-- liefert dann false.
--
-- Bereits bestehende Firmen behalten ihren laufenden Gratiszeitraum. Ihn
-- nachträglich zu streichen würde Betriebe aussperren, die im Vertrauen
-- darauf angefangen haben zu arbeiten.

alter table public.companies
  alter column trial_ends_at drop default;

-- Merkt sich, wann eine Firma zuletzt Zugang hatte. Ohne diese Spalte lässt
-- sich „noch nie freigeschaltet" nicht von „abgelaufen" unterscheiden — die
-- Abo-Seite braucht den Unterschied, weil sie einen Neukunden anders
-- ansprechen muss als einen, dessen Abo ausgelaufen ist.
alter table public.companies
  add column if not exists activated_at timestamptz;

-- Für den Bestand: Wer schon Zugang hat, gilt als freigeschaltet.
update public.companies
   set activated_at = coalesce(activated_at, created_at)
 where trial_ends_at is not null
    or subscription_status = 'active';

/**
 * Setzt `activated_at`, sobald eine Firma zum ersten Mal Zugang erhält.
 *
 * Läuft bei jeder Änderung an Abo-Status oder Gratiszeitraum, also sowohl
 * beim Einlösen eines Codes als auch beim Eintreffen der Stripe-Meldung.
 */
create or replace function public.mark_company_activated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.activated_at is null
     and (
       new.subscription_status = 'active'
       or (new.trial_ends_at is not null and new.trial_ends_at > now())
     ) then
    new.activated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists companies_mark_activated on public.companies;
create trigger companies_mark_activated
  before insert or update of subscription_status, trial_ends_at
  on public.companies
  for each row
  execute function public.mark_company_activated();

revoke execute on function public.mark_company_activated() from anon, authenticated;

comment on column public.companies.activated_at is
  'Zeitpunkt der ersten Freischaltung (Abo oder Testcode). Leer = noch nie freigeschaltet.';
