import Link from "next/link";
import { requireActiveAdmin, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, Badge, EmptyState } from "@/components/ui";
import { VehicleList } from "@/components/VehicleList";
import { GettingStarted, type Step } from "@/components/admin/GettingStarted";
import { CostOverview } from "@/components/admin/CostOverview";
import {
  vehicleDeadlines,
  deadlineText,
  daysUntil,
  statusFor,
  bucketDeadlines,
  HORIZON_DAYS,
} from "@/lib/deadlines";
import { isEnabled } from "@/lib/modules";
import { summarizeCosts, costsByVehicle, costsByType } from "@/lib/costs";
import { formatDate } from "@/lib/format";
import type { AssignmentWithDriver, Entry, Profile, Vehicle } from "@/lib/types";

export default async function AdminPage() {
  const { profile, company } = await requireActiveAdmin();
  const config = await loadCompanyModules(profile.company_id!);
  const supabase = await createClient();

  const [
    { data: vehicles },
    { data: entries },
    { data: assignments },
    { data: staff },
    { count: settingsCount },
  ] = await Promise.all([
    supabase.from("vehicles").select("*").order("vehicle_number"),
    supabase.from("entries").select("*"),
    supabase
      .from("vehicle_assignments")
      .select("*, profiles(id, full_name, email, employee_number)")
      .is("ended_on", null),
    supabase.from("profiles").select("*"),
    // Nur die Anzahl: verrät, ob der Admin die Module schon einmal bewusst
    // eingestellt hat, ohne die Zeilen selbst zu laden.
    supabase
      .from("company_module_settings")
      .select("module_key", { count: "exact", head: true }),
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

  // Alle überwachten Fristen der Flotte, nach Dringlichkeit gruppiert.
  const allDeadlines = vehicleList.flatMap((vehicle) =>
    vehicleDeadlines(vehicle, config).map((deadline) => ({ vehicle, deadline })),
  );
  const buckets = bucketDeadlines(allDeadlines);
  const urgentCount = allDeadlines.filter((d) => d.deadline.status !== "ok").length;

  // Ablaufende Führerscheine (eigenes Modul)
  const expiringLicenses = isEnabled(config, "license")
    ? staffList
        .filter((p) => p.license_expires_on)
        .map((p) => ({ profile: p, daysLeft: daysUntil(p.license_expires_on!) }))
        .filter((item) => statusFor(item.daysLeft) !== "ok")
        .sort((a, b) => a.daysLeft - b.daysLeft)
    : [];

  const summary = summarizeCosts(entryList);
  const perVehicle = costsByVehicle(vehicleList, entryList);
  const perType = costsByType(entryList);

  const steps: Step[] = [
    {
      label: "Branchen-Profil wählen",
      description: "Legt fest, welche Felder und Bereiche überhaupt erscheinen.",
      href: "/admin/module",
      done: (settingsCount ?? 0) > 0,
    },
    {
      label: "Erstes Fahrzeug anlegen",
      description: "Bezeichnung und Kennzeichen genügen für den Anfang.",
      href: "/admin/fahrzeuge",
      done: vehicleList.length > 0,
    },
    {
      label: "Eine Frist eintragen",
      description: "Zum Beispiel den nächsten TÜV — dann warnt dich die App rechtzeitig.",
      href: "/admin/fahrzeuge",
      done: allDeadlines.length > 0,
    },
    {
      label: "Mitarbeiter einladen",
      description: "Per Firmen-Code oder Einladungslink, danach Fahrzeuge zuordnen.",
      href: "/admin/mitarbeiter",
      done: staffList.length > 1,
    },
  ];

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Übersicht"
          subtitle={`${vehicleList.length} ${vehicleList.length === 1 ? "Fahrzeug" : "Fahrzeuge"} · ${staffList.length} ${staffList.length === 1 ? "Mitarbeiter" : "Mitarbeiter"}`}
        />

        <GettingStarted steps={steps} />

        {/* Fristen zuerst: der eigentliche Grund, warum jemand die App öffnet. */}
        <Card
          title="Fristen"
          action={
            urgentCount > 0 ? (
              <Badge tone={buckets[0]?.key === "overdue" ? "danger" : "warn"}>
                {urgentCount} offen
              </Badge>
            ) : undefined
          }
        >
          {buckets.length === 0 ? (
            <EmptyState>
              {allDeadlines.length === 0
                ? "Noch keine Fristen hinterlegt. Trag beim Fahrzeug ein HU- oder Versicherungsdatum ein."
                : `Nichts fällig in den nächsten ${HORIZON_DAYS} Tagen.`}
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {buckets.map((bucket) => (
                <div key={bucket.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      {bucket.label}{" "}
                      <span className="font-normal text-muted tabular-nums">
                        ({bucket.items.length})
                      </span>
                    </h3>
                    <p className="text-xs text-muted">{bucket.hint}</p>
                  </div>

                  <ul className="mt-1 divide-y divide-border border-t border-border">
                    {bucket.items.slice(0, 10).map(({ vehicle, deadline }) => (
                      <li
                        key={`${vehicle.id}-${deadline.moduleKey}`}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <div className="min-w-0">
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
                        <Badge tone={bucket.tone}>{deadlineText(deadline)}</Badge>
                      </li>
                    ))}
                  </ul>

                  {bucket.items.length > 10 && (
                    <p className="pt-2 text-xs text-muted">
                      und {bucket.items.length - 10} weitere
                    </p>
                  )}
                </div>
              ))}
            </div>
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

        <CostOverview summary={summary} perVehicle={perVehicle} perType={perType} />

        <Card title="Flotte">
          <VehicleList vehicles={vehicleList} config={config} driverNames={driverNames} />
        </Card>

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
