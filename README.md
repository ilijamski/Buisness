# Fuhrpark-Manager

Next.js-App zur Verwaltung eines Fuhrparks mit Supabase als Backend
(Auth, Postgres, Storage, Edge Functions). Mehrere Firmen können sich
unabhängig voneinander registrieren; jede Firma sieht nur ihre eigenen Daten.

## Wie es funktioniert

1. **Admin registriert sich** und legt dabei ein **Firmenkonto** an.
2. Die App erzeugt einen **Firmen-Code** (z. B. `K7M2PQRS`).
3. Der Admin legt **Fahrzeuge** an — jedes bekommt automatisch eine
   fortlaufende **Fahrzeug-Nummer**.
4. **Mitarbeiter registrieren sich** mit dem Firmen-Code und bekommen
   automatisch eine fortlaufende **Mitarbeiter-Nummer**.
5. Der Admin **weist Fahrzeuge zu**, indem er auf der Fahrzeugseite die
   Mitarbeiter-Nummer einträgt.
6. Ab dann sieht jeder Mitarbeiter **ausschließlich sein eigenes Fahrzeug** —
   Admins sehen die gesamte Flotte.

## Funktionsbausteine (Module)

Alle Bausteine sind optional. Der Admin schaltet sie unter
**Module** an/aus (`Aktiv`) und legt fest, ob die zugehörigen Felder
Pflicht sind (`Pflicht`). Das ist die **Grundeinstellung für alle Fahrzeuge**;
auf jeder Fahrzeugseite lässt sich davon **pro Fahrzeug abweichen**
(`erben` / `ja` / `nein`).

| Gruppe | Module |
| --- | --- |
| Fristen & Prüfungen | TÜV/HU, AU, UVV-Prüfung, Tachograf-Eichung, Kfz-Versicherung, Zulassung & Saisonkennzeichen |
| Wartung & Technik | Kilometerstand, Inspektion/Ölwechsel (Datum **oder** km), Reifen & Profiltiefe, Bremsen-Check, Werkstatt-Historie |
| Fahrer & Nutzung | Fahrerzuordnung, Führerschein-Ablauf, Fahrtenbuch (dienstlich/privat/Arbeitsweg), Tankkarten, Tankbelege |
| Finanzen & Verwaltung | Leasing/Finanzierung, Kfz-Steuer, Anschaffungs-/Restwert, Schadensfälle |
| Dokumente | Fahrzeugschein/-brief, Versicherung, Leasingvertrag, Nachweise (Anhängerkupplung, Klima-Check …) |

Alle Module sind in [`src/lib/modules.ts`](./src/lib/modules.ts) definiert —
Felder, Gruppen und überwachte Fristen kommen aus dieser einen Datei, sowohl
für die Formulare als auch für die Fristenübersicht.

## Bedienung

Unten liegt eine feste Leiste für den Bereichswechsel (auf großen Bildschirmen
wandert die Navigation in den Kopfbereich):

- **Admin:** Übersicht · Fahrzeuge · Team · Mehr
- **Mitarbeiter:** Fahrzeuge · Profil · Mehr

Unter **Einstellungen** finden sich Darstellung (hell/dunkel/wie das Gerät),
Standard-Fahrtart, E-Mail-Erinnerungen, Listendichte, Profil, Passwort ändern,
Abmelden (auch auf allen Geräten), Kontolöschung sowie Datenschutz, Impressum
und Nutzungsbedingungen. Admins verwalten dort zusätzlich Firmendaten und die
Vorlaufzeit für Erinnerungen.

## Installation als App (PWA)

Die App ist installierbar und läuft danach im eigenen Fenster ohne Browserleiste:

- **Android/Chrome/Edge:** Einstellungen → *Als App installieren*
- **iOS/Safari:** Teilen → *Zum Home-Bildschirm*
- **Desktop:** Installationssymbol in der Adressleiste

Manifest, Icons und Service Worker liegen in [`public/`](./public). Der Service
Worker cacht bewusst **nur** statische Dateien und eine Offline-Seite —
Fuhrparkdaten werden nie zwischengespeichert. Für eine Veröffentlichung in
App Store oder Play Store lässt sich die PWA zusätzlich mit
[Capacitor](https://capacitorjs.com) oder
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) verpacken.

## 1. Supabase-Projekt einrichten

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. Migrationen unter [`supabase/migrations/`](./supabase/migrations) **in
   dieser Reihenfolge** ausführen (SQL-Editor oder Supabase CLI):

   | Datei | Inhalt |
   | --- | --- |
   | `0001_init.sql` | Basis: profiles, vehicles, entries, RLS |
   | `0002_receipts.sql` | Beleg-Uploads, Storage-Bucket `receipts` |
   | `0003_tuv_reminders.sql` | (wird von `0006` abgelöst, für Bestandsprojekte nötig) |
   | `0004_companies_modules_fleet.sql` | Firmenkonten, Nummern, Fahrerzuordnung, Modul-Einstellungen, neue RLS |
   | `0005_logbook_documents.sql` | Fahrtenbuch, Werkstatt, Tankkarten, Dokumente + Bucket |
   | `0006_reminders.sql` | Erinnerungen für alle Fristen-Module |
   | `0007_settings.sql` | Benutzer-Präferenzen, Firmeneinstellungen, Kontolöschung |
   | `0008_corrections_push_invites.sql` | Korrekturfenster für eigene Einträge, Push-Abos |

   ```bash
   supabase link --project-ref <dein-projekt-ref>
   supabase db push
   ```

3. Unter **Project Settings → API** die `Project URL` und den `anon public`-Key kopieren.
4. Unter **Authentication → Providers → Email** die Bestätigungsmail
   deaktivieren, wenn sich Mitarbeiter ohne Zwischenschritt anmelden sollen
   (sonst müssen sie erst ihre E-Mail bestätigen).

## 2. Umgebungsvariablen

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://<dein-projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dein-anon-key>

# Für Passwort-Reset-Links und Einladungen (Domain des Deployments)
NEXT_PUBLIC_SITE_URL=https://fuhrpark.deine-domain.de

# Öffentlicher VAPID-Schlüssel für Push (siehe Abschnitt Push weiter unten)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid-public-key>
```

## Passwort-Reset per Gmail einrichten

Die Reset-Mail verschickt **Supabase Auth**, nicht die App. Damit sie über ein
Gmail-Konto rausgeht, wird Supabase auf Gmail-SMTP umgestellt:

1. Im Google-Konto die **Bestätigung in zwei Schritten** aktivieren
   (ohne sie gibt es keine App-Passwörter).
2. Unter [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   ein **App-Passwort** erzeugen (16 Zeichen).
3. In Supabase unter **Project Settings → Authentication → SMTP Settings**
   eintragen:

   | Feld | Wert |
   | --- | --- |
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | die vollständige Gmail-Adresse |
   | Password | das App-Passwort (nicht das Konto-Passwort) |
   | Sender email | dieselbe Gmail-Adresse |
   | Sender name | z. B. `Fuhrpark-Manager` |

4. Unter **Authentication → URL Configuration** die **Site URL** auf die Domain
   setzen und `https://<domain>/auth/callback` als Redirect-URL erlauben.

> **Grenzen von Gmail:** Ein normales Gmail-Konto darf rund 500 Empfänger pro
> Tag bedienen, und Google stuft automatisierte Mails schnell als verdächtig
> ein. Für den Dauerbetrieb mit vielen Nutzern ist ein Transaktionsdienst wie
> Resend (bereits für die Fristen-Mails eingebunden) die zuverlässigere Wahl —
> dort trägt man dieselben SMTP-Felder mit den Resend-Zugangsdaten ein.

Nutzer kommen über **Login → „Passwort vergessen?"** an den Ablauf; der Link
aus der Mail landet auf `/auth/callback` und von dort auf `/passwort-neu`.

## 3. Lokal starten

```bash
npm install
npm run dev
```

Unter [http://localhost:3000](http://localhost:3000) auf **Firma anlegen**
gehen — der erste Nutzer wird automatisch Admin.

## 4. Fristen-Erinnerungen per E-Mail (Edge Function + Resend)

[`supabase/functions/fristen-reminder`](./supabase/functions/fristen-reminder)
prüft täglich alle **aktiven** Fristen-Module und meldet jede Fälligkeit
innerhalb der nächsten 30 Tage an die Admins der jeweiligen Firma — inklusive
ablaufender Führerscheine. Deaktivierte Module werden übersprungen, und
`reminder_log` sorgt dafür, dass jede Fälligkeit nur einmal gemeldet wird.

```bash
supabase functions deploy fristen-reminder
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set REMINDER_FROM_EMAIL="Fuhrpark-Manager <noreply@deine-domain.de>"
```

Täglichen Aufruf einrichten — entweder über **Dashboard → Database → Cron Jobs**
(Template „Invoke Edge Function", Ziel `fristen-reminder`, z. B. `0 7 * * *`)
oder per SQL mit `pg_cron` + `pg_net` (Extensions vorher aktivieren):

```sql
select cron.schedule(
  'fristen-reminder-daily',
  '0 7 * * *', -- täglich 07:00 UTC
  $$
  select net.http_post(
    url := 'https://<dein-projekt-ref>.supabase.co/functions/v1/fristen-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <service-role-key>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Den `service-role-key` besser über
[Supabase Vault](https://supabase.com/docs/guides/database/vault) einbinden
statt im Klartext zu hinterlegen.

Die **Vorlaufzeit** stellt jeder Admin unter *Einstellungen → Firma* ein
(Standard 30 Tage); wer keine Erinnerungen möchte, schaltet sie unter
*Einstellungen → Darstellung & Erfassung* für sich ab.

## 5. Kontolöschung (Edge Function)

Damit Nutzer ihr Konto selbst löschen können (Art. 17 DSGVO), muss die Function
`delete-account` deployt sein — sie braucht den Service-Role-Key, den die App im
Browser nicht haben darf:

```bash
supabase functions deploy delete-account
```

Die Function löscht immer nur das Konto des Aufrufers (identifiziert über dessen
JWT), entfernt seine Belege aus dem Storage und blockt den letzten Admin einer
Firma mit weiteren Mitgliedern. Ist der Nutzer das letzte Firmenmitglied, wird
die Firma samt aller Daten gelöscht.

## Push-Benachrichtigungen einrichten

```bash
npx web-push generate-vapid-keys
```

Den öffentlichen Schlüssel als `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in der App
hinterlegen, beide Schlüssel als Function-Secrets:

```bash
supabase secrets set VAPID_PUBLIC_KEY=<public>
supabase secrets set VAPID_PRIVATE_KEY=<private>
supabase secrets set VAPID_SUBJECT="mailto:admin@deine-domain.de"
```

Nutzer aktivieren Push dann unter *Einstellungen → Push-Benachrichtigungen*.
Auf dem iPhone geht das erst, wenn die App zum Home-Bildschirm hinzugefügt
wurde — das sagt die Oberfläche auch so.

## Offline arbeiten

Ohne Verbindung landen neue Einträge in einer lokalen Warteschlange
(IndexedDB) und werden automatisch übertragen, sobald wieder Netz da ist. Ein
Hinweisbalken zeigt an, wie viele Einträge noch warten. Bewusst nur beim
Anlegen — Änderungen offline zu puffern würde Konfliktauflösung erfordern.

## Eigene Einträge korrigieren

Mitarbeiter dürfen ihre Einträge **24 Stunden lang** selbst ändern oder
löschen; danach nur noch Admins. Das Zeitfenster steckt in der RLS-Policy
(`within_correction_window`), die Oberfläche blendet die Schaltfläche nur
entsprechend ein.

## iOS-App

Siehe [`APPSTORE.md`](./APPSTORE.md) — dort steht, wie das Xcode-Projekt
entsteht, was Apple verlangt und wo das Ablehnungsrisiko liegt.

## Zugriffsmodell (Row Level Security)

Alles ist an die Firma gebunden; Fahrzeugzugriff läuft über die
Datenbankfunktion `can_access_vehicle()` — Admin der Firma **oder** aktuell
zugewiesener Fahrer.

| Ressource | Mitarbeiter | Admin |
| --- | --- | --- |
| `vehicles` | nur zugewiesene Fahrzeuge lesen, Fahrerfelder pflegen | gesamte Flotte lesen/schreiben |
| `entries` | eigene Einträge auf eigenem Fahrzeug | alle Einträge der Firma |
| `logbook_entries` | eigene Fahrten auf eigenem Fahrzeug | alle Fahrten |
| `workshop_records` | lesen | lesen/schreiben |
| `documents` | lesen & hochladen (eigenes Fahrzeug) | alles, inkl. löschen |
| `fuel_cards` | Karte des eigenen Fahrzeugs | alle Karten |
| `profiles` | eigenes Profil | alle Profile der Firma |
| `user_settings` | nur eigene Präferenzen | nur eigene Präferenzen |
| Modul-Einstellungen | lesen | schreiben |
| Storage `receipts` / `documents` | eigener Ordner bzw. eigenes Fahrzeug | alles |

Fremde Firmen sind auf Datenbankebene unerreichbar — nicht nur in der UI.

## Projektstruktur

```
public/                        Manifest, Icons, Service Worker, Offline-Seite
supabase/migrations/           Schema, RLS-Policies, Storage-Buckets
supabase/functions/            Fristen-Erinnerungen und Kontolöschung
src/lib/modules.ts             Zentrale Definition aller Module und Felder
src/lib/deadlines.ts           Fristenberechnung und Status
src/lib/settings.ts            Präferenzen, Theme-Schlüssel, App-Version
src/lib/auth.ts                Session, Rollen, Modul-Auflösung
src/lib/supabase/              Browser-/Server-/Proxy-Clients
src/app/registrieren/          Firma anlegen oder per Code beitreten
src/app/onboarding/            Firma nachträglich verbinden
src/app/admin/                 Übersicht, Fahrzeuge, Team, Module
src/app/fahrzeuge/[id]/        Fahrzeug-Detailseite (alle Module)
src/app/mitarbeiter/           Zugewiesene Fahrzeuge
src/app/einstellungen/         Präferenzen, Konto, Firma, Rechtliches
src/app/rechtliches/           Datenschutz, Impressum, Nutzungsbedingungen
src/components/                UI-Bausteine, Navigation und Formulare
src/proxy.ts                   Next.js Proxy (ehem. Middleware) für Session-/Route-Schutz
```

## Deployment

[Vercel](https://vercel.com/new): Repo importieren, die beiden
`NEXT_PUBLIC_SUPABASE_*`-Variablen setzen, deployen. Die App ist
mobiloptimiert und läuft im Browser — für eine App-Store-Variante lässt sie
sich als PWA installieren oder mit Capacitor verpacken.
