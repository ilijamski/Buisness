import Link from "next/link";
import { requireActiveAdmin, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { PageTitle, Card, EmptyState } from "@/components/ui";
import { DeadlineTable } from "@/components/admin/DeadlineTable";
import { vehicleDeadlines } from "@/lib/deadlines";
import { MODULES } from "@/lib/modules";
import type { AssignmentWithDriver, Vehicle } from "@/lib/types";

/**
 * Alle Fristen der Flotte auf einer Seite.
 *
 * Die Übersicht zeigt nur die dringendsten und deckelt bei zehn je Block.
 * Wer den Werkstattplan fürs nächste Quartal macht, braucht die vollständige
 * Liste — filterbar nach Art der Frist und mit dem zuständigen Fahrer daneben,
 * weil der das Fahrzeug hinbringt.
 */
export default async function DeadlinesPage() {
  const { profile, company } = await requireActiveAdmin();
  const config = await loadCompanyModules(profile.company_id!);
  const supabase = await createClient();

  const [{ data: vehicles }, { data: assignments }] = await Promise.all([
    supabase.from("vehicles").select("*").order("vehicle_number"),
    supabase
      .from("vehicle_assignments")
      .select("*, profiles(id, full_name, email, employee_number)")
      .is("ended_on", null),
  ]);

  const vehicleList = (vehicles as Vehicle[] | null) ?? [];
  const driverNames = new Map(
    ((assignments as AssignmentWithDriver[] | null) ?? []).map((a) => [
      a.vehicle_id,
      a.profiles?.full_name || a.profiles?.email || "",
    ]),
  );

  const rows = vehicleList
    .flatMap((vehicle) =>
      vehicleDeadlines(vehicle, config).map((deadline) => ({
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        plate: vehicle.plate,
        driver: driverNames.get(vehicle.id) ?? "",
        moduleKey: deadline.moduleKey,
        label: deadline.label,
        date: deadline.date,
        daysLeft: deadline.daysLeft,
      })),
    )
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Nur Fristenarten anbieten, die tatsächlich vorkommen — ein Filter mit
  // leeren Auswahlmöglichkeiten führt in die Irre.
  const present = new Set(rows.map((row) => row.moduleKey));
  const kinds = MODULES.filter((mod) => present.has(mod.key)).map((mod) => ({
    key: mod.key,
    label: mod.label,
  }));

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Fristen"
          subtitle="Alle überwachten Termine der Flotte, dringendste zuerst."
          action={
            <Link href="/export/fristen" className="text-sm text-accent underline">
              Als CSV
            </Link>
          }
        />

        <Card>
          {rows.length === 0 ? (
            <EmptyState>
              Noch keine Fristen hinterlegt. Trag bei einem Fahrzeug ein HU- oder
              Versicherungsdatum ein, dann erscheint es hier.
            </EmptyState>
          ) : (
            <DeadlineTable rows={rows} kinds={kinds} />
          )}
        </Card>
      </main>
    </>
  );
}
