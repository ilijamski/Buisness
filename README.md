# Fuhrpark-Manager

Next.js-App zur Verwaltung eines Fuhrparks mit Supabase als Backend
(Auth, Postgres, Row Level Security).

## Features

- **Login** per E-Mail/Passwort über Supabase Auth
- **Zwei Rollen**: `mitarbeiter` und `admin`, gepflegt in einer `profiles`-Tabelle
- **Mitarbeiter-Ansicht**: Fahrzeugliste, "Neuer Eintrag"-Formular (Tanken/Wartung/Schaden), eigene Historie
- **Admin-Ansicht**: Gesamtkosten pro Fahrzeug, alle Einträge aller Mitarbeiter, Fahrzeug hinzufügen
- **Row Level Security**: Mitarbeiter sehen/erstellen nur eigene Einträge, Admins sehen und verwalten alles
- **Beleg-Foto-Upload**: Fotos/PDFs zu Tankungen, Wartungen oder Schäden werden in Supabase Storage abgelegt
- **TÜV-Erinnerung per E-Mail**: Edge Function informiert alle Admins 30 Tage vor Fälligkeit (via Resend)
- Dunkles, mobiloptimiertes UI mit Amber-Akzentfarbe (`#F2A93B`)

## 1. Supabase-Projekt einrichten

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. Alle Migrationen unter [`supabase/migrations/`](./supabase/migrations) der Reihe nach im
   SQL-Editor ausführen (oder mit der Supabase CLI, siehe unten):
   - `0001_init.sql` — `profiles`, `vehicles`, `entries`, `handle_new_user`-Trigger, Basis-RLS
   - `0002_receipts.sql` — `entries.receipt_path`, privater Storage-Bucket `receipts`, RLS auf `storage.objects`
   - `0003_tuv_reminders.sql` — `tuv_reminders`-Tabelle zur Deduplizierung der TÜV-Erinnerungen

   ```bash
   supabase link --project-ref <dein-projekt-ref>
   supabase db push
   ```

3. Unter **Project Settings → API** die `Project URL` und den `anon public`-Key kopieren.

## 2. Umgebungsvariablen

```bash
cp .env.local.example .env.local
```

`.env.local` ausfüllen:

```
NEXT_PUBLIC_SUPABASE_URL=https://<dein-projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dein-anon-key>
```

## 3. Benutzer anlegen

Rollen werden beim Sign-up über `user_metadata.role` gesetzt (Trigger `handle_new_user`
kopiert den Wert in `profiles.role`, Standard ist `mitarbeiter`).

**Admin-User anlegen** (z. B. im Supabase Dashboard unter Authentication → Users →
"Add user", oder per SQL Editor):

```sql
-- Nutzer zuerst regulär über die App/Dashboard anlegen, danach zum Admin machen:
update public.profiles set role = 'admin' where email = 'admin@firma.de';
```

Oder direkt beim Erstellen per Supabase Admin API mit
`user_metadata: { role: 'admin' }`.

Reguläre Mitarbeiter-Accounts können sich selbst über
**Authentication → Users → Invite/Add user** registrieren lassen oder du legst sie
manuell an — sie erhalten automatisch die Rolle `mitarbeiter`.

## 4. Lokal starten

```bash
npm install
npm run dev
```

App läuft unter [http://localhost:3000](http://localhost:3000). Nicht angemeldete
Nutzer werden zu `/login` weitergeleitet; nach dem Login geht es automatisch zu
`/mitarbeiter` bzw. `/admin`, je nach Rolle.

## 5. Beleg-Foto-Upload (Supabase Storage)

Migration `0002_receipts.sql` legt den privaten Bucket `receipts` an und setzt
RLS-Policies auf `storage.objects`, die exakt zu den Regeln der `entries`-Tabelle
passen: Jeder Mitarbeiter darf nur in sein eigenes Ordner-Präfix (`<user_id>/…`)
hochladen und lesen, Admins sehen alles.

Im "Neuer Eintrag"-Formular kann optional ein Foto/PDF (Kamera oder Datei)
angehängt werden. Der Upload läuft über die Server Action `createEntry`
(`src/app/mitarbeiter/actions.ts`), die Datei landet unter
`receipts/<user_id>/<uuid>.<ext>` und der Pfad wird in `entries.receipt_path`
gespeichert. Da der Bucket privat ist, werden beim Anzeigen der Historie
zeitlich begrenzte Signed URLs (1 Stunde gültig) serverseitig erzeugt
(`src/lib/receipts.ts`).

Es ist keine weitere Konfiguration nötig — der Bucket wird durch die Migration
erstellt.

## 6. TÜV-Erinnerung per E-Mail (Edge Function + Resend)

Die Edge Function [`supabase/functions/tuv-reminder`](./supabase/functions/tuv-reminder)
sucht täglich nach Fahrzeugen, deren `tuv_date` innerhalb der nächsten 30 Tage
liegt, und verschickt eine E-Mail an alle Admins (`profiles.role = 'admin'`)
über [Resend](https://resend.com). Bereits verschickte Erinnerungen werden in
`tuv_reminders` (vehicle_id + tuv_date) protokolliert, damit jede Fälligkeit
nur einmal gemeldet wird — auch wenn ein Cron-Lauf mal ausfällt.

**Einrichtung:**

1. Bei [Resend](https://resend.com) einen API-Key erzeugen und eine
   Absender-Domain/-Adresse verifizieren.
2. Function deployen und Secrets setzen:

   ```bash
   supabase functions deploy tuv-reminder
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase secrets set REMINDER_FROM_EMAIL="Fuhrpark-Manager <noreply@deine-domain.de>"
   ```

3. Täglichen Aufruf einrichten — entweder über die **Supabase Dashboard →
   Database → Cron Jobs**-UI (Template "Invoke Edge Function", Ziel-Function
   `tuv-reminder`, z. B. `0 7 * * *` für 07:00 UTC), oder per SQL mit
   `pg_cron` + `pg_net` (beide Extensions vorher im Dashboard unter
   **Database → Extensions** aktivieren):

   ```sql
   select cron.schedule(
     'tuv-reminder-daily',
     '0 7 * * *', -- täglich 07:00 UTC
     $$
     select net.http_post(
       url := 'https://<dein-projekt-ref>.supabase.co/functions/v1/tuv-reminder',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer <service-role-key>'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

   `<dein-projekt-ref>` und `<service-role-key>` findest du unter
   **Project Settings → API**. Da der `service-role-key` ein Secret ist,
   empfiehlt sich, ihn statt im Klartext über
   [Supabase Vault](https://supabase.com/docs/guides/database/vault) einzubinden.

Manueller Test lokal:

```bash
supabase functions serve tuv-reminder --env-file supabase/.env.local
curl -i --request POST http://localhost:54321/functions/v1/tuv-reminder \
  --header "Authorization: Bearer <anon-or-service-key>"
```

## Projektstruktur

```
supabase/migrations/0001_init.sql       Schema, Trigger, RLS-Policies
supabase/migrations/0002_receipts.sql   receipt_path-Spalte, Storage-Bucket + RLS
supabase/migrations/0003_tuv_reminders.sql  tuv_reminders-Tabelle
supabase/functions/tuv-reminder/        Edge Function für TÜV-Erinnerungen (Resend)
src/lib/supabase/                       Browser-/Server-/Proxy-Clients
src/lib/auth.ts                         Profil-/Rollen-Check für Server Components
src/lib/receipts.ts                     Signed-URL-Helper für Beleg-Fotos
src/app/login/                          Login-Seite + Server Actions
src/app/mitarbeiter/                    Mitarbeiter-Dashboard + Server Actions
src/app/admin/                          Admin-Dashboard + Server Actions
src/components/                         UI-Bausteine (Header, Formulare, Tabellen, Badges)
src/proxy.ts                            Next.js Proxy (ehem. Middleware) für Session-/Route-Schutz
```

## Datenmodell

- **profiles** — `id`, `email`, `full_name`, `role` (`mitarbeiter` \| `admin`), `created_at`
- **vehicles** — `id`, `name`, `plate`, `type`, `tuv_date`, `created_at`
- **entries** — `id`, `vehicle_id`, `type` (`tanken` \| `wartung` \| `schaden`), `cost`, `note`, `date`, `author_id`, `receipt_path`, `created_at`
- **tuv_reminders** — `vehicle_id`, `tuv_date`, `sent_at` (Protokoll versendeter TÜV-Erinnerungen)

## Row Level Security (Kurzfassung)

| Ressource            | Mitarbeiter                     | Admin                  |
| --------------------- | -------------------------------- | ----------------------- |
| `vehicles`             | lesen                             | lesen/schreiben         |
| `entries`              | eigene erstellen & lesen           | alles lesen/schreiben   |
| `profiles`             | eigenes Profil lesen               | alle lesen/schreiben    |
| `storage.objects` (`receipts`) | eigener Ordner lesen/hochladen | alles lesen/löschen     |
| `tuv_reminders`        | kein Zugriff                       | lesen                   |

Details siehe die Migrationen unter [`supabase/migrations/`](./supabase/migrations).

## Deployment

Der einfachste Weg ist [Vercel](https://vercel.com/new): Repo importieren, die
beiden `NEXT_PUBLIC_SUPABASE_*`-Umgebungsvariablen setzen, deployen.
