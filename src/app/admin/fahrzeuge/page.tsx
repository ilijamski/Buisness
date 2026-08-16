import { requireActiveAdmin, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle } from "@/components/ui";
import { VehicleSearch } from "@/components/VehicleSearch";
import { VehicleForm } from "@/components/VehicleForm";
import { VehicleImport } from "@/components/admin/VehicleImport";
import type { AssignmentWithDriver, Vehicle } from "@/lib/types";

export default async function AdminVehiclesPage() {
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

  const driverNames = new Map(
    ((assignments as AssignmentWithDriver[] | null) ?? []).map((a) => [
      a.vehicle_id,
      a.profiles?.full_name || a.profiles?.email || "—",
    ]),
  );

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Fahrzeuge"
          subtitle="Jedes Fahrzeug erhält automatisch eine fortlaufende Fahrzeug-Nummer."
        />

        <Card title="Flotte">
          <VehicleSearch
            vehicles={(vehicles as Vehicle[] | null) ?? []}
            config={config}
            driverNames={driverNames}
          />
        </Card>

        <Card title="Fahrzeug hinzufügen">
          <VehicleForm config={config} />
        </Card>

        <Card title="Mehrere Fahrzeuge auf einmal">
          <VehicleImport />
        </Card>
      </main>
    </>
  );
}
