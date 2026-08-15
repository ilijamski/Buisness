import { notFound } from "next/navigation";
import { requireActiveSession, loadVehicleModules } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, Badge, DataList, EmptyState } from "@/components/ui";
import { VehicleForm } from "@/components/VehicleForm";
import { AssignDriverForm } from "@/components/AssignDriverForm";
import { VehicleModuleOverrides } from "@/components/VehicleModuleOverrides";
import { EntryForm } from "@/components/forms/EntryForm";
import { LogbookForm } from "@/components/forms/LogbookForm";
import { WorkshopForm } from "@/components/forms/WorkshopForm";
import { DocumentForm } from "@/components/forms/DocumentForm";
import { EntryRowActions } from "@/components/forms/EntryRowActions";
import { vehicleDeadlines, deadlineText } from "@/lib/deadlines";
import { isEnabled, isRequired, MODULES } from "@/lib/modules";
import { getSignedUrls, RECEIPTS_BUCKET, DOCUMENTS_BUCKET } from "@/lib/receipts";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/lib/settings";
import { isWithinCorrectionWindow } from "@/lib/corrections";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  AssignmentWithDriver,
  Entry,
  LogbookEntry,
  Vehicle,
  VehicleDocument,
  VehicleModuleSetting,
  WorkshopRecord,
} from "@/lib/types";

const TRIP_LABELS = {
  dienstlich: "Dienstlich",
  arbeitsweg: "Arbeitsweg",
  privat: "Privat",
} as const;

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, company } = await requireActiveSession();
  const supabase = await createClient();

  // RLS sorgt dafür, dass nur Admins und der zugewiesene Fahrer das Fahrzeug sehen.
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!vehicle) notFound();

  const isAdmin = profile.role === "admin";
  const config = await loadVehicleModules(profile.company_id!, id);

  const [
    { data: entries },
    { data: logbook },
    { data: workshop },
    { data: documents },
    { data: assignment },
    { data: overrides },
    { data: storedSettings },
  ] = await Promise.all([
    supabase.from("entries").select("*").eq("vehicle_id", id).order("date", { ascending: false }),
    supabase
      .from("logbook_entries")
      .select("*")
      .eq("vehicle_id", id)
      .order("date", { ascending: false })
      .limit(50),
    supabase
      .from("workshop_records")
      .select("*")
      .eq("vehicle_id", id)
      .order("date", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicle_assignments")
      .select("*, profiles(id, full_name, email, employee_number)")
      .eq("vehicle_id", id)
      .is("ended_on", null)
      .maybeSingle(),
    isAdmin
      ? supabase.from("vehicle_module_settings").select("*").eq("vehicle_id", id)
      : Promise.resolve({ data: [] as VehicleModuleSetting[] }),
    supabase.from("user_settings").select("*").eq("user_id", profile.id).maybeSingle(),
  ]);

  const userSettings = {
    ...DEFAULT_USER_SETTINGS,
    ...((storedSettings as UserSettings | null) ?? {}),
  };

  const entryList = (entries as Entry[] | null) ?? [];
  const logbookList = (logbook as LogbookEntry[] | null) ?? [];
  const workshopList = (workshop as WorkshopRecord[] | null) ?? [];
  const documentList = (documents as VehicleDocument[] | null) ?? [];
  const currentAssignment = assignment as AssignmentWithDriver | null;

  const [receiptUrls, documentUrls] = await Promise.all([
    getSignedUrls(supabase, RECEIPTS_BUCKET, entryList.map((e) => e.receipt_path)),
    getSignedUrls(supabase, DOCUMENTS_BUCKET, documentList.map((d) => d.file_path)),
  ]);

  const deadlines = vehicleDeadlines(vehicle as Vehicle, config);
  const totalCost =
    entryList.reduce((sum, e) => sum + Number(e.cost), 0) +
    workshopList.reduce((sum, w) => sum + Number(w.cost), 0);

  const driverName =
    currentAssignment?.profiles?.full_name || currentAssignment?.profiles?.email || null;

  // Korrekturfenster wie in der RLS-Policy: Admin immer, sonst eigener
  // Eintrag und höchstens 24 Stunden alt.
  const canCorrect = (entry: Entry) =>
    isAdmin ||
    (entry.author_id === profile.id && isWithinCorrectionWindow(entry.created_at));

  // Stammdaten aller aktiven Module, die tatsächlich einen Wert haben.
  const detailItems = MODULES.filter((m) => isEnabled(config, m.key))
    .flatMap((m) => m.fields)
    .map((field) => ({ field, value: (vehicle as Vehicle)[field.key] }))
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
    .map((item) => ({
      label: item.field.label,
      value:
        item.field.type === "date"
          ? formatDate(String(item.value))
          : item.field.type === "decimal" && String(item.field.key).includes("value")
            ? formatCurrency(Number(item.value))
            : String(item.value),
    }));

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title={`${vehicle.vehicle_number !== null ? `#${vehicle.vehicle_number} ` : ""}${vehicle.name}`}
          subtitle={`${vehicle.plate}${vehicle.type ? ` · ${vehicle.type}` : ""}${
            driverName ? ` · Fahrer: ${driverName}` : ""
          }`}
        />

        {deadlines.length > 0 && (
          <Card title="Fristen">
            <ul className="divide-y divide-border">
              {deadlines.map((deadline) => (
                <li
                  key={deadline.moduleKey}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{deadline.label}</p>
                    <p className="text-xs text-muted">{formatDate(deadline.date)}</p>
                  </div>
                  <Badge
                    tone={
                      deadline.status === "overdue"
                        ? "danger"
                        : deadline.status === "due-soon"
                          ? "warn"
                          : "ok"
                    }
                  >
                    {deadlineText(deadline)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Fahrzeugdaten">
            <DataList
              items={[
                ...(isEnabled(config, "mileage") && vehicle.current_mileage !== null
                  ? [
                      {
                        label: "Kilometerstand",
                        value: `${vehicle.current_mileage.toLocaleString("de-DE")} km`,
                      },
                    ]
                  : []),
                { label: "Kosten gesamt", value: formatCurrency(totalCost) },
                ...detailItems,
              ]}
            />
          </Card>

          {isEnabled(config, "driver") && (
            <Card title="Fahrerzuordnung">
              {isAdmin ? (
                <AssignDriverForm vehicleId={id} currentDriver={driverName} />
              ) : (
                <p className="text-sm">
                  Aktueller Fahrer: <strong>{driverName ?? "nicht zugewiesen"}</strong>
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Erfassen: Einträge stehen Fahrer und Admin offen. */}
        <Card title="Neuer Eintrag">
          <EntryForm
            vehicleId={id}
            showReceipt={isEnabled(config, "receipts")}
            showMileage={isEnabled(config, "mileage")}
            mileageRequired={isRequired(config, "mileage")}
            receiptRequired={isRequired(config, "receipts")}
          />
        </Card>

        <Card title="Einträge">
          {entryList.length === 0 ? (
            <EmptyState>Noch keine Einträge.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[38rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="py-2 pr-3 font-medium">Datum</th>
                    <th className="py-2 pr-3 font-medium">Art</th>
                    <th className="py-2 pr-3 font-medium">Notiz</th>
                    <th className="py-2 pr-3 font-medium">Beleg</th>
                    <th className="py-2 text-right font-medium">Kosten</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entryList.map((entry) => {
                    const url = entry.receipt_path
                      ? receiptUrls.get(entry.receipt_path)
                      : undefined;
                    return (
                      <tr key={entry.id}>
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(entry.date)}</td>
                        <td className="py-2 pr-3 capitalize">{entry.type}</td>
                        <td className="max-w-[16rem] truncate py-2 pr-3 text-muted">
                          {entry.note ?? "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="text-accent underline">
                              ansehen
                            </a>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-medium whitespace-nowrap">
                          {formatCurrency(entry.cost)}
                          {canCorrect(entry) && (
                            <div className="mt-1 font-normal">
                              <EntryRowActions entry={entry} vehicleId={id} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {isEnabled(config, "logbook") && (
          <>
            <Card title="Fahrt eintragen">
              <LogbookForm
                vehicleId={id}
                lastMileage={vehicle.current_mileage}
                defaultTripType={userSettings.default_trip_type}
              />
            </Card>

            <Card title="Fahrtenbuch">
              {logbookList.length === 0 ? (
                <EmptyState>Noch keine Fahrten erfasst.</EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[38rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted">
                        <th className="py-2 pr-3 font-medium">Datum</th>
                        <th className="py-2 pr-3 font-medium">Art</th>
                        <th className="py-2 pr-3 font-medium">Strecke</th>
                        <th className="py-2 pr-3 font-medium">Zweck</th>
                        <th className="py-2 text-right font-medium">km</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {logbookList.map((trip) => (
                        <tr key={trip.id}>
                          <td className="py-2 pr-3 whitespace-nowrap">{formatDate(trip.date)}</td>
                          <td className="py-2 pr-3">{TRIP_LABELS[trip.trip_type]}</td>
                          <td className="py-2 pr-3 text-muted">
                            {trip.start_location || "—"} → {trip.end_location || "—"}
                          </td>
                          <td className="max-w-[12rem] truncate py-2 pr-3 text-muted">
                            {trip.purpose ?? "—"}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {(trip.end_mileage - trip.start_mileage).toLocaleString("de-DE")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {isEnabled(config, "workshop") && (
          <Card title="Werkstatt-Historie">
            {isAdmin && (
              <div className="mb-4 border-b border-border pb-4">
                <WorkshopForm vehicleId={id} />
              </div>
            )}
            {workshopList.length === 0 ? (
              <EmptyState>Noch keine Werkstattbesuche erfasst.</EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {workshopList.map((record) => (
                  <li key={record.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-medium">{record.description}</p>
                      <span className="text-sm whitespace-nowrap">
                        {formatCurrency(record.cost)}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {formatDate(record.date)}
                      {record.workshop ? ` · ${record.workshop}` : ""}
                      {record.mileage ? ` · ${record.mileage.toLocaleString("de-DE")} km` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {isEnabled(config, "documents") && (
          <Card title="Dokumente">
            <div className="mb-4 border-b border-border pb-4">
              <DocumentForm vehicleId={id} />
            </div>
            {documentList.length === 0 ? (
              <EmptyState>Noch keine Dokumente hinterlegt.</EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {documentList.map((doc) => {
                  const url = documentUrls.get(doc.file_path);
                  return (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{doc.title}</p>
                        <p className="text-xs text-muted">
                          {doc.kind}
                          {doc.valid_until ? ` · gültig bis ${formatDate(doc.valid_until)}` : ""}
                        </p>
                      </div>
                      {url && (
                        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-accent underline">
                          öffnen
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {isAdmin ? (
          <>
            <Card title="Fahrzeug bearbeiten">
              <VehicleForm config={config} vehicle={vehicle as Vehicle} />
            </Card>

            <Card title="Module für dieses Fahrzeug">
              <p className="mb-3 text-sm text-muted">
                Standardmäßig gilt die Firmeneinstellung. Hier kannst du für dieses eine
                Fahrzeug abweichen — etwa UVV nur für den Kranwagen.
              </p>
              <VehicleModuleOverrides
                vehicleId={id}
                overrides={(overrides as VehicleModuleSetting[] | null) ?? []}
              />
            </Card>
          </>
        ) : (
          <Card title="Meine Angaben">
            <p className="mb-3 text-sm text-muted">
              Diese Werte darfst du als Fahrer pflegen.
            </p>
            <VehicleForm config={config} vehicle={vehicle as Vehicle} scope="driver" />
          </Card>
        )}
      </main>
    </>
  );
}
