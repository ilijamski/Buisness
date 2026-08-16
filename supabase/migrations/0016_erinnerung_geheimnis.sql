-- Eigenes Geheimnis für den Erinnerungslauf statt des Service-Role-Keys.
--
-- Bisher musste der Service-Role-Schlüssel von Hand in den Vault gelegt
-- werden, damit pg_cron am JWT-Check der Edge Function vorbeikommt. Zwei
-- Nachteile:
--
--   * Es ist ein Schlüssel mit vollen Rechten auf das ganze Projekt, nur
--     damit ein einziger Aufruf durchgeht. Wer ihn in die Finger bekommt,
--     liest jede Tabelle unter Umgehung von RLS.
--   * Er muss aus der Oberfläche kopiert werden. Genau daneben steht der
--     anon-Key, der fast gleich aussieht — eine Verwechslung fällt erst
--     auf, wenn wochenlang keine Erinnerung ankommt.
--
-- Stattdessen: ein Zufallswert, den die Datenbank selbst erzeugt und der
-- ausschließlich diesen einen Aufruf freischaltet. Er steht nirgends in
-- dieser Datei, wird beim Einspielen erzeugt und verlässt die Datenbank
-- nie — die Edge Function schickt ihren Wert zum Vergleich zurück, statt
-- ihn zu erfragen.

-- --------------------------------------------------------------------
-- 1. Geheimnis anlegen, falls noch keins da ist.
-- --------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'reminder_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'reminder_secret',
      'Schaltet den Aufruf der Edge Function fristen-reminder frei.'
    );
  end if;
end $$;

-- --------------------------------------------------------------------
-- 2. Prüffunktion für die Edge Function.
--    Nur service_role darf sie aufrufen — und das ist der Schlüssel, den
--    die Edge-Runtime der Function ohnehin selbst mitgibt. Der Vergleich
--    passiert in der Datenbank; das Geheimnis wird nicht herausgegeben.
-- --------------------------------------------------------------------
create or replace function public.reminder_secret_valid(p_secret text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  if p_secret is null or length(p_secret) < 32 then
    return false;
  end if;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'reminder_secret';

  if v_secret is null then
    return false;
  end if;

  -- Verglichen werden die Prüfsummen, nicht die Werte: gleich lange
  -- Eingaben, damit die Dauer des Vergleichs nichts über das Geheimnis
  -- verrät.
  return encode(digest(p_secret, 'sha256'), 'hex')
       = encode(digest(v_secret, 'sha256'), 'hex');
end;
$$;

revoke execute on function public.reminder_secret_valid(text) from public, anon, authenticated;
grant  execute on function public.reminder_secret_valid(text) to service_role;

-- --------------------------------------------------------------------
-- 3. Der Auslöser schickt das Geheimnis als Kopfzeile mit.
-- --------------------------------------------------------------------
create or replace function public.trigger_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'reminder_secret';

  if v_url is null or v_secret is null then
    raise notice 'Fristen-Erinnerung übersprungen: project_url oder reminder_secret fehlt im Vault.';
    return;
  end if;

  perform net.http_post(
    url     => v_url || '/functions/v1/fristen-reminder',
    headers => jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-reminder-secret', v_secret
               ),
    body    => '{}'::jsonb
  );
end;
$$;

revoke execute on function public.trigger_deadline_reminders() from public, anon, authenticated;
grant  execute on function public.trigger_deadline_reminders() to service_role;

comment on function public.reminder_secret_valid is
  'Prüft die Kopfzeile x-reminder-secret der Edge Function fristen-reminder. Nur für service_role.';
