import type { Entry, EntryType, Vehicle } from "@/lib/types";

/**
 * Kostenauswertung für die Übersicht.
 *
 * Eine Gesamtsumme über alle Zeiten sagt einem Betrieb wenig — sie wächst
 * einfach immer weiter. Aussagekräftig ist, was dieser Monat gekostet hat,
 * wie er gegen den letzten dasteht und was ein Fahrzeug pro Kilometer
 * verschlingt. Genau das rechnet diese Datei aus.
 */

export type MonthKey = `${number}-${string}`;

/** `2026-08` für den Monat, in dem das Datum liegt. */
export function monthKeyOf(isoDate: string): MonthKey {
  return isoDate.slice(0, 7) as MonthKey;
}

export function currentMonthKey(today = new Date()): MonthKey {
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  return `${today.getUTCFullYear()}-${month}` as MonthKey;
}

export function previousMonthKey(today = new Date()): MonthKey {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}` as MonthKey;
}

export function formatMonth(key: MonthKey): string {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(Number(year), Number(month) - 1, 1)),
  );
}

export type CostSummary = {
  thisMonth: number;
  lastMonth: number;
  /** Veränderung in Prozent; null, wenn der Vormonat leer war. */
  changePercent: number | null;
  /** Durchschnitt der letzten zwölf Monate, in denen etwas erfasst wurde. */
  monthlyAverage: number;
  total: number;
};

export function summarizeCosts(entries: Entry[], today = new Date()): CostSummary {
  const thisKey = currentMonthKey(today);
  const lastKey = previousMonthKey(today);

  const byMonth = new Map<string, number>();
  let total = 0;

  for (const entry of entries) {
    const cost = Number(entry.cost);
    total += cost;
    const key = monthKeyOf(entry.date);
    byMonth.set(key, (byMonth.get(key) ?? 0) + cost);
  }

  const thisMonth = byMonth.get(thisKey) ?? 0;
  const lastMonth = byMonth.get(lastKey) ?? 0;

  // Nur Monate mit Bewegung zählen — sonst drückt jeder Leermonat den
  // Schnitt und die Zahl wird unbrauchbar.
  const recent = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 12)
    .map(([, value]) => value);

  const monthlyAverage =
    recent.length > 0 ? recent.reduce((sum, v) => sum + v, 0) / recent.length : 0;

  return {
    thisMonth,
    lastMonth,
    changePercent:
      lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null,
    monthlyAverage,
    total,
  };
}

export type VehicleCost = {
  vehicle: Vehicle;
  total: number;
  thisMonth: number;
  /** Kosten je Kilometer; null, solange kein Kilometerstand gepflegt ist. */
  perKilometer: number | null;
};

/**
 * Kosten je Fahrzeug, teuerstes zuerst.
 *
 * `perKilometer` teilt die Gesamtkosten durch den aktuellen Kilometerstand.
 * Das ist bewusst grob: Ohne Anfangsstand beim Kauf gibt es keinen exakten
 * Bezugswert. Für den Vergleich der Fahrzeuge untereinander reicht es.
 */
export function costsByVehicle(
  vehicles: Vehicle[],
  entries: Entry[],
  today = new Date(),
): VehicleCost[] {
  const thisKey = currentMonthKey(today);

  const totals = new Map<string, number>();
  const months = new Map<string, number>();

  for (const entry of entries) {
    const cost = Number(entry.cost);
    totals.set(entry.vehicle_id, (totals.get(entry.vehicle_id) ?? 0) + cost);
    if (monthKeyOf(entry.date) === thisKey) {
      months.set(entry.vehicle_id, (months.get(entry.vehicle_id) ?? 0) + cost);
    }
  }

  return vehicles
    .map((vehicle) => {
      const total = totals.get(vehicle.id) ?? 0;
      const mileage = vehicle.current_mileage;
      return {
        vehicle,
        total,
        thisMonth: months.get(vehicle.id) ?? 0,
        perKilometer: mileage && mileage > 0 ? total / mileage : null,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  tanken: "Tanken",
  wartung: "Wartung",
  schaden: "Schaden",
  reifen: "Reifen",
  bremsen: "Bremsen",
  inspektion: "Inspektion",
  sonstiges: "Sonstiges",
};

/** Kostenanteile nach Art, größter zuerst — zeigt, wohin das Geld fließt. */
export function costsByType(entries: Entry[]): { type: EntryType; total: number }[] {
  const totals = new Map<EntryType, number>();

  for (const entry of entries) {
    totals.set(entry.type, (totals.get(entry.type) ?? 0) + Number(entry.cost));
  }

  return [...totals.entries()]
    .map(([type, total]) => ({ type, total }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}
