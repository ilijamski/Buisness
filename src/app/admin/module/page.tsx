import { requireActiveAdmin, loadCompanyModules } from "@/lib/auth";
import { Header } from "@/components/Header";
import { PageTitle, Card } from "@/components/ui";
import { ModuleSettingsForm } from "@/components/ModuleSettingsForm";

export default async function ModulePage() {
  const { profile, company } = await requireActiveAdmin();
  const config = await loadCompanyModules(profile.company_id!);

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Module"
          subtitle="Grundeinstellung für alle Fahrzeuge. Einzelne Fahrzeuge können davon abweichen."
        />

        <Card title="Firmen-Code">
          <p className="text-sm text-muted">
            Mit diesem Code registrieren sich deine Mitarbeiter und landen automatisch
            in eurer Firma.
          </p>
          <p className="mt-2 font-mono text-lg tracking-widest">
            {company?.join_code ?? "—"}
          </p>
        </Card>

        <div>
          <p className="mb-3 text-sm text-muted">
            <strong className="text-fg">Aktiv</strong> blendet den Bereich in der App ein.{" "}
            <strong className="text-fg">Pflicht</strong> macht die zugehörigen Felder zu
            Pflichtangaben beim Erfassen.
          </p>
          <ModuleSettingsForm config={config} />
        </div>
      </main>
    </>
  );
}
