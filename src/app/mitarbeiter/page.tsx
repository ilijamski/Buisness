import { redirect } from "next/navigation";
import { requireSession, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, Notice, EmptyState } from "@/components/ui";
import { VehicleList } from "@/components/VehicleList";
import type { Vehicle } from "@/lib/types";

export default async function MitarbeiterPage() {
  const { profile, company } = await requireSession();
  if (profile.role === "admin") {
    redirect("/admin");
  }

  const config = await loadCompanyModules(profile.company_id!);
  const supabase = await createClient();

  // RLS liefert Mitarbeitern ausschließlich die ihnen zugewiesenen Fahrzeuge.
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("vehicle_number");

  const vehicleList = (vehicles as Vehicle[] | null) ?? [];

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Meine Fahrzeuge"
          subtitle={`Deine Mitarbeiter-Nummer: ${profile.employee_number ?? "—"}`}
        />

        {vehicleList.length === 0 ? (
          <Card>
            <Notice kind="info">
              Dir ist noch kein Fahrzeug zugewiesen. Gib deinem Fuhrpark-Admin deine
              Mitarbeiter-Nummer <strong>{profile.employee_number ?? "—"}</strong> durch,
              dann schaltet er dein Fahrzeug frei.
            </Notice>
          </Card>
        ) : (
          <Card title="Zugewiesene Fahrzeuge">
            <VehicleList vehicles={vehicleList} config={config} />
          </Card>
        )}

        {vehicleList.length > 0 && (
          <Card>
            <EmptyState>
              Öffne ein Fahrzeug, um Tankungen, Fahrten, Schäden und Belege zu erfassen.
            </EmptyState>
          </Card>
        )}
      </main>
    </>
  );
}
