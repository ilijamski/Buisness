import Link from "next/link";
import { requireAdmin, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, Badge, EmptyState } from "@/components/ui";
import { LicenseForm } from "@/components/LicenseForm";
import { isEnabled } from "@/lib/modules";
import { daysUntil, statusFor } from "@/lib/deadlines";
import { formatDate } from "@/lib/format";
import type { AssignmentWithDriver, Profile, Vehicle } from "@/lib/types";

export default async function AdminStaffPage() {
  const { profile, company } = await requireAdmin();
  const config = await loadCompanyModules(profile.company_id!);
  const supabase = await createClient();

  const [{ data: staff }, { data: vehicles }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("*").order("employee_number"),
    supabase.from("vehicles").select("*"),
    supabase
      .from("vehicle_assignments")
      .select("*, profiles(id, full_name, email, employee_number)")
      .is("ended_on", null),
  ]);

  const staffList = (staff as Profile[] | null) ?? [];
  const vehicleList = (vehicles as Vehicle[] | null) ?? [];
  const assignmentList = (assignments as AssignmentWithDriver[] | null) ?? [];

  const vehiclesByDriver = new Map<string, Vehicle[]>();
  for (const assignment of assignmentList) {
    const vehicle = vehicleList.find((v) => v.id === assignment.vehicle_id);
    if (!vehicle) continue;
    const list = vehiclesByDriver.get(assignment.driver_id) ?? [];
    list.push(vehicle);
    vehiclesByDriver.set(assignment.driver_id, list);
  }

  const licenseEnabled = isEnabled(config, "license");

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Mitarbeiter"
          subtitle="Fahrzeuge werden auf der jeweiligen Fahrzeugseite über die Mitarbeiter-Nummer zugewiesen."
        />

        <Card title="Firmen-Code weitergeben">
          <p className="text-sm text-muted">
            Mitarbeiter registrieren sich unter <code>/registrieren</code> mit diesem Code
            und erhalten automatisch eine fortlaufende Mitarbeiter-Nummer.
          </p>
          <p className="mt-2 font-mono text-lg tracking-widest">{company?.join_code ?? "—"}</p>
        </Card>

        {staffList.length === 0 ? (
          <Card title="Team">
            <EmptyState>Noch niemand registriert.</EmptyState>
          </Card>
        ) : (
          staffList.map((person) => {
            const assigned = vehiclesByDriver.get(person.id) ?? [];
            const licenseDays = person.license_expires_on
              ? daysUntil(person.license_expires_on)
              : null;

            return (
              <Card
                key={person.id}
                title={`Nr. ${person.employee_number ?? "—"} · ${person.full_name ?? person.email}`}
                action={
                  <Badge tone={person.role === "admin" ? "warn" : "neutral"}>
                    {person.role === "admin" ? "Admin" : "Mitarbeiter"}
                  </Badge>
                }
              >
                <div className="space-y-3">
                  <p className="text-sm text-muted">{person.email}</p>

                  <div>
                    <p className="text-sm font-medium">Zugewiesene Fahrzeuge</p>
                    {assigned.length === 0 ? (
                      <EmptyState>Kein Fahrzeug zugewiesen.</EmptyState>
                    ) : (
                      <ul className="mt-1 space-y-1 text-sm">
                        {assigned.map((vehicle) => (
                          <li key={vehicle.id}>
                            <Link
                              href={`/fahrzeuge/${vehicle.id}`}
                              className="underline-offset-2 hover:underline"
                            >
                              #{vehicle.vehicle_number} {vehicle.name} ({vehicle.plate})
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {licenseEnabled && (
                    <div className="border-t border-border pt-3">
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-sm font-medium">Führerschein</p>
                        {licenseDays !== null && statusFor(licenseDays) !== "ok" && (
                          <Badge tone={licenseDays < 0 ? "danger" : "warn"}>
                            {licenseDays < 0
                              ? "abgelaufen"
                              : `läuft in ${licenseDays} Tagen ab`}
                          </Badge>
                        )}
                        {person.license_expires_on && (
                          <span className="text-xs text-muted">
                            gültig bis {formatDate(person.license_expires_on)}
                          </span>
                        )}
                      </div>
                      <LicenseForm profile={person} />
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </main>
    </>
  );
}
