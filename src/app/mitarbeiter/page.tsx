import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveSession, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, Notice, Badge } from "@/components/ui";
import { VehicleList } from "@/components/VehicleList";
import { EntryForm } from "@/components/forms/EntryForm";
import { isEnabled, isRequired } from "@/lib/modules";
import { urgentDeadlines, deadlineText } from "@/lib/deadlines";
import type { Vehicle } from "@/lib/types";

export default async function MitarbeiterPage() {
  const { profile, company } = await requireActiveSession();
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

  // Der häufigste Fall im Betrieb: ein Fahrer, ein Fahrzeug. Dann steht das
  // Erfassungsformular direkt hier — Tanken eintragen war vorher drei
  // Ebenen tief, und was drei Ebenen tief liegt, wird an der Zapfsäule
  // nicht gemacht.
  const soleVehicle = vehicleList.length === 1 ? vehicleList[0] : null;
  const dueSoon = soleVehicle ? urgentDeadlines(soleVehicle, config) : [];

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title={soleVehicle ? soleVehicle.name : "Meine Fahrzeuge"}
          subtitle={
            soleVehicle
              ? `${soleVehicle.plate} · Fahrzeug-Nr. ${soleVehicle.vehicle_number ?? "—"}`
              : `Deine Mitarbeiter-Nummer: ${profile.employee_number ?? "—"}`
          }
        />

        {vehicleList.length === 0 && (
          <Card>
            <Notice kind="info">
              Dir ist noch kein Fahrzeug zugewiesen. Gib deinem Fuhrpark-Admin deine
              Mitarbeiter-Nummer <strong>{profile.employee_number ?? "—"}</strong> durch,
              dann schaltet er dein Fahrzeug frei.
            </Notice>
          </Card>
        )}

        {/* Was der Fahrer wissen muss, bevor er losfährt. */}
        {dueSoon.length > 0 && soleVehicle && (
          <Card title="Fällig">
            <ul className="divide-y divide-border">
              {dueSoon.map((deadline) => (
                <li
                  key={deadline.moduleKey}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <p className="text-sm font-medium">{deadline.label}</p>
                  <Badge tone={deadline.status === "overdue" ? "danger" : "warn"}>
                    {deadlineText(deadline)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {soleVehicle ? (
          <>
            <Card title="Schnell erfassen">
              <EntryForm
                vehicleId={soleVehicle.id}
                showReceipt={isEnabled(config, "receipts")}
                showMileage={isEnabled(config, "mileage")}
                mileageRequired={isRequired(config, "mileage")}
                receiptRequired={isRequired(config, "receipts")}
              />
            </Card>

            <Card>
              <Link
                href={`/fahrzeuge/${soleVehicle.id}`}
                className="text-sm text-accent underline underline-offset-2"
              >
                Fahrzeug öffnen — Verlauf, Fahrtenbuch und Dokumente
              </Link>
            </Card>
          </>
        ) : (
          vehicleList.length > 0 && (
            <Card title="Zugewiesene Fahrzeuge">
              <VehicleList vehicles={vehicleList} config={config} />
            </Card>
          )
        )}
      </main>
    </>
  );
}
