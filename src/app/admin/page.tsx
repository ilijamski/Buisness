import Link from "next/link";
import { requireActiveAdmin, loadCompanyModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, Badge, EmptyState, Notice } from "@/components/ui";
import { GettingStarted, type Step } from "@/components/admin/GettingStarted";
import { TopicTiles, TileIcons, type Tile } from "@/components/TopicTiles";
import {
  vehicleDeadlines,
  deadlineText,
  daysUntil,
  statusFor,
  bucketDeadlines,
} from "@/lib/deadlines";
import { isEnabled } from "@/lib/modules";
import { summarizeCosts } from "@/lib/costs";
import { isOpen } from "@/lib/checks";
import { isMissingSchema, MISSING_SCHEMA_HINT } from "@/lib/schema";
import { formatDate, formatCurrency } from "@/lib/format";
import type { Defect, Entry, Job, Profile, Vehicle } from "@/lib/types";

/**
 * Startseite des Admins — Einstieg, keine Aktenlage.
 *
 * Vorher stand hier alles untereinander: Fristen, Führerscheine, Kosten,
 * Flottenliste, Export. Das war eine Seite, durch die man scrollen musste,
 * um festzustellen, dass nichts zu tun ist. Jetzt beantwortet sie genau zwei
 * Fragen — „muss ich sofort etwas tun?" und „wo will ich hin?" — und alles
 * Weitere liegt hinter dem jeweiligen Themenbereich.
 */
export default async function AdminPage() {
  const { profile, company } = await requireActiveAdmin();
  const config = await loadCompanyModules(profile.company_id!);
  const supabase = await createClient();

  const [
    { data: vehicles },
    { data: entries },
    { data: staff },
    { data: defects, error: defectsError },
    { data: jobs },
    { count: settingsCount },
    { count: checkCount },
  ] = await Promise.all([
    supabase.from("vehicles").select("*").order("vehicle_number"),
    supabase.from("entries").select("*"),
    supabase.from("profiles").select("*"),
    supabase.from("defects").select("*"),
    supabase.from("jobs").select("*"),
    supabase
      .from("company_module_settings")
      .select("module_key", { count: "exact", head: true }),
    supabase.from("vehicle_checks").select("id", { count: "exact", head: true }),
  ]);

  const vehicleList = (vehicles as Vehicle[] | null) ?? [];
  const entryList = (entries as Entry[] | null) ?? [];
  const staffList = (staff as Profile[] | null) ?? [];
  const defectList = (defects as Defect[] | null) ?? [];
  const jobList = (jobs as Job[] | null) ?? [];

  const allDeadlines = vehicleList.flatMap((vehicle) =>
    vehicleDeadlines(vehicle, config).map((deadline) => ({ vehicle, deadline })),
  );
  const buckets = bucketDeadlines(allDeadlines);
  const overdue = allDeadlines.filter((d) => d.deadline.status === "overdue");
  const dueSoon = allDeadlines.filter((d) => d.deadline.status === "due-soon");

  const expiringLicenses = isEnabled(config, "license")
    ? staffList
        .filter((p) => p.license_expires_on)
        .map((p) => ({ profile: p, daysLeft: daysUntil(p.license_expires_on!) }))
        .filter((item) => statusFor(item.daysLeft) !== "ok")
        .sort((a, b) => a.daysLeft - b.daysLeft)
    : [];

  // Fehlt die Tabelle noch, ist „nichts offen" keine Aussage über die
  // Flotte, sondern über die Datenbank. Die Kacheln sagen dann das.
  const schemaPending = isMissingSchema(defectsError);

  const openDefects = defectList.filter(isOpen);
  const criticalDefects = openDefects.filter((d) => d.severity === "kritisch");
  const openJobs = jobList.filter(
    (j) => j.status === "geplant" || j.status === "unterwegs",
  );

  const summary = summarizeCosts(entryList);

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

  // Nur was heute wirklich drängt. Alles andere hat seinen Bereich.
  const attention = [
    ...overdue.slice(0, 4).map(({ vehicle, deadline }) => ({
      key: `frist-${vehicle.id}-${deadline.moduleKey}`,
      href: `/fahrzeuge/${vehicle.id}`,
      title: `${deadline.label} überfällig`,
      detail: `${vehicle.name} · ${vehicle.plate} · ${formatDate(deadline.date)}`,
      badge: deadlineText(deadline),
      tone: "danger" as const,
    })),
    ...criticalDefects.slice(0, 4).map((defect) => ({
      key: `mangel-${defect.id}`,
      href: "/admin/maengel",
      title: defect.title,
      detail: "Kritischer Mangel — Fahrzeug nicht verkehrssicher",
      badge: "Kritisch",
      tone: "danger" as const,
    })),
    ...expiringLicenses
      .filter((item) => item.daysLeft < 0)
      .slice(0, 2)
      .map(({ profile: person, daysLeft }) => ({
        key: `fs-${person.id}`,
        href: "/admin/mitarbeiter",
        title: "Führerschein abgelaufen",
        detail: person.full_name ?? person.email,
        badge: `seit ${Math.abs(daysLeft)} Tagen`,
        tone: "danger" as const,
      })),
  ];

  const tiles: Tile[] = [
    {
      href: "/admin/fahrzeuge",
      label: "Fahrzeuge",
      status:
        vehicleList.length === 0
          ? "Noch keins angelegt"
          : `${vehicleList.length} in der Flotte`,
      icon: TileIcons.vehicles,
    },
    {
      href: "/admin/fristen",
      label: "Fristen",
      status:
        overdue.length > 0
          ? `${overdue.length} überfällig`
          : dueSoon.length > 0
            ? `${dueSoon.length} in 30 Tagen`
            : "Nichts fällig",
      icon: TileIcons.calendar,
      tone: overdue.length > 0 ? "danger" : dueSoon.length > 0 ? "warn" : "neutral",
      count: overdue.length + dueSoon.length,
    },
    {
      href: "/admin/maengel",
      label: "Mängel",
      status: schemaPending
        ? "Noch nicht eingerichtet"
        : openDefects.length === 0
          ? "Nichts offen"
          : `${openDefects.length} offen${criticalDefects.length > 0 ? `, ${criticalDefects.length} kritisch` : ""}`,
      icon: TileIcons.warning,
      tone:
        criticalDefects.length > 0 ? "danger" : openDefects.length > 0 ? "warn" : "neutral",
      count: openDefects.length,
    },
    {
      href: "/admin/checks",
      label: "Fahrzeugchecks",
      status: schemaPending
        ? "Noch nicht eingerichtet"
        : (checkCount ?? 0) === 0
          ? "Noch keiner durchgeführt"
          : `${checkCount} durchgeführt`,
      icon: TileIcons.check,
    },
    {
      href: "/admin/auftraege",
      label: "Aufträge",
      status: schemaPending
        ? "Noch nicht eingerichtet"
        : openJobs.length === 0
          ? "Nichts geplant"
          : `${openJobs.length} offen`,
      icon: TileIcons.clipboard,
      count: openJobs.length,
    },
    {
      href: "/admin/mitarbeiter",
      label: "Team",
      status: `${staffList.length} ${staffList.length === 1 ? "Person" : "Personen"}`,
      icon: TileIcons.team,
    },
    {
      href: "/admin/kosten",
      label: "Kosten",
      status:
        summary.thisMonth > 0
          ? `${formatCurrency(summary.thisMonth)} diesen Monat`
          : "Noch nichts erfasst",
      icon: TileIcons.chart,
    },
    {
      href: "/admin/auswertungen",
      label: "Verbrauch & CO₂",
      status: "Liter, Verbrauch, Emissionen",
      icon: TileIcons.leaf,
    },
    {
      href: "/einstellungen",
      label: "Einstellungen",
      status: "Module, Firma, Konto",
      icon: TileIcons.settings,
    },
  ];

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title={company?.name ?? "Übersicht"}
          subtitle={`${vehicleList.length} ${vehicleList.length === 1 ? "Fahrzeug" : "Fahrzeuge"} · ${staffList.length} ${staffList.length === 1 ? "Mitarbeiter" : "Mitarbeiter"}`}
        />

        <GettingStarted steps={steps} />

        {schemaPending && <Notice kind="info">{MISSING_SCHEMA_HINT}</Notice>}

        {attention.length > 0 && (
          <Card
            title="Braucht deine Aufmerksamkeit"
            action={<Badge tone="danger">{attention.length}</Badge>}
          >
            <ul className="divide-y divide-border">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted">{item.detail}</p>
                    </div>
                    <Badge tone={item.tone}>{item.badge}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {attention.length === 0 && buckets.length === 0 && vehicleList.length > 0 && (
          <Card>
            <EmptyState>
              Nichts Dringendes. Alle überwachten Fristen liegen außerhalb der
              Vorwarnzeit, und es sind keine Mängel offen.
            </EmptyState>
          </Card>
        )}

        <TopicTiles tiles={tiles} />
      </main>
    </>
  );
}
