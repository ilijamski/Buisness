# LifeOS

Ein persönliches Betriebssystem: Aufgaben, Kalender, Ziele, Gewohnheiten, Notizen,
Finanzen und Projekte an einem Ort – mit Dashboard, Statistiken und Wochenbericht.

LifeOS ist eine eigenständige Next.js-App in diesem Unterordner und unabhängig vom
Fuhrpark-Manager im Repo-Stamm (eigene `package.json`, eigene Datenbank, eigene Konten).

## Schnellstart

```bash
cd lifeos
npm install
npm run dev        # http://localhost:3000
```

Es ist nichts weiter einzurichten: Ohne `DATABASE_URL` nutzt LifeOS ein eingebettetes
Postgres (PGlite) und speichert dauerhaft unter `lifeos/.data/`. Konto registrieren,
auf dem leeren Dashboard „Beispieldaten laden“ wählen – fertig.

## Funktionen

| Bereich | Was er kann |
| --- | --- |
| Dashboard | Tagesübersicht: fällige Aufgaben, Termine, Gewohnheiten zum Abhaken, Monatssaldo, Zielfortschritt, Wochenverlauf |
| Aufgaben | Prioritäten, Status, Fälligkeit, Projektzuordnung, Schnellerfassung, Filter und Suche; wiederkehrende Aufgaben legen beim Erledigen die nächste an |
| Kalender | Monatsansicht mit Terminen und fälligen Aufgaben, Tagesagenda; mehrtägige Termine und Serien (täglich, wöchentlich, monatlich, jährlich, optional mit Enddatum) |
| Projekte | Kanban-Board (Drag & Drop) mit Fortschritt je Projekt |
| Ziele | Messbare Ziele mit Zielwert, Einheit, Termin und Fortschrittsring |
| Gewohnheiten | 7-Tage-Raster, Serien, Wochenziel, Heatmap über 18 Wochen |
| Notizen | Zweispaltiger Editor mit automatischem Speichern, Anheften, Suche |
| Finanzen | Konten mit Kontostand, Import von Kontoauszügen (CSV) mit automatischer Kategorie und Dubletten-Erkennung, Einnahmen/Ausgaben, Sparquote, 6-Monats-Verlauf, Monatsbudgets |
| Statistiken | Wochenbericht in Worten, Vergleich zur Vorwoche, 12-Wochen-Trends, Tabellenansicht |
| Einstellungen | Profil, Passwort, JSON-Export, Inhalte oder Konto löschen |

Überall erreichbar: Befehlspalette mit `⌘K` / `Strg+K` – durchsucht Aufgaben, Notizen, Termine,
Projekte und Ziele, öffnet Bereiche oder legt direkt eine Aufgabe an.

## Architektur

```
src/
  app/                 Routen (App Router). Seiten laden Daten und reichen sie an Views weiter.
    (auth)/            Anmeldung, Registrierung
    (app)/             Geschützter Bereich mit App-Hülle
    api/export/        JSON-Export
  features/<bereich>/  Ein Ordner je Fachbereich:
    queries.ts           lesende Datenbankzugriffe (nur Server)
    actions.ts           schreibende Server Actions
    *-view.tsx           interaktive Oberfläche (Client)
  components/
    ui/                Buttons, Dialoge, Toasts, Formularbausteine
    charts/            Säulen-, Linien-, Ring-Diagramm und Heatmap (SVG, mit Tooltips)
    shell/             Seitenleiste, mobile Navigation, Befehlspalette
  db/                  Schema (Drizzle), Migrationen, Verbindung
  lib/                 Datumslogik, Formatierung, Validierung, Sitzungen
```

Regeln, die überall gelten:

- **Jede** schreibende Action läuft durch `userAction` (`src/lib/action.ts`): Anmeldung prüfen,
  Eingabe mit zod validieren, Fehler abfangen, Seiten neu rendern.
- **Jede** Abfrage filtert nach `user_id` – fremde Daten sind nicht erreichbar.
- Kalendertage werden als `YYYY-MM-DD` ohne Zeitzone gespeichert; „heute“ richtet sich nach
  der Zeitzone des Browsers (Cookie `lifeos_tz`).
- Geldbeträge sind ganze Cent, nie Fließkommazahlen.
- Serientermine werden als **eine** Zeile gespeichert und beim Lesen zu Vorkommen aufgefächert
  (`src/features/calendar/recurrence.ts`, mit Unit-Tests).

## Kontoauszüge und Bankanbindung

**Heute:** Unter Finanzen → „Kontoauszug importieren“ liest LifeOS den CSV-Export einer Bank ein
(`src/features/finance/csv.ts`): Trennzeichen, Vorspann, Windows-1252, deutsche Datums- und
Zahlenformate sowie getrennte Soll/Haben-Spalten werden erkannt. Jede Buchung bekommt eine
stabile Kennung (`external_id`), sodass derselbe Auszug beliebig oft eingelesen werden kann,
ohne Dubletten zu erzeugen. Kategorien folgen zuerst dem, wie derselbe Zahlungspartner zuletzt
eingeordnet wurde, danach Stichwörtern.

**Noch nicht:** ein automatischer Abruf direkt bei der Bank. Dafür ist ein lizenzierter
Kontoinformationsdienst (PSD2) mit eigenen Zugangsdaten nötig. Der Import ist so gebaut, dass
ein solcher Abruf dieselbe Aufbereitung (`prepare` in `src/features/finance/import.ts`) nutzt
und nur noch die Buchungen liefern muss.

## Datenbank

Postgres, angesprochen über Drizzle ORM. Zwei Betriebsarten mit demselben Schema:

| | Wann | Speicherort |
| --- | --- | --- |
| Eingebettet (PGlite) | `DATABASE_URL` nicht gesetzt | `lifeos/.data/pglite` |
| Postgres-Server | `DATABASE_URL` gesetzt | Supabase, Neon, eigener Server … |

Migrationen stehen in `src/db/migrations.ts`, laufen beim ersten Zugriff automatisch und
werden in der Tabelle `_migrations` protokolliert. Neue Änderungen als weiteren Eintrag
anhängen, bestehende nie ändern.

## Konten und Sicherheit

- Passwörter: scrypt mit zufälligem Salt, Vergleich in konstanter Zeit.
- Sitzungen: zufälliges Token im `httpOnly`-Cookie (30 Tage), in der Datenbank nur als
  SHA-256-Hash. Passwortwechsel beendet alle anderen Sitzungen.
- Anmeldung: nach 8 Fehlversuchen in 10 Minuten gesperrt (pro E-Mail und IP, im Arbeitsspeicher).
- Sicherheits-Header (`X-Frame-Options`, `nosniff`, `Referrer-Policy`) in `next.config.ts`.

## In Produktion betreiben

```bash
DATABASE_URL="postgres://…" npm run build
DATABASE_URL="postgres://…" npm start
```

Auf Vercel: Projekt mit **Root Directory `lifeos`** anlegen und `DATABASE_URL` als
Umgebungsvariable setzen. Die eingebettete Datenbank funktioniert dort nicht, weil das
Dateisystem nicht beschreibbar ist – die App meldet das mit einer klaren Fehlermeldung.

## Tests

```bash
npm test            # Unit-Tests: Datumslogik, Serientermine, Kontoauszug-Parser
npm run typecheck
npm run lint

# End-to-End über alle Bereiche (braucht eine laufende App und Playwright)
BASE_URL=http://localhost:3000 npm run test:e2e
```

Der E2E-Lauf registriert zwei Testkonten und prüft u. a. Anlegen/Ändern/Löschen in jedem
Bereich, Persistenz nach erneuter Anmeldung, Datentrennung zwischen Konten und das Layout
auf dem Smartphone.

## Bekannte Grenzen

- Kein „Passwort vergessen“ per E-Mail und keine E-Mail-Bestätigung (es ist kein Mailversand angebunden).
- Serientermine lassen sich nur als Ganzes ändern. Löschen geht für die ganze Serie oder „diesen und
  alle folgenden“ – ein einzelnes Vorkommen mitten aus einer Serie herauszunehmen geht nicht.
- Keine direkte Bankanbindung (siehe oben); Buchungen kommen per CSV-Import oder von Hand.
- Umbuchungen zwischen eigenen Konten werden nicht als solche erkannt – sie zählen als Ausgabe
  auf dem einen und Einnahme auf dem anderen Konto.
- Budgets gelten für jeden Monat gleich; abweichende Budgets einzelner Monate gibt es nicht.
- Währung ist fest Euro, Oberfläche fest Deutsch.
- Die Anmeldebremse zählt pro Serverinstanz; bei mehreren Instanzen gehört sie in die Datenbank.
