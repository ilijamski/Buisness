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

      <Section title="4. Preise, Testphase und Laufzeit">
        <p>
          Die Nutzung kostet <strong>19,90 € pro Monat</strong> oder{" "}
          <strong>209,90 € pro Jahr</strong>, jeweils zuzüglich gesetzlicher
          Umsatzsteuer. Der Preis gilt je Firma, unabhängig von der Anzahl der
          Mitarbeiter und Fahrzeuge.
        </p>
        <p>
          Jede neu angelegte Firma erhält einen <strong>kostenlosen Probemonat
          über 30 Tage</strong>. Er endet automatisch; es entstehen keine Kosten,
          solange kein Abo abgeschlossen wird. Testcodes verlängern den
          kostenlosen Zeitraum um die jeweils angegebene Dauer.
        </p>
        <p>
          Das Monatsabo verlängert sich monatlich, das Jahresabo jährlich, sofern
          es nicht bis zum Ende des laufenden Zeitraums gekündigt wird. Die
          Kündigung ist jederzeit im Kundenportal unter <strong>Abo</strong>{" "}
          möglich und wirkt zum Ende des bereits bezahlten Zeitraums.
        </p>
        <p>
          Nach Ablauf des Zugangs bleiben die gespeicherten Daten erhalten und
          lassen sich weiterhin exportieren.
        </p>
      </Section>

      <Section title="5. Widerruf">
        <p>
          Das Angebot richtet sich an Unternehmen und Selbstständige im Rahmen
          ihrer gewerblichen Tätigkeit. Ein Widerrufsrecht für Verbraucher nach
          § 355 BGB besteht daher regelmäßig nicht. Sollte im Einzelfall doch ein
          Verbrauchervertrag vorliegen, gilt das gesetzliche Widerrufsrecht;
          wende dich dafür an <Placeholder>Kontaktadresse</Placeholder>.
        </p>
      </Section>

      <Section title="6. Erinnerungsfunktion">
        <p>
          Die App kann an bevorstehende Fristen erinnern. Diese Erinnerungen sind eine
          freiwillige Serviceleistung und ersetzen <strong>nicht</strong> die eigene
          Fristenkontrolle. Ein Anspruch auf Zustellung besteht nicht; die gesetzliche
          Verantwortung für die Einhaltung von Prüf- und Halterpflichten bleibt
          unberührt.
        </p>
      </Section>

      <Section title="7. Verfügbarkeit">
        <p>
          Es wird keine bestimmte Verfügbarkeit zugesichert. Wartungsarbeiten,
          Störungen bei eingesetzten Dienstleistern oder höhere Gewalt können zu
          Unterbrechungen führen.
        </p>
      </Section>

      <Section title="8. Haftung">
        <p>
          Die Haftung richtet sich nach den gesetzlichen Vorschriften. Für leichte
          Fahrlässigkeit wird nur bei Verletzung wesentlicher Vertragspflichten und
          begrenzt auf den vertragstypischen, vorhersehbaren Schaden gehaftet. Die
          Haftung für Schäden aus der Verletzung von Leben, Körper oder Gesundheit
          sowie nach dem Produkthaftungsgesetz bleibt unberührt.
        </p>
      </Section>

      <Section title="9. Beendigung">
        <p>
          Das Konto kann jederzeit unter <strong>Einstellungen → Konto löschen</strong>{" "}
          gelöscht werden. Löscht das letzte Mitglied einer Firma sein Konto, werden
          auch sämtliche Firmendaten unwiderruflich entfernt.
        </p>
      </Section>

      <Section title="10. Änderungen">
        <p>
          Änderungen dieser Bedingungen werden rechtzeitig angekündigt. Wer die App
          nach Inkrafttreten weiter nutzt, stimmt den geänderten Bedingungen zu.
        </p>
      </Section>

      <Section title="11. Anwendbares Recht">
        <p>
          Es gilt deutsches Recht. Gerichtsstand ist, soweit zulässig,{" "}
          <Placeholder>Gerichtsstand</Placeholder>.
        </p>
      </Section>
    </LegalPage>
  );
}
