# Fuhrpark-Manager

Next.js-App zur Verwaltung eines Fuhrparks mit Supabase als Backend
(Auth, Postgres, Row Level Security).

## Features

- **Login** per E-Mail/Passwort über Supabase Auth
- **Zwei Rollen**: `mitarbeiter` und `admin`, gepflegt in einer `profiles`-Tabelle
- **Mitarbeiter-Ansicht**: Fahrzeugliste, "Neuer Eintrag"-Formular (Tanken/Wartung/Schaden), eigene Historie
- **Admin-Ansicht**: Gesamtkosten pro Fahrzeug, alle Einträge aller Mitarbeiter, Fahrzeug hinzufügen
- **Row Level Security**: Mitarbeiter sehen/erstellen nur eigene Einträge, Admins sehen und verwalten alles
- Dunkles, mobiloptimiertes UI mit Amber-Akzentfarbe (`#F2A93B`)

## 1. Supabase-Projekt einrichten

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. Im SQL-Editor die Migration aus [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
   ausführen (legt `profiles`, `vehicles`, `entries`, den `handle_new_user`-Trigger sowie alle RLS-Policies an).
   Alternativ mit der Supabase CLI:

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

## Projektstruktur

```
supabase/migrations/0001_init.sql   Schema, Trigger, RLS-Policies
src/lib/supabase/                   Browser-/Server-/Proxy-Clients
src/lib/auth.ts                     Profil-/Rollen-Check für Server Components
src/app/login/                      Login-Seite + Server Actions
src/app/mitarbeiter/                Mitarbeiter-Dashboard + Server Actions
src/app/admin/                      Admin-Dashboard + Server Actions
src/components/                     UI-Bausteine (Header, Formulare, Tabellen, Badges)
src/proxy.ts                        Next.js Proxy (ehem. Middleware) für Session-/Route-Schutz
```

## Datenmodell

- **profiles** — `id`, `email`, `full_name`, `role` (`mitarbeiter` \| `admin`), `created_at`
- **vehicles** — `id`, `name`, `plate`, `type`, `tuv_date`, `created_at`
- **entries** — `id`, `vehicle_id`, `type` (`tanken` \| `wartung` \| `schaden`), `cost`, `note`, `date`, `author_id`, `created_at`

## Row Level Security (Kurzfassung)

| Tabelle    | Mitarbeiter                          | Admin        |
| ---------- | ------------------------------------- | ------------ |
| `vehicles` | lesen                                 | lesen/schreiben |
| `entries`  | eigene erstellen & lesen               | alles lesen/schreiben |
| `profiles` | eigenes Profil lesen                   | alle lesen/schreiben |

Details siehe [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).

## Deployment

Der einfachste Weg ist [Vercel](https://vercel.com/new): Repo importieren, die
beiden `NEXT_PUBLIC_SUPABASE_*`-Umgebungsvariablen setzen, deployen.
