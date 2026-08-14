import type { EntryWithVehicle } from "@/lib/types";
import { EntryTypeBadge } from "@/components/EntryTypeBadge";
import { formatCurrency, formatDate } from "@/lib/format";

export function EntryHistory({ entries }: { entries: EntryWithVehicle[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Noch keine Einträge vorhanden.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-xl border border-border bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">
                {entry.vehicles?.name ?? "Unbekanntes Fahrzeug"}
              </p>
              <p className="text-xs text-muted">
                {entry.vehicles?.plate} · {formatDate(entry.date)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <EntryTypeBadge type={entry.type} />
              <span className="text-sm font-semibold text-fg">
                {formatCurrency(entry.cost)}
              </span>
            </div>
          </div>
          {entry.note && (
            <p className="mt-2 text-sm text-muted">{entry.note}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
