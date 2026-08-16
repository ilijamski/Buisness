"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { statusFor, DUE_SOON_DAYS, HORIZON_DAYS } from "@/lib/deadlines";
import { formatDate } from "@/lib/format";

export type DeadlineRow = {
  vehicleId: string;
  vehicleName: string;
  plate: string;
  driver: string;
  moduleKey: string;
  label: string;
  date: string;
  daysLeft: number;
};

type Range = "urgent" | "soon" | "horizon" | "all";

const RANGES: { key: Range; label: string; matches: (daysLeft: number) => boolean }[] = [
  { key: "urgent", label: "Handlungsbedarf", matches: (d) => d <= DUE_SOON_DAYS },
  { key: "soon", label: `${HORIZON_DAYS} Tage`, matches: (d) => d <= HORIZON_DAYS },
  { key: "horizon", label: "1 Jahr", matches: (d) => d <= 365 },
  { key: "all", label: "Alle", matches: () => true },
];

/**
 * Fristenliste mit Filter nach Zeitraum, Art und Freitext.
 *
 * Der Zeitraum steht vorn, weil er die Frage beantwortet, mit der man die
 * Seite öffnet: „Was muss ich jetzt angehen?" Voreingestellt sind deshalb die
 * nächsten 90 Tage — Handlungsbedarf plus genug Vorlauf für Termine.
 */
export function DeadlineTable({
  rows,
  kinds,
}: {
  rows: DeadlineRow[];
  kinds: { key: string; label: string }[];
}) {
  const [range, setRange] = useState<Range>("soon");
  const [kind, setKind] = useState<string>("");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const matchesRange = RANGES.find((r) => r.key === range)!.matches;
    const needle = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (!matchesRange(row.daysLeft)) return false;
      if (kind && row.moduleKey !== kind) return false;
      if (!needle) return true;
      return (
        row.vehicleName.toLowerCase().includes(needle) ||
        row.plate.toLowerCase().includes(needle) ||
        row.driver.toLowerCase().includes(needle)
      );
    });
  }, [rows, range, kind, query]);

  const overdue = visible.filter((row) => row.daysLeft < 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded border border-border-strong text-sm">
          {RANGES.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              className={`px-2.5 py-1.5 ${index > 0 ? "border-l border-border-strong" : ""} ${
                range === item.key ? "bg-primary font-medium text-primary-fg" : "bg-bg hover:bg-page"
              } ${index === 0 ? "rounded-l" : ""} ${index === RANGES.length - 1 ? "rounded-r" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <select
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          aria-label="Art der Frist"
          className="rounded border border-border-strong bg-bg px-2.5 py-1.5 text-sm"
        >
          <option value="">Alle Arten</option>
          {kinds.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Fahrzeug, Kennzeichen, Fahrer"
          aria-label="Suchen"
          className="min-w-[12rem] flex-1 rounded border border-border-strong bg-bg px-2.5 py-1.5 text-sm"
        />
      </div>

      <p className="text-xs text-muted" aria-live="polite">
        {visible.length} {visible.length === 1 ? "Frist" : "Fristen"}
        {overdue > 0 && ` · davon ${overdue} überfällig`}
      </p>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Keine Frist passt zu dieser Auswahl.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[36rem] w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-1.5 pr-3 font-medium">Fahrzeug</th>
                <th className="py-1.5 pr-3 font-medium">Art</th>
                <th className="py-1.5 pr-3 font-medium">Fahrer</th>
                <th className="py-1.5 pr-3 font-medium">Termin</th>
                <th className="py-1.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => {
                const status = statusFor(row.daysLeft);
                return (
                  <tr key={`${row.vehicleId}-${row.moduleKey}`}>
                    <td className="py-1.5 pr-3">
                      <Link
                        href={`/fahrzeuge/${row.vehicleId}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {row.vehicleName}
                      </Link>
                      <span className="ml-1.5 text-xs text-muted">{row.plate}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-muted">{row.label}</td>
                    <td className="py-1.5 pr-3 text-muted">{row.driver || "—"}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                      {formatDate(row.date)}
                    </td>
                    <td className="py-1.5 text-right">
                      <Badge
                        tone={
                          status === "overdue" ? "danger" : status === "due-soon" ? "warn" : "neutral"
                        }
                      >
                        {row.daysLeft < 0
                          ? `${Math.abs(row.daysLeft)} Tage überfällig`
                          : row.daysLeft === 0
                            ? "heute"
                            : `in ${row.daysLeft} Tagen`}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
