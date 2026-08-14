import type { EntryWithVehicle } from "@/lib/types";
import { EntryTypeBadge } from "@/components/EntryTypeBadge";
import { ReceiptLink } from "@/components/ReceiptLink";
import { formatCurrency, formatDate } from "@/lib/format";

export function AllEntriesTable({
  entries,
  authorEmails,
  receiptUrls,
}: {
  entries: EntryWithVehicle[];
  authorEmails: Map<string, string>;
  receiptUrls: Map<string, string>;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Noch keine Einträge vorhanden.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">Datum</th>
            <th className="px-4 py-3 font-medium">Fahrzeug</th>
            <th className="px-4 py-3 font-medium">Typ</th>
            <th className="px-4 py-3 font-medium">Mitarbeiter</th>
            <th className="px-4 py-3 font-medium">Notiz</th>
            <th className="px-4 py-3 font-medium">Beleg</th>
            <th className="px-4 py-3 text-right font-medium">Kosten</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => {
            const receiptUrl = entry.receipt_path ? receiptUrls.get(entry.receipt_path) : undefined;
            return (
              <tr key={entry.id}>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {formatDate(entry.date)}
                </td>
                <td className="px-4 py-3 text-fg">
                  <span className="font-medium">{entry.vehicles?.name ?? "—"}</span>
                  <span className="ml-1.5 text-xs text-muted">{entry.vehicles?.plate}</span>
                </td>
                <td className="px-4 py-3">
                  <EntryTypeBadge type={entry.type} />
                </td>
                <td className="px-4 py-3 text-muted">
                  {authorEmails.get(entry.author_id) ?? "—"}
                </td>
                <td className="max-w-[220px] truncate px-4 py-3 text-muted">
                  {entry.note ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {receiptUrl ? <ReceiptLink url={receiptUrl} /> : <span className="text-muted">—</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-fg">
                  {formatCurrency(entry.cost)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
