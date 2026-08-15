import { LegalPage, Section, Placeholder } from "@/components/LegalPage";
import { APP_VERSION } from "@/lib/settings";

export const metadata = { title: "Impressum · Fuhrpark-Manager" };

export default function ImprintPage() {
  return (
    <LegalPage title="Impressum">
      <Section title="Angaben gemäß § 5 DDG">
        <p>
          <Placeholder>Firmenname</Placeholder>
          <br />
          <Placeholder>Straße und Hausnummer</Placeholder>
          <br />
          <Placeholder>PLZ und Ort</Placeholder>
        </p>
        <p>
          Vertreten durch: <Placeholder>Geschäftsführung</Placeholder>
          <br />
          Registergericht: <Placeholder>Amtsgericht</Placeholder>, Registernummer{" "}
          <Placeholder>HRB-Nummer</Placeholder>
          <br />
          Umsatzsteuer-ID gemäß § 27a UStG: <Placeholder>USt-IdNr.</Placeholder>
        </p>
      </Section>

      <Section title="Kontakt">
        <p>
          Telefon: <Placeholder>Telefonnummer</Placeholder>
          <br />
          E-Mail: <Placeholder>Kontaktadresse</Placeholder>
        </p>
      </Section>

      <Section title="Verantwortlich für den Inhalt">
        <p>
          <Placeholder>Name</Placeholder>, Anschrift wie oben.
        </p>
      </Section>

      <Section title="Hinweis">
        <p>
          Diese Anwendung wird als internes Verwaltungswerkzeug betrieben. Trage die
          Kontaktdaten deiner Firma unter <strong>Einstellungen → Firma</strong> ein,
          damit sie hier und in der Datenschutzerklärung erscheinen.
        </p>
      </Section>

      <Section title="Anwendung">
        <p>Fuhrpark-Manager, Version {APP_VERSION}</p>
      </Section>
    </LegalPage>
  );
}
