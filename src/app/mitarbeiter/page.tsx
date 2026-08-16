import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveSession, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, Notice, Badge, EmptyState } from "@/components/ui";
import { VehicleList } from "@/components/VehicleList";
import { TopicTiles, TileIcons, type Tile } from "@/components/TopicTiles";
import { EntryForm } from "@/components/forms/EntryForm";
import { isScanConfigured } from "@/lib/receipt-scan";
import { isEnabled, isRequired } from "@/lib/modules";
import { urgentDeadlines, deadlineText } from "@/lib/deadlines";
import { isOpen } from "@/lib/checks";
import { formatDate } from "@/lib/format";
import type { Defect, Job, Vehicle, VehicleCheck } from "@/lib/types";

/**
 * Startseite des Fahrers.
 *
 * Kacheln führen in die jeweilige Aufgabe, damit nicht alles auf einer
 * Seite liegt. Eine Ausnahme bleibt bewusst stehen: das Erfassungsformular
 * für den Fahrer mit genau einem Fahrzeug. Tanken eintragen passiert an der
 * Zapfsäule, im Stehen, oft im Regen — was dort auch nur einen Tipp weiter
 * weg liegt, wird nicht gemacht, und der Beleg landet im Handschuhfach. Die
 * Kachel „Tanken erfassen" springt deshalb an dieses Formular, statt auf
 * eine andere Seite zu führen.
 */
export default async function MitarbeiterPage() {
  const { profile, company } = await requireActiveSession();
  if (profile.role === "admin") {
    redirect("/admin");
  }

  const config = await loadCompanyModules(profile.company_id!);
  const supabase = await createClient();

  // RLS liefert Mitarbeitern ausschließlich die ihnen zugewiesenen Fahrzeuge.
  const [{ data: vehicles }, { data: defects }, { data: jobs }, { data: checks }] =
    await Promise.all([
      supabase.from("vehicles").select("*").order("vehicle_number"),
      supabase.from("defects").select("*"),
      supabase.from("jobs").select("*").order("scheduled_for", { ascending: true }),
      supabase
        .from("vehicle_checks")
        .select("*")
        .order("performed_at", { ascending: false })
        .limit(1),
    ]);

  const vehicleList = (vehicles as Vehicle[] | null) ?? [];
  const defectList = (defects as Defect[] | null) ?? [];
  const jobList = (jobs as Job[] | null) ?? [];
  const lastCheck = ((checks as VehicleCheck[] | null) ?? [])[0] ?? null;

  const soleVehicle = vehicleList.length === 1 ? vehicleList[0] : null;
  const dueSoon = soleVehicle ? urgentDeadlines(soleVehicle, config) : [];
  const openDefects = defectList.filter(isOpen);
  const openJobs = jobList.filter(
    (j) => j.status === "geplant" || j.status === "unterwegs",
  );

  const today = new Date().toISOString().slice(0, 10);
  const checkedToday = lastCheck?.performed_at.slice(0, 10) === today;

  const target = soleVehicle?.id;

  const tiles: Tile[] = [
    ...(target
      ? [
          {
            href: `/checks/${target}`,
            label: "Abfahrtskontrolle",
            status: checkedToday ? "Heute erledigt" : "Noch nicht gemacht",
            icon: TileIcons.check,
            tone: checkedToday ? ("neutral" as const) : ("warn" as const),
          },
          {
            // Sprungziel auf dieser Seite, kein Seitenwechsel.
            href: "#erfassen",
            label: "Tanken erfassen",
            status: "Beleg fotografieren, Rest kommt automatisch",
            icon: TileIcons.fuel,
          },
          {
            href: `/fahrzeuge/${target}#mangel`,
            label: "Mangel melden",
            status:
              openDefects.length > 0
                ? `${openDefects.length} offen`
                : "Defekt oder Schaden",
            icon: TileIcons.warning,
            tone: openDefects.length > 0 ? ("warn" as const) : ("neutral" as const),
            count: openDefects.length,
          },
        ]
      : []),
    {
      href: "/auftraege",
      label: "Meine Aufträge",
      status: openJobs.length === 0 ? "Nichts geplant" : `${openJobs.length} offen`,
      icon: TileIcons.clipboard,
      count: openJobs.length,
    },
    {
      href: target ? `/fahrzeuge/${target}` : "/mitarbeiter",
      label: "Mein Fahrzeug",
      status: soleVehicle
        ? `${soleVehicle.plate} · Verlauf und Dokumente`
        : `${vehicleList.length} zugewiesen`,
      icon: TileIcons.vehicles,
    },
    {
      href: "/einstellungen",
      label: "Einstellungen",
      status: "Profil, Darstellung, Konto",
      icon: TileIcons.settings,
    },
  ];

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

        {openJobs.length > 0 && (
          <Card
            title="Als Nächstes"
            action={<Badge tone="warn">{openJobs.length}</Badge>}
          >
            <ul className="divide-y divide-border">
              {openJobs.slice(0, 3).map((job) => (
                <li key={job.id}>
                  <Link
                    href="/auftraege"
                    className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-muted">
                        {job.address ?? "Ohne Adresse"}
                        {job.scheduled_for
                          ? ` · ${formatDate(job.scheduled_for.slice(0, 10))}`
                          : ""}
                      </p>
                    </div>
                    <Badge tone={job.status === "unterwegs" ? "warn" : "neutral"}>
                      {job.status === "unterwegs" ? "Unterwegs" : "Geplant"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {vehicleList.length > 0 && <TopicTiles tiles={tiles} />}

        {soleVehicle && (
          <Card title="Schnell erfassen" id="erfassen">
            <EntryForm
              vehicleId={soleVehicle.id}
              showReceipt={isEnabled(config, "receipts")}
              showMileage={isEnabled(config, "mileage")}
              mileageRequired={isRequired(config, "mileage")}
              receiptRequired={isRequired(config, "receipts")}
              scanEnabled={isScanConfigured()}
            />
          </Card>
        )}

        {vehicleList.length > 1 && (
          <Card title="Zugewiesene Fahrzeuge">
            <VehicleList vehicles={vehicleList} config={config} />
          </Card>
        )}

        {/* Der Hinweis „nichts offen" hat nur einen Sinn, solange sonst
            nichts auf der Seite steht — unter einem Formular wäre er nur
            eine weitere Zeile zum Wegscrollen. */}
        {vehicleList.length > 0 &&
          !soleVehicle &&
          openDefects.length === 0 &&
          dueSoon.length === 0 && (
            <Card>
              <EmptyState>Nichts offen. Alles auf dem aktuellen Stand.</EmptyState>
            </Card>
          )}
      </main>
    </>
  );
}
