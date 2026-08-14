import Link from "next/link";
import { requireAdmin, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, Badge, EmptyState, DataList } from "@/components/ui";
import { VehicleList } from "@/components/VehicleList";
import { vehicleDeadlines, deadlineText, daysUntil, statusFor } from "@/lib/deadlines";
import { isEnabled } from "@/lib/modules";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AssignmentWithDriver, Entry, Profile, Vehicle } from "@/lib/types";

export default async function AdminPage() {
  const { profile, company } = await requireAdmin();
  const config = await loadCompanyModules(profile.company_id!);
  const supabase = await createClient();

  const [{ data: vehicles }, { data: entries }, { data: assignments }, { data: staff }] =
    await Promise.all([
      supabase.from("vehicles").select("*").order("vehicle_number"),
      supabase.from("entries").select("*"),
      supabase
        .from("vehicle_assignments")
        .select("*, profiles(id, full_name, email, employee_number)")
        .is("ended_on", null),
      supabase.from("profiles").select("*"),
    ]);

  const vehicleList = (vehicles as Vehicle[] | null) ?? [];
  const entryList = (entries as Entry[] | null) ?? [];
  const assignmentList = (assignments as AssignmentWithDriver[] | null) ?? [];
  const staffList = (staff as Profile[] | null) ?? [];

  const driverNames = new Map(
    assignmentList.map((a) => [
      a.vehicle_id,
      a.profiles?.full_name || a.profiles?.email || "—",
    ]),
  );

  // Kosten je Fahrzeug
  const costs = new Map<string, number>();
  for (const entry of entryList) {
    costs.set(entry.vehicle_id, (costs.get(entry.vehicle_id) ?? 0) + Number(entry.cost));
  }
  const totalCost = [...costs.values()].reduce((sum, value) => sum + value, 0);

  // Alle offenen Fristen der Flotte, dringendste zuerst
  const openDeadlines = vehicleList
    .flatMap((vehicle) =>
      vehicleDeadlines(vehicle, config)
        .filter((d) => d.status !== "ok")
        .map((d) => ({ vehicle, deadline: d })),
    )
    .sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft);

  // Ablaufende Führerscheine (eigenes Modul)
  const expiringLicenses = isEnabled(config, "license")
    ? staffList
        .filter((p) => p.license_expires_on)
        .map((p) => ({ profile: p, daysLeft: daysUntil(p.license_expires_on!) }))
        .filter((item) => statusFor(item.daysLeft) !== "ok")
        .sort((a, b) => a.daysLeft - b.daysLeft)
    : [];

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Übersicht"
          subtitle={`${vehicleList.length} Fahrzeuge · ${staffList.length} Mitarbeiter`}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-xs text-muted">Fahrzeuge</p>
            <p className="text-2xl font-semibold">{vehicleList.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Offene Fristen</p>
            <p className="text-2xl font-semibold">{openDeadlines.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Kosten gesamt</p>
            <p className="text-2xl font-semibold">{formatCurrency(totalCost)}</p>
          </Card>
        </div>

        <Card title="Anstehende Fristen">
          {openDeadlines.length === 0 ? (
            <EmptyState>Keine Fristen in den nächsten 30 Tagen.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {openDeadlines.slice(0, 15).map(({ vehicle, deadline }) => (
                <li
                  key={`${vehicle.id}-${deadline.moduleKey}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <div>
                    <Link
                      href={`/fahrzeuge/${vehicle.id}`}
                      className="text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {vehicle.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {vehicle.plate} · {deadline.label} · {formatDate(deadline.date)}
                    </p>
                  </div>
                  <Badge tone={deadline.status === "overdue" ? "danger" : "warn"}>
                    {deadlineText(deadline)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {expiringLicenses.length > 0 && (
          <Card title="Führerscheine">
            <ul className="divide-y divide-border">
              {expiringLicenses.map(({ profile: person, daysLeft }) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{person.full_name ?? person.email}</p>
                    <p className="text-xs text-muted">
                      {person.license_classes ?? "Klassen unbekannt"} ·{" "}
                      {formatDate(person.license_expires_on!)}
                    </p>
                  </div>
                  <Badge tone={daysLeft < 0 ? "danger" : "warn"}>
                    {daysLeft < 0 ? `seit ${Math.abs(daysLeft)} Tagen abgelaufen` : `in ${daysLeft} Tagen`}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card
          title="Kosten pro Fahrzeug"
          action={
            <Link href="/admin/fahrzeuge" className="text-sm text-accent underline">
              Alle Fahrzeuge
            </Link>
          }
        >
          <DataList
            items={vehicleList.map((vehicle) => ({
              label: `${vehicle.name} (${vehicle.plate})`,
              value: formatCurrency(costs.get(vehicle.id) ?? 0),
            }))}
          />
        </Card>

        <Card title="Flotte">
          <VehicleList vehicles={vehicleList} config={config} driverNames={driverNames} />
        </Card>
      </main>
    </>
  );
}
