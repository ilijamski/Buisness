import { LegalPage, Section, Placeholder } from "@/components/LegalPage";

export const metadata = { title: "Nutzungsbedingungen · Fuhrpark-Manager" };

export default function TermsPage() {
  return (
    <LegalPage title="Nutzungsbedingungen" updated="August 2026">
      <Section title="1. Geltungsbereich">
        <p>
          Diese Bedingungen regeln die Nutzung der Anwendung „Fuhrpark-Manager“,
          betrieben von <Placeholder>Firmenname</Placeholder>. Die App richtet sich
          an Unternehmen und deren Beschäftigte zur Verwaltung betrieblicher
          Fahrzeuge.
        </p>
      </Section>

      <Section title="2. Konten und Firmenzugehörigkeit">
        <p>
          Wer eine Firma anlegt, wird deren Admin und verwaltet Fahrzeuge, Module und
          Mitgliedschaften. Beschäftigte treten über den Firmen-Code bei. Zugangsdaten
          sind vertraulich zu behandeln und dürfen nicht weitergegeben werden. Ein
          Konto darf nur von der Person genutzt werden, für die es angelegt wurde.
        </p>
      </Section>

      <Section title="3. Verantwortung für Inhalte">
        <p>
          Für Richtigkeit und Aktualität der eingetragenen Daten — insbesondere
          Prüftermine, Kilometerstände und Fahrtenbucheinträge — ist allein die
          nutzende Firma verantwortlich.
        </p>
      </Section>

      <Section title="4. Erinnerungsfunktion">
        <p>
          Die App kann an bevorstehende Fristen erinnern. Diese Erinnerungen sind eine
          freiwillige Serviceleistung und ersetzen <strong>nicht</strong> die eigene
          Fristenkontrolle. Ein Anspruch auf Zustellung besteht nicht; die gesetzliche
          Verantwortung für die Einhaltung von Prüf- und Halterpflichten bleibt
          unberührt.
        </p>
      </Section>

      <Section title="5. Verfügbarkeit">
        <p>
          Es wird keine bestimmte Verfügbarkeit zugesichert. Wartungsarbeiten,
          Störungen bei eingesetzten Dienstleistern oder höhere Gewalt können zu
          Unterbrechungen führen.
        </p>
      </Section>

      <Section title="6. Haftung">
        <p>
          Die Haftung richtet sich nach den gesetzlichen Vorschriften. Für leichte
          Fahrlässigkeit wird nur bei Verletzung wesentlicher Vertragspflichten und
          begrenzt auf den vertragstypischen, vorhersehbaren Schaden gehaftet. Die
          Haftung für Schäden aus der Verletzung von Leben, Körper oder Gesundheit
          sowie nach dem Produkthaftungsgesetz bleibt unberührt.
        </p>
      </Section>

      <Section title="7. Beendigung">
        <p>
          Das Konto kann jederzeit unter <strong>Einstellungen → Konto löschen</strong>{" "}
          gelöscht werden. Löscht das letzte Mitglied einer Firma sein Konto, werden
          auch sämtliche Firmendaten unwiderruflich entfernt.
        </p>
      </Section>

      <Section title="8. Änderungen">
        <p>
          Änderungen dieser Bedingungen werden rechtzeitig angekündigt. Wer die App
          nach Inkrafttreten weiter nutzt, stimmt den geänderten Bedingungen zu.
        </p>
      </Section>

      <Section title="9. Anwendbares Recht">
        <p>
          Es gilt deutsches Recht. Gerichtsstand ist, soweit zulässig,{" "}
          <Placeholder>Gerichtsstand</Placeholder>.
        </p>
      </Section>
    </LegalPage>
  );
}
