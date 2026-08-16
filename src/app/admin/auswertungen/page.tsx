import { requireActiveAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, EmptyState, Notice } from "@/components/ui";
import {
  summarizeFuel,
  consumptionByVehicle,
  co2ByMonth,
  formatCo2,
} from "@/lib/emissions";
import { formatMonth } from "@/lib/costs";
import { formatCurrency } from "@/lib/format";
import type { Entry, Vehicle } from "@/lib/types";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Verbrauch und CO2.
 *
 * Webfleet zieht diese Zahlen aus dem Bordcomputer. Ohne Hardware im
 * Fahrzeug ist die Tankquittung die einzige belastbare Quelle — dafür eine,
 * die es in jedem Betrieb schon gibt. Was hier steht, beruht ausschließlich
 * auf erfassten Belegen; geschätzt wird nichts.
 */
export default async function AdminReportsPage() {
  const { profile, company } = await requireActiveAdmin();
  const supabase = await createClient();

  const [{ data: vehicles }, { data: entries }] = await Promise.all([
    supabase.from("vehicles").select("*").order("vehicle_number"),
    supabase.from("entries").select("*"),
  ]);

  const vehicleList = (vehicles as Vehicle[] | null) ?? [];
  const entryList = (entries as Entry[] | null) ?? [];

  const fuel = summarizeFuel(entryList);
  const perVehicle = consumptionByVehicle(vehicleList, entryList);
  const monthly = co2ByMonth(entryList);
  const maxCo2 = Math.max(1, ...monthly.map((m) => m.co2Kg));

  // Tankbelege ohne Mengenangabe: die häufigste Ursache für leere
  // Auswertungen, deshalb benannt statt verschwiegen.
  const fuelEntriesTotal = entryList.filter((e) => e.type === "tanken").length;
  const withoutLiters = fuelEntriesTotal - fuel.fillUps;

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Verbrauch & CO₂"
          subtitle="Berechnet aus den erfassten Tankbelegen."
        />

        {fuel.fillUps === 0 ? (
          <Card>
            <EmptyState>
              Noch keine Tankmenge erfasst. Sobald bei einem Tankbeleg die Literzahl
              mit eingetragen wird — beim Scannen wird sie automatisch erkannt —
              erscheinen hier Verbrauch und Emissionen.
            </EmptyState>
          </Card>
        ) : (
          <>
            <Card title="Gesamt">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Metric
                  label="Getankt"
                  value={`${fuel.liters.toLocaleString("de-DE", { maximumFractionDigits: 0 })} l`}
                  hint={`${fuel.fillUps} Tankvorgänge`}
                />
                <Metric
                  label="CO₂-Ausstoß"
                  value={formatCo2(fuel.co2Kg)}
                  hint="Tank-to-Wheel"
                />
                <Metric label="Kraftstoffkosten" value={formatCurrency(fuel.fuelCost)} />
                <Metric
                  label="Preis je Liter"
                  value={fuel.pricePerLiter ? formatCurrency(fuel.pricePerLiter) : "—"}
                  hint="Durchschnitt"
                />
              </div>

              {withoutLiters > 0 && (
                <div className="mt-4">
                  <Notice kind="info">
                    {withoutLiters}{" "}
                    {withoutLiters === 1 ? "Tankbeleg enthält" : "Tankbelege enthalten"}{" "}
                    keine Literangabe und {withoutLiters === 1 ? "fehlt" : "fehlen"} in
                    dieser Rechnung.
                  </Notice>
                </div>
              )}
            </Card>

            {monthly.length > 1 && (
              <Card title="CO₂ je Monat">
                <ul className="space-y-1.5">
                  {monthly.map((month) => (
                    <li key={month.month} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs text-muted">
                        {formatMonth(month.month)}
                      </span>
                      <span
                        className="h-4 rounded-sm bg-accent-bg"
                        style={{ width: `${Math.max(2, (month.co2Kg / maxCo2) * 100)}%` }}
                        aria-hidden="true"
                      />
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {formatCo2(month.co2Kg)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card title="Je Fahrzeug">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="pb-2 font-medium">Fahrzeug</th>
                      <th className="pb-2 text-right font-medium">Getankt</th>
                      <th className="pb-2 text-right font-medium">Verbrauch</th>
                      <th className="pb-2 text-right font-medium">Strecke</th>
                      <th className="pb-2 text-right font-medium">CO₂</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {perVehicle.map((row) => (
                      <tr key={row.vehicle.id}>
                        <td className="py-2">
                          <p className="font-medium">{row.vehicle.name}</p>
                          <p className="text-xs text-muted">{row.vehicle.plate}</p>
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {row.liters.toLocaleString("de-DE", { maximumFractionDigits: 0 })} l
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {row.per100Km
                            ? `${row.per100Km.toLocaleString("de-DE", { maximumFractionDigits: 1 })} l/100 km`
                            : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {row.distanceKm
                            ? `${row.distanceKm.toLocaleString("de-DE")} km`
                            : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCo2(row.co2Kg)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-muted">
                Der Verbrauch braucht mindestens zwei Tankvorgänge mit notiertem
                Kilometerstand. Die erste Füllung zählt dabei nicht mit — was vorher
                im Tank war, wurde nicht auf dieser Strecke verbraucht.
              </p>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
