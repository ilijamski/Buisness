import type { Entry, Vehicle } from "@/lib/types";
import { monthKeyOf, type MonthKey } from "@/lib/costs";

/**
 * Verbrauch und CO2 aus den erfassten Tankbelegen.
 *
 * Webfleet liest den Verbrauch aus dem Bordcomputer. Ohne Hardware im
 * Fahrzeug geht das nicht — wohl aber über die Tankbelege, die ohnehin
 * erfasst werden. Das Ergebnis ist gröber (es zeigt, was getankt, nicht was
 * verbraucht wurde), aber es beruht auf echten Zahlen statt auf Schätzungen,
 * und für Kostenvergleich und CO2-Bericht reicht es.
 */

/**
 * Emissionsfaktoren in kg CO2 je Liter, Verbrennung im Fahrzeug ("Tank-to-
 * Wheel"). Quelle: Umweltbundesamt, Werte für Straßenverkehr in Deutschland.
 *
 * Bewusst Tank-to-Wheel und nicht Well-to-Wheel: das ist die Abgrenzung, die
 * in der Flottenberichterstattung üblich ist. Wer eine Bilanz nach GHG
 * Protocol Scope 1 braucht, rechnet mit genau diesen Werten.
 */
export const CO2_PER_LITER: Record<string, number> = {
  diesel: 2.65,
  benzin: 2.37,
  super: 2.37,
  "super e10": 2.32,
  lpg: 1.64,
  cng: 2.79, // je kg, nicht je Liter — CNG wird in kg getankt
};

/** Fällt zurück auf Diesel: die häufigste Antriebsart im gewerblichen Fuhrpark. */
export const DEFAULT_FUEL = "diesel";

export function co2FactorFor(fuelType: string | null): number {
  if (!fuelType) return CO2_PER_LITER[DEFAULT_FUEL];
  return CO2_PER_LITER[fuelType.trim().toLowerCase()] ?? CO2_PER_LITER[DEFAULT_FUEL];
}

export type FuelSummary = {
  /** Summe aller erfassten Liter. */
  liters: number;
  /** Ausgestoßenes CO2 in Kilogramm. */
  co2Kg: number;
  /** Kosten der Tankvorgänge. */
  fuelCost: number;
  /** Durchschnittspreis je Liter. */
  pricePerLiter: number | null;
  /** Anzahl der Tankvorgänge mit Mengenangabe. */
  fillUps: number;
};

/** Nur Tankeinträge mit Mengenangabe — ohne Liter ist nichts zu rechnen. */
function fuelEntries(entries: Entry[]): Entry[] {
  return entries.filter(
    (entry) => entry.type === "tanken" && entry.liters !== null && Number(entry.liters) > 0,
  );
}

export function summarizeFuel(entries: Entry[]): FuelSummary {
  const relevant = fuelEntries(entries);

  let liters = 0;
  let co2Kg = 0;
  let fuelCost = 0;

  for (const entry of relevant) {
    const amount = Number(entry.liters);
    liters += amount;
    co2Kg += amount * co2FactorFor(entry.fuel_type);
    fuelCost += Number(entry.cost);
  }

  return {
    liters,
    co2Kg,
    fuelCost,
    pricePerLiter: liters > 0 ? fuelCost / liters : null,
    fillUps: relevant.length,
  };
}

export type VehicleConsumption = {
  vehicle: Vehicle;
  liters: number;
  co2Kg: number;
  /** Gefahrene Strecke zwischen erstem und letztem Tankstand, in km. */
  distanceKm: number | null;
  /** Liter je 100 km; null, solange keine zwei Zählerstände vorliegen. */
  per100Km: number | null;
};

/**
 * Verbrauch je Fahrzeug.
 *
 * Die Strecke ergibt sich aus dem ersten und letzten beim Tanken notierten
 * Zählerstand. Die zugehörige Menge lässt bewusst die erste Füllung außen
 * vor: was vor dem ersten notierten Stand im Tank war, wurde nicht auf
 * dieser Strecke verbraucht. Diese Korrektur ist der Unterschied zwischen
 * einer belastbaren und einer geschönten Verbrauchszahl.
 */
export function consumptionByVehicle(
  vehicles: Vehicle[],
  entries: Entry[],
): VehicleConsumption[] {
  const byVehicle = new Map<string, Entry[]>();
  for (const entry of fuelEntries(entries)) {
    const list = byVehicle.get(entry.vehicle_id) ?? [];
    list.push(entry);
    byVehicle.set(entry.vehicle_id, list);
  }

  return vehicles
    .map((vehicle) => {
      const list = (byVehicle.get(vehicle.id) ?? []).sort((a, b) =>
        a.date.localeCompare(b.date),
      );

      const liters = list.reduce((sum, e) => sum + Number(e.liters), 0);
      const co2Kg = list.reduce(
        (sum, e) => sum + Number(e.liters) * co2FactorFor(e.fuel_type),
        0,
      );

      const withMileage = list.filter((e) => e.mileage !== null && e.mileage > 0);
      let distanceKm: number | null = null;
      let per100Km: number | null = null;

      if (withMileage.length >= 2) {
        const first = withMileage[0];
        const last = withMileage[withMileage.length - 1];
        const distance = Number(last.mileage) - Number(first.mileage);

        if (distance > 0) {
          distanceKm = distance;
          // Die erste Füllung zählt nicht zur Strecke — siehe oben.
          const litersOnDistance = withMileage
            .slice(1)
            .reduce((sum, e) => sum + Number(e.liters), 0);
          if (litersOnDistance > 0) {
            per100Km = (litersOnDistance / distance) * 100;
          }
        }
      }

      return { vehicle, liters, co2Kg, distanceKm, per100Km };
    })
    .filter((row) => row.liters > 0)
    .sort((a, b) => b.co2Kg - a.co2Kg);
}

export type MonthlyCo2 = { month: MonthKey; co2Kg: number; liters: number };

/** CO2 je Monat, ältester zuerst — zeigt den Verlauf statt nur einer Summe. */
export function co2ByMonth(entries: Entry[], months = 12): MonthlyCo2[] {
  const byMonth = new Map<MonthKey, { co2Kg: number; liters: number }>();

  for (const entry of fuelEntries(entries)) {
    const key = monthKeyOf(entry.date);
    const amount = Number(entry.liters);
    const current = byMonth.get(key) ?? { co2Kg: 0, liters: 0 };
    byMonth.set(key, {
      co2Kg: current.co2Kg + amount * co2FactorFor(entry.fuel_type),
      liters: current.liters + amount,
    });
  }

  return [...byMonth.entries()]
    .map(([month, value]) => ({ month, ...value }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-months);
}

/** `1.234 kg` bzw. `1,2 t` — Tonnen erst, wenn die Zahl sonst unlesbar wird. */
export function formatCo2(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} t`;
  }
  return `${kg.toLocaleString("de-DE", { maximumFractionDigits: 0 })} kg`;
}
