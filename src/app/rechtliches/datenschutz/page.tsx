import { LegalPage, Section, Placeholder } from "@/components/LegalPage";

export const metadata = { title: "Datenschutz · Fuhrpark-Manager" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Datenschutzerklärung" updated="August 2026">
      <Section title="1. Verantwortlicher">
        <p>
          Verantwortlich für die Verarbeitung personenbezogener Daten in dieser
          Anwendung ist <Placeholder>Firmenname</Placeholder>,{" "}
          <Placeholder>Anschrift</Placeholder>, E-Mail{" "}
          <Placeholder>Kontaktadresse</Placeholder>. Sofern benannt, erreichst du
          den Datenschutzbeauftragten unter{" "}
          <Placeholder>Kontakt Datenschutzbeauftragter</Placeholder>.
        </p>
      </Section>

      <Section title="2. Welche Daten verarbeitet werden">
        <p>Die App verarbeitet ausschließlich die Daten, die du selbst einträgst:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Kontodaten:</strong> E-Mail-Adresse, Passwort (nur als
            Hashwert gespeichert), Name, Rolle, Mitarbeiter-Nummer.
          </li>
          <li>
            <strong>Fahrzeugdaten:</strong> Bezeichnung, Kennzeichen, Fahrgestellnummer,
            Prüf- und Wartungstermine, Kilometerstände, Vertrags- und Wertangaben.
          </li>
          <li>
            <strong>Nutzungsdaten:</strong> Fahrzeugzuordnungen, Einträge zu Tankungen,
            Wartungen und Schäden, Werkstatt-Historie.
          </li>
          <li>
            <strong>Fahrtenbuch:</strong> Datum, Start- und Ziel-Kilometerstand, Fahrtart
            (dienstlich, Arbeitsweg, privat), Start- und Zielort sowie Zweck der Fahrt.
          </li>
          <li>
            <strong>Führerscheindaten:</strong> Klassen und Ablaufdatum, sofern das
            entsprechende Modul aktiviert ist.
          </li>
          <li>
            <strong>Dateien:</strong> hochgeladene Belege und Fahrzeugdokumente.
          </li>
        </ul>
        <p>
          Es findet <strong>kein Tracking</strong> statt: Die App setzt keine Analyse-
          oder Werbe-Cookies und bindet keine externen Schriftarten oder Skripte ein.
          Gespeichert wird lediglich ein technisch notwendiges Sitzungs-Cookie für die
          Anmeldung sowie deine Anzeigepräferenz im lokalen Speicher des Geräts.
        </p>
      </Section>

      <Section title="3. Zweck und Rechtsgrundlage">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Verwaltung des Fuhrparks und Einhaltung gesetzlicher Prüfpflichten
            (HU/AU, UVV, Tachograf) — Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit
            der Halterverantwortung, sowie Art. 6 Abs. 1 lit. f DSGVO.
          </li>
          <li>
            Durchführung des Beschäftigungsverhältnisses, insbesondere Fahrzeug-
            zuordnung und Führerscheinkontrolle — § 26 BDSG, Art. 6 Abs. 1 lit. b DSGVO.
          </li>
          <li>
            Fahrtenbuch und Belege zur Erfüllung steuerlicher Aufbewahrungs- und
            Nachweispflichten — Art. 6 Abs. 1 lit. c DSGVO.
          </li>
        </ul>
      </Section>

      <Section title="4. Wer welche Daten sehen kann">
        <p>
          Der Zugriff ist technisch auf Datenbankebene beschränkt, nicht nur in der
          Oberfläche:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Mitarbeitende</strong> sehen ausschließlich die Fahrzeuge, denen
            sie aktuell als Fahrer zugewiesen sind, sowie ihre eigenen Einträge und
            Fahrten.
          </li>
          <li>
            <strong>Admins</strong> sehen alle Daten ihrer eigenen Firma.
          </li>
          <li>
            Ein Zugriff auf Daten anderer Firmen ist ausgeschlossen.
          </li>
        </ul>
      </Section>

      <Section title="5. Auftragsverarbeiter">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Supabase</strong> — Datenbank, Authentifizierung und Dateispeicher.
            Serverstandort: <Placeholder>Region des Supabase-Projekts</Placeholder>.
          </li>
          <li>
            <strong>Resend</strong> — Versand der Erinnerungs-E-Mails (Empfänger-
            adresse und Inhalt der Erinnerung).
          </li>
          <li>
            <strong>
              <Placeholder>Hosting-Anbieter</Placeholder>
            </strong>{" "}
            — Auslieferung der Anwendung.
          </li>
        </ul>
        <p>
          Mit diesen Dienstleistern ist jeweils ein Vertrag zur Auftragsverarbeitung
          nach Art. 28 DSGVO abzuschließen.
        </p>
      </Section>

      <Section title="6. Speicherdauer und Löschung">
        <p>
          Daten werden gespeichert, solange das Konto besteht. Über{" "}
          <strong>Einstellungen → Konto löschen</strong> kannst du dein Konto und die
          damit verbundenen personenbezogenen Daten jederzeit selbst unwiderruflich
          löschen. Löscht das letzte Mitglied einer Firma sein Konto, werden auch
          alle Firmendaten entfernt. Steuerlich relevante Unterlagen wie Fahrtenbücher
          und Belege können gesetzlichen Aufbewahrungsfristen unterliegen
          (regelmäßig sechs bis zehn Jahre nach AO und HGB).
        </p>
      </Section>

      <Section title="7. Deine Rechte">
        <p>
          Dir stehen Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
          Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und
          Widerspruch (Art. 21 DSGVO) zu. Außerdem kannst du dich bei einer
          Datenschutz-Aufsichtsbehörde beschweren, etwa bei{" "}
          <Placeholder>zuständige Aufsichtsbehörde</Placeholder>.
        </p>
      </Section>

      <Section title="8. Hinweis zur Mitbestimmung">
        <p>
          Fahrtenbuch und Fahrzeugzuordnung ermöglichen Rückschlüsse auf das Verhalten
          von Beschäftigten. In Betrieben mit Betriebsrat unterliegt der Einsatz
          solcher Funktionen regelmäßig der Mitbestimmung nach § 87 Abs. 1 Nr. 6
          BetrVG. Prüfe vor der Aktivierung dieser Module, ob eine Betriebsvereinbarung
          erforderlich ist — nicht benötigte Module lassen sich unter{" "}
          <strong>Module</strong> abschalten.
        </p>
      </Section>
    </LegalPage>
  );
}
