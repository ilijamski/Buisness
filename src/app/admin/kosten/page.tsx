import { requireActiveAdmin, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle } from "@/components/ui";
import { CostOverview } from "@/components/admin/CostOverview";
import { summarizeCosts, costsByVehicle, costsByType } from "@/lib/costs";
import { isEnabled } from "@/lib/modules";
import type { Entry, Vehicle } from "@/lib/types";

/**
 * Kosten der Flotte.
 *
 * Stand vorher mit auf der Übersicht und hat sie mit aufgebläht. Wer Kosten
 * ansehen will, tut das gezielt — und hat dann gerne alles davon
 * beieinander, inklusive Export.
 */
export default async function AdminCostsPage() {
  const { profile, company } = await requireActiveAdmin();
  const config = await loadCompanyModules(profile.company_id!);
  const supabase = await createClient();

  const [{ data: vehicles }, { data: entries }] = await Promise.all([
    supabase.from("vehicles").select("*").order("vehicle_number"),
    supabase.from("entries").select("*"),
  ]);

  const vehicleList = (vehicles as Vehicle[] | null) ?? [];
  const entryList = (entries as Entry[] | null) ?? [];

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Kosten"
          subtitle="Was dieser Monat gekostet hat, im Vergleich zum letzten."
        />

        <CostOverview
          summary={summarizeCosts(entryList)}
          perVehicle={costsByVehicle(vehicleList, entryList)}
          perType={costsByType(entryList)}
        />

        <Card title="Export">
          <p className="mb-3 text-sm text-muted">
            Als CSV für Excel oder den Steuerberater (Semikolon-getrennt).
          </p>
          {/* eslint-disable @next/next/no-html-link-for-pages --
              Downloads brauchen echte Navigation; <Link> würde clientseitig
              routen und die Datei nie ausliefern. */}
          <div className="flex flex-wrap gap-2">
            <a
              href="/export/eintraege"
              className="inline-flex items-center rounded border border-border-strong bg-bg px-3 py-1.5 text-sm font-medium hover:bg-page"
            >
              Einträge exportieren
            </a>
            {isEnabled(config, "logbook") && (
              <a
                href="/export/fahrtenbuch"
                className="inline-flex items-center rounded border border-border-strong bg-bg px-3 py-1.5 text-sm font-medium hover:bg-page"
              >
                Fahrtenbuch exportieren
              </a>
            )}
          </div>
          {/* eslint-enable @next/next/no-html-link-for-pages */}
        </Card>
      </main>
    </>
  );
}
