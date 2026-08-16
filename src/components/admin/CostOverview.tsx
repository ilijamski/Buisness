import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import {
  currentMonthKey,
  previousMonthKey,
  formatMonth,
  ENTRY_TYPE_LABELS,
  type CostSummary,
  type VehicleCost,
} from "@/lib/costs";
import type { EntryType } from "@/lib/types";

/**
 * Kostenbild der Flotte.
 *
 * Ersetzt die frühere Gesamtsumme samt Liste aller Fahrzeuge: Eine Zahl, die
 * seit Beginn der Nutzung immer nur wächst, beantwortet keine Frage. Hier
 * steht stattdessen, was dieser Monat kostet, wie er gegen den Vormonat
 * dasteht, welches Fahrzeug am teuersten ist und wofür das Geld draufgeht.
 */
export function CostOverview({
  summary,
  perVehicle,
  perType,
}: {
  summary: CostSummary;
  perVehicle: VehicleCost[];
  perType: { type: EntryType; total: number }[];
}) {
  if (summary.total === 0) {
    return (
      <Card title="Kosten">
        <EmptyState>
          Noch keine Kosten erfasst. Sobald deine Fahrer tanken oder eine Wartung
          eintragen, entsteht hier die Auswertung.
        </EmptyState>
      </Card>
    );
  }

  const change = summary.changePercent;
  const topType = perType[0];
  const typeTotal = perType.reduce((sum, item) => sum + item.total, 0);

  return (
    <Card
      title="Kosten"
      action={
        <Link href="/export/eintraege" className="text-sm text-accent underline">
          Als CSV
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">{formatMonth(currentMonthKey())}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(summary.thisMonth)}
            </p>
            {change !== null && (
              <p className="text-xs text-muted">
                <span aria-hidden="true">{change > 0 ? "↑" : change < 0 ? "↓" : "→"}</span>{" "}
                {change > 0 ? "+" : ""}
                {change} % ggü. {formatMonth(previousMonthKey())}
              </p>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs text-muted">Schnitt pro Monat</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(summary.monthlyAverage)}
            </p>
            <p className="text-xs text-muted">aus den erfassten Monaten</p>
          </div>

          <div className="min-w-0">
            <p className="text-xs text-muted">Gesamt</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(summary.total)}
            </p>
            {topType && (
              <p className="text-xs text-muted">
                größter Posten: {ENTRY_TYPE_LABELS[topType.type]}
              </p>
            )}
          </div>
        </div>

        {perType.length > 1 && (
          <div>
            <h3 className="text-sm font-semibold">Wofür</h3>
            <ul className="mt-1.5 space-y-1.5">
              {perType.slice(0, 5).map((item) => {
                const share = Math.round((item.total / typeTotal) * 100);
                return (
                  <li key={item.type} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-muted">
                      {ENTRY_TYPE_LABELS[item.type]}
                    </span>
                    {/* Anteilsbalken: macht das Verhältnis auf einen Blick lesbar. */}
                    <span className="h-2 min-w-0 flex-1 rounded-full bg-page">
                      <span
                        className="block h-2 rounded-full bg-accent-bg"
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums">
                      {formatCurrency(item.total)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold">Teuerste Fahrzeuge</h3>
          <div className="mt-1.5 overflow-x-auto">
            <table className="min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-1.5 pr-3 font-medium">Fahrzeug</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Dieser Monat</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Gesamt</th>
                  <th className="py-1.5 text-right font-medium">je km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {perVehicle.slice(0, 8).map(({ vehicle, total, thisMonth, perKilometer }) => (
                  <tr key={vehicle.id}>
                    <td className="py-1.5 pr-3">
                      <Link
                        href={`/fahrzeuge/${vehicle.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {vehicle.name}
                      </Link>
                      <span className="ml-1.5 text-xs text-muted">{vehicle.plate}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {formatCurrency(thisMonth)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {formatCurrency(total)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted">
                      {perKilometer === null ? "—" : `${perKilometer.toFixed(2)} €`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {perVehicle.some((v) => v.perKilometer === null) && (
            <p className="mt-2 text-xs text-muted">
              „je km" erscheint, sobald für das Fahrzeug ein Kilometerstand gepflegt ist.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
