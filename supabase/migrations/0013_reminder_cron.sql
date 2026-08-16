-- Täglicher Auftrag für die Fristen-Erinnerung.
--
-- Bisher musste die Edge Function von außen angestoßen werden. Damit war das
-- Kernversprechen der App — „du verpasst keinen TÜV mehr" — davon abhängig,
-- dass jemand einen Zeitplan einrichtet. Passiert das nicht, meldet sich die
-- App nie, und der Kunde erfährt es erst durch das Bußgeld.
--
-- pg_cron ruft die Function jetzt selbst auf. Der dafür nötige Schlüssel
-- steht bewusst NICHT hier: er wird über Supabase Vault hinterlegt, sonst
-- läge ein Zugang mit vollen Rechten im Klartext in der Migration und damit
-- im Git-Verlauf.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

/**
 * Stößt die Fristen-Erinnerung an.
 *
 * Liest Projekt-URL und Service-Role-Key aus dem Vault. Fehlt einer von
 * beiden, passiert nichts — der Auftrag läuft dann folgenlos weiter, statt
 * bei jedem Durchlauf einen Fehler zu werfen.
 */
create or replace function public.trigger_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_url is null or v_key is null then
    raise notice 'Fristen-Erinnerung übersprungen: project_url oder service_role_key fehlt im Vault.';
    return;
  end if;

  perform net.http_post(
    url     => v_url || '/functions/v1/fristen-reminder',
    headers => jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    => '{}'::jsonb
  );
end;
$$;

revoke execute on function public.trigger_deadline_reminders() from anon, authenticated;

-- Täglich um 07:00 UTC — früh genug, dass die Meldung vor Arbeitsbeginn im
-- Postfach liegt, und außerhalb der Zeit, in der jemand die App benutzt.
select cron.unschedule('fristen-erinnerung')
 where exists (select 1 from cron.job where jobname = 'fristen-erinnerung');

select cron.schedule(
  'fristen-erinnerung',
  '0 7 * * *',
  $$select public.trigger_deadline_reminders();$$
);

comment on function public.trigger_deadline_reminders is
  'Ruft die Edge Function fristen-reminder auf. Zugangsdaten kommen aus dem Vault (project_url, service_role_key).';
