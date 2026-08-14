import type { Entry, Vehicle } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export function CostByVehicle({
  vehicles,
  entries,
}: {
  vehicles: Vehicle[];
  entries: Entry[];
}) {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.vehicle_id, (totals.get(entry.vehicle_id) ?? 0) + Number(entry.cost));
  }

  const rows = vehicles
    .map((vehicle) => ({ vehicle, total: totals.get(vehicle.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  if (vehicles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Noch keine Fahrzeuge im Fuhrpark.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">Kosten pro Fahrzeug</h2>
        <span className="text-sm font-semibold text-accent">
          {formatCurrency(grandTotal)}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map(({ vehicle, total }) => {
          const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
          return (
            <li key={vehicle.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{vehicle.name}</p>
                  <p className="text-xs text-muted">{vehicle.plate}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-fg">
                  {formatCurrency(total)}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
