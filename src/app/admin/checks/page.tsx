import { requireActiveAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, EmptyState, Badge, Notice } from "@/components/ui";
import { OUTCOME_LABELS, DEFAULT_CHECK_ITEMS } from "@/lib/checks";
import { formatDateTime } from "@/lib/format";
import type { CheckTemplate, CheckWithDriver, Vehicle } from "@/lib/types";

/**
 * Durchgeführte Abfahrtskontrollen.
 *
 * Zwei Fragen beantwortet diese Seite: Was kam bei den Checks heraus, und —
 * mindestens ebenso wichtig — welches Fahrzeug wurde heute gar nicht
 * geprüft. Webfleet meldet genau das: „Fahrer startet ohne eingereichte
 * Checkliste".
 */
export default async function AdminChecksPage() {
  const { profile, company } = await requireActiveAdmin();
  const supabase = await createClient();

  const [{ data: checks }, { data: vehicles }, { data: templates }] = await Promise.all([
    supabase
      .from("vehicle_checks")
      .select("*, profiles(id, full_name, email), vehicles(id, name, plate)")
      .order("performed_at", { ascending: false })
      .limit(100),
    supabase.from("vehicles").select("*").eq("active", true).order("vehicle_number"),
    supabase.from("check_templates").select("*").eq("active", true),
  ]);

  const checkList = (checks as CheckWithDriver[] | null) ?? [];
  const vehicleList = (vehicles as Vehicle[] | null) ?? [];
  const templateList = (templates as CheckTemplate[] | null) ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const checkedToday = new Set(
    checkList
      .filter((check) => check.performed_at.slice(0, 10) === today)
      .map((check) => check.vehicle_id),
  );
  const missing = vehicleList.filter((vehicle) => !checkedToday.has(vehicle.id));

  const grounded = checkList.filter(
    (check) =>
      check.result === "stillgelegt" && check.performed_at.slice(0, 10) === today,
  );

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Fahrzeugchecks"
          subtitle="Abfahrtskontrollen der Fahrer, neueste zuerst."
        />

        {grounded.length > 0 && (
          <Notice kind="error">
            {grounded.length}{" "}
            {grounded.length === 1 ? "Fahrzeug wurde" : "Fahrzeuge wurden"} heute als
            nicht verkehrssicher gemeldet. Die Mängel stehen unter „Mängel&ldquo;.
          </Notice>
        )}

        {templateList.length === 0 && (
          <Notice kind="info">
            Es ist noch keine eigene Checkliste hinterlegt — die Fahrer bekommen
            deshalb die Standardliste mit {DEFAULT_CHECK_ITEMS.length} Punkten nach
            DGUV Vorschrift 70.
          </Notice>
        )}

        {vehicleList.length > 0 && (
          <Card
            title="Heute noch nicht geprüft"
            action={
              missing.length > 0 ? (
                <Badge tone="warn">{missing.length}</Badge>
              ) : (
                <Badge tone="ok">Alle geprüft</Badge>
              )
            }
          >
            {missing.length === 0 ? (
              <EmptyState>Jedes aktive Fahrzeug wurde heute kontrolliert.</EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {missing.map((vehicle) => (
                  <li
                    key={vehicle.id}
                    className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <p className="text-sm">{vehicle.name}</p>
                    <p className="text-xs text-muted">{vehicle.plate}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card title="Verlauf">
          {checkList.length === 0 ? (
            <EmptyState>
              Noch keine Abfahrtskontrolle durchgeführt. Fahrer starten sie auf ihrer
              Startseite mit einem Tipp auf „Abfahrtskontrolle&ldquo;.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {checkList.map((check) => (
                <li
                  key={check.id}
                  className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {check.vehicles?.name ?? "Fahrzeug entfernt"}
                      {check.vehicles?.plate ? ` · ${check.vehicles.plate}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {check.profiles?.full_name || check.profiles?.email || "unbekannt"}
                      {" · "}
                      {formatDateTime(check.performed_at)}
                      {check.mileage !== null
                        ? ` · ${check.mileage.toLocaleString("de-DE")} km`
                        : ""}
                    </p>
                    {check.note && (
                      <p className="mt-0.5 text-xs italic text-muted">{check.note}</p>
                    )}
                  </div>
                  <Badge
                    tone={
                      check.result === "stillgelegt"
                        ? "danger"
                        : check.result === "maengel"
                          ? "warn"
                          : "ok"
                    }
                  >
                    {OUTCOME_LABELS[check.result]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </>
  );
}
