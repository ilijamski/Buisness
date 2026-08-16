-- Ausführungsrechte auf den SECURITY-DEFINER-Funktionen.
--
-- PostgreSQL vergibt auf jede neue Funktion automatisch EXECUTE an PUBLIC.
-- `anon` und `authenticated` erben das. Ein `revoke ... from anon,
-- authenticated` — wie in 0013 geschrieben — nimmt dieses Erbe NICHT weg:
-- der Eintrag `=X/postgres` (das ist PUBLIC) bleibt stehen, und die Funktion
-- ist weiter für jeden aufrufbar. Nachgemessen an der laufenden Datenbank:
-- has_function_privilege('anon', 'trigger_deadline_reminders', 'EXECUTE')
-- war trotz des revoke true.
--
-- Praktisch bedeutete das bei `trigger_deadline_reminders`: der anon-Key
-- steht im Browser-Bundle und ist damit öffentlich. Jeder konnte
-- /rest/v1/rpc/trigger_deadline_reminders in einer Schleife aufrufen und
-- damit beliebig oft den kompletten Erinnerungslauf auslösen — jeder Lauf
-- schickt Mail über das Gmail-Konto des Absenders. Gmail sperrt Konten, die
-- so etwas tun. Der Cron-Auftrag läuft als `postgres` und braucht das Recht
-- nicht.
--
-- Vorgehen: erst PUBLIC entziehen, dann gezielt zurückgeben. Das ist die
-- Reihenfolge, die auch bei künftigen Funktionen gilt.

-- --------------------------------------------------------------------
-- 1. Trigger-Funktionen: von außen gar nicht aufrufbar.
--    PostgreSQL prüft EXECUTE beim ANLEGEN des Triggers, nicht beim
--    Auslösen. Die Trigger laufen also unverändert weiter.
-- --------------------------------------------------------------------
revoke execute on function public.assign_vehicle_number()     from public, anon, authenticated;
revoke execute on function public.handle_new_user()           from public, anon, authenticated;
revoke execute on function public.mark_company_activated()    from public, anon, authenticated;
revoke execute on function public.promote_platform_admin()    from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()           from public, anon, authenticated;
revoke execute on function public.guard_profile_privileges()  from public, anon, authenticated;
revoke execute on function public.guard_company_billing()     from public, anon, authenticated;

-- --------------------------------------------------------------------
-- 2. Der Erinnerungslauf: nur Cron (postgres) und der Service-Role-Key.
-- --------------------------------------------------------------------
revoke execute on function public.trigger_deadline_reminders() from public, anon, authenticated;
grant  execute on function public.trigger_deadline_reminders() to service_role;

-- --------------------------------------------------------------------
-- 3. RLS-Hilfsfunktionen: werden bei jeder normalen Abfrage aus den
--    Policies heraus ausgewertet und müssen deshalb aufrufbar bleiben —
--    auch für `anon`, sonst scheitert die Auswertung schon vor dem
--    Login. Sie geben nichts preis: ohne Sitzung ist auth.uid() null,
--    die Funktionen liefern dann false bzw. null.
-- --------------------------------------------------------------------
grant execute on function public.is_admin()                    to anon, authenticated, service_role;
grant execute on function public.is_platform_admin()           to anon, authenticated, service_role;
grant execute on function public.current_company_id()          to anon, authenticated, service_role;
grant execute on function public.can_access_vehicle(uuid)      to anon, authenticated, service_role;
grant execute on function public.company_has_access(uuid)      to anon, authenticated, service_role;

-- --------------------------------------------------------------------
-- 4. Aufrufbare Funktionen der App: angemeldete Nutzer, sonst niemand.
--    Wer darf was, entscheidet weiterhin die Funktion selbst
--    (create_promo_code, platform_stats, platform_companies und
--    set_member_role prüfen intern die Berechtigung).
-- --------------------------------------------------------------------
revoke execute on function public.can_delete_own_account()     from public, anon;
revoke execute on function public.join_or_create_company(text, text, text) from public, anon;
revoke execute on function public.redeem_promo_code(text)      from public, anon;
revoke execute on function public.set_member_role(uuid, text)  from public, anon;
revoke execute on function public.create_promo_code(integer, integer, text, timestamptz) from public, anon;
revoke execute on function public.platform_stats()             from public, anon;
revoke execute on function public.platform_companies()         from public, anon;

grant execute on function public.can_delete_own_account()      to authenticated, service_role;
grant execute on function public.join_or_create_company(text, text, text) to authenticated, service_role;
grant execute on function public.redeem_promo_code(text)       to authenticated, service_role;
grant execute on function public.set_member_role(uuid, text)   to authenticated, service_role;
grant execute on function public.create_promo_code(integer, integer, text, timestamptz) to authenticated, service_role;
grant execute on function public.platform_stats()              to authenticated, service_role;
grant execute on function public.platform_companies()          to authenticated, service_role;

-- --------------------------------------------------------------------
-- 5. Für alles, was später dazukommt: kein automatisches Recht mehr an
--    PUBLIC. Neue Funktionen müssen ihr EXECUTE ausdrücklich bekommen.
-- --------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public;

comment on function public.trigger_deadline_reminders is
  'Ruft die Edge Function fristen-reminder auf. Zugangsdaten aus dem Vault (project_url, service_role_key). Nur für Cron und Service-Role.';
