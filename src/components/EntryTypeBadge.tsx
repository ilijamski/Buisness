import type { EntryType } from "@/lib/types";

const LABELS: Record<EntryType, string> = {
  tanken: "Tanken",
  wartung: "Wartung",
  schaden: "Schaden",
};

const STYLES: Record<EntryType, string> = {
  tanken: "bg-blue-500/15 text-blue-400",
  wartung: "bg-emerald-500/15 text-emerald-400",
  schaden: "bg-red-500/15 text-red-400",
};

export function EntryTypeBadge({ type }: { type: EntryType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[type]}`}
    >
      {LABELS[type]}
    </span>
  );
}
