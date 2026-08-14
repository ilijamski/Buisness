import type { Vehicle } from "@/lib/types";
import { formatDate } from "@/lib/format";

function tuvStatus(tuvDate: string | null): {
  label: string;
  className: string;
} | null {
  if (!tuvDate) return null;
  const daysLeft = Math.ceil(
    (new Date(tuvDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (daysLeft < 0) {
    return { label: "TÜV abgelaufen", className: "bg-red-500/15 text-red-400" };
  }
  if (daysLeft <= 30) {
    return { label: `TÜV in ${daysLeft} Tagen`, className: "bg-accent/15 text-accent" };
  }
  return null;
}

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const status = tuvStatus(vehicle.tuv_date);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{vehicle.name}</p>
        <p className="text-xs text-muted">
          {vehicle.plate}
          {vehicle.type ? ` · ${vehicle.type}` : ""}
          {vehicle.tuv_date ? ` · TÜV: ${formatDate(vehicle.tuv_date)}` : ""}
        </p>
      </div>
      {status && (
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
        >
          {status.label}
        </span>
      )}
    </div>
  );
}
