# App Store: Was noch zu tun ist

Der Code ist so weit vorbereitet, dass die iOS-App gebaut werden kann. Was
hier steht, lässt sich **nicht** im Repository erledigen — dafür braucht es
einen Mac mit Xcode, einen Apple-Developer-Account (99 USD/Jahr) und eine
öffentlich erreichbare Domain.

## Ehrliche Einschätzung zum Ablehnungsrisiko

Apple prüft nach Richtlinie **4.2 (Minimum Functionality)**, ob eine App mehr
ist als eine verpackte Website. Unsere App wird vom Server geladen — das
allein wäre ein Ablehnungsgrund. Dagegen stehen die eingebauten nativen
Funktionen:

| Funktion | Umsetzung |
| --- | --- |
| Push über APNs | `@capacitor/push-notifications`, Token landet in `push_subscriptions` |
| Systemkamera | `@capacitor/camera`, Button „Mit Kamera aufnehmen" im Eintragsformular |
| Offline-Erfassung | IndexedDB-Warteschlange, synchronisiert bei Reconnect |
| Haptik | Rückmeldung nach dem Speichern |
| Statusleiste | folgt dem gewählten Farbschema |

Das ist eine belastbare Grundlage, **aber keine Garantie**. Wer auf Nummer
sicher gehen will, ergänzt vor der Einreichung noch mindestens eine Funktion,
die es im Web gar nicht gibt — naheliegend wäre ein **Home-Screen-Widget mit
der nächsten Frist** oder **Siri-Kurzbefehle** („Kilometerstand eintragen").

Für den **Play Store** ist die Lage entspannter: Eine Trusted Web Activity
(Bubblewrap) oder dieselbe Capacitor-App wird dort regelmäßig akzeptiert.

## Bezahlung: warum das Abo nicht in der App verkauft wird

Apple verlangt nach Richtlinie **3.1.1** für digitale Käufe innerhalb der App
die eigene In-App-Purchase-Abwicklung und behält 15–30 % ein. Deshalb ist die
App so gebaut, wie es B2B-SaaS-Anbieter üblicherweise handhaben:

- Das Abo wird **im Web** abgeschlossen (Stripe).
- In der nativen App blendet `PlanPicker` die Kaufoberfläche aus und zeigt
  nur den Hinweis, dass das Abo im Firmenkonto verwaltet wird.
- Es gibt **keinen Link** und **keine Aufforderung** zum Kauf in der App —
  genau das würde Apple beanstanden.

Die Testcode-Einlösung bleibt sichtbar: Sie ist kein Kauf.

> **Wichtig für die Review:** Apple prüft, ob die App auch ohne Kauf sinnvoll
> nutzbar ist. Der 30-tägige Probemonat deckt das ab — lege dem Prüfer
> zusätzlich einen Testcode und einen Demo-Zugang bereit, damit er nicht vor
> einer Bezahlschranke steht.

## Sign in with Apple

Die App bietet Google-Login an — damit ist **Sign in with Apple auf iOS
Pflicht** (Richtlinie 4.8). Beides ist eingebaut; die Einrichtung im Apple
Developer Portal und in Supabase steht in der README.

## 1. Voraussetzungen

- App unter fester HTTPS-Domain deployen (z. B. Vercel)
- `NEXT_PUBLIC_SITE_URL` auf genau diese Domain setzen — `capacitor.config.ts`
  liest sie aus
- Apple Developer Program Mitgliedschaft
- Mac mit aktuellem Xcode

## 2. iOS-Projekt erzeugen

```bash
npm install
npx cap add ios
npx cap sync ios
```

Danach die vorbereiteten Dateien übernehmen:

```bash
cp ios-assets/PrivacyInfo.xcprivacy ios/App/App/PrivacyInfo.xcprivacy
```

- `PrivacyInfo.xcprivacy` in Xcode dem Target **App** hinzufügen
  (Pflicht seit Mai 2024, sonst wird der Upload abgelehnt)
- Einträge aus `ios-assets/Info.plist.snippet.xml` in `ios/App/App/Info.plist`
  einfügen
- In Xcode unter **Signing & Capabilities** ergänzen:
  **Push Notifications** und **Background Modes → Remote notifications**

## 3. Push über APNs

1. Im Apple Developer Portal einen **APNs Auth Key** (.p8) erzeugen
2. Key, Key-ID und Team-ID beim Push-Dienst hinterlegen
3. Der Gerätetoken wird von `NativeShell` automatisch in
   `push_subscriptions` mit `platform = 'ios'` gespeichert

> **Noch offen:** Die Edge Function `fristen-reminder` verschickt aktuell nur
> **Web Push**. Für native iOS-Pushes muss der APNs-Versand ergänzt werden
> (die Tokens liegen bereits richtig in der Datenbank). Solange das fehlt,
> bekommen iOS-Nutzer Erinnerungen per E-Mail und — bei installierter PWA —
> per Web Push.

## 4. App-Icons und Startbildschirm

Die vorhandenen Icons in `public/` sind für Web gedacht. Für iOS braucht es
einen vollständigen Asset-Katalog:

```bash
npm install -g @capacitor/assets
npx capacitor-assets generate --ios
```

Als Quelle ein 1024×1024-PNG unter `assets/icon.png` ablegen.

## 5. Pflichtangaben in App Store Connect

- **Datenschutz-URL:** `https://<deine-domain>/rechtliches/datenschutz`
  (ist ohne Login erreichbar — Apple prüft das)
- **App-Datenschutz-Angaben:** E-Mail, Name, Fotos, Nutzerinhalte — jeweils
  „mit Nutzer verknüpft", **kein** Tracking
- **Kontolöschung:** vorhanden unter *Einstellungen → Konto löschen*
  (Pflicht seit Juni 2022)
- **Demo-Zugang für die Prüfung:** ein Testkonto mit Firma, mindestens einem
  Fahrzeug und Beispieldaten anlegen und die Zugangsdaten hinterlegen — ohne
  das wird die App fast sicher abgelehnt
- **Screenshots:** 6,7″ und 6,5″ iPhone, dazu 12,9″ iPad falls iPad unterstützt
- **Altersfreigabe:** 4+
- **Kategorie:** Wirtschaft (Business)

## 6. Was Apple bei Business-Apps zusätzlich prüft

Da sich Mitarbeiter nur mit einem Firmen-Code registrieren können, sieht die
App für Prüfer zunächst „leer" aus. Deshalb im Feld *App Review Information*
kurz erklären, wie der Ablauf ist, und **beide** Wege demonstrierbar machen:
ein Admin-Konto und den Firmen-Code für einen Mitarbeiter-Testaccount.

Ist die App nur für die eigene Belegschaft gedacht, ist das **Apple Business
Manager / Custom App**-Programm der deutlich einfachere Weg — dort entfällt
die öffentliche Review nach 4.2 weitgehend.

## 7. Build und Upload

```bash
npx cap sync ios
npx cap open ios
```

In Xcode: Team wählen, Bundle-ID `de.fuhrparkmanager.app` (oder eigene) setzen,
Archive erstellen und über den Organizer hochladen. Erst über TestFlight
verteilen und auf einem echten Gerät prüfen — besonders Kamera, Push und das
Verhalten ohne Netz.
