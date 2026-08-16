import { MODULES, isEnabled, type ModuleConfig } from "@/lib/modules";
import type { Vehicle } from "@/lib/types";

export type DeadlineStatus = "overdue" | "due-soon" | "ok";

export type Deadline = {
  moduleKey: string;
  label: string;
  date: string;
  daysLeft: number;
  status: DeadlineStatus;
};

export const DUE_SOON_DAYS = 30;

export function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function statusFor(daysLeft: number): DeadlineStatus {
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= DUE_SOON_DAYS) return "due-soon";
  return "ok";
}

/** Alle überwachten Fristen eines Fahrzeugs, nur für aktive Module. */
export function vehicleDeadlines(vehicle: Vehicle, config: ModuleConfig): Deadline[] {
  const deadlines: Deadline[] = [];

  for (const mod of MODULES) {
    if (!mod.deadlineField || !isEnabled(config, mod.key)) continue;

    const value = vehicle[mod.deadlineField];
    if (typeof value !== "string" || !value) continue;

    const daysLeft = daysUntil(value);
    deadlines.push({
      moduleKey: mod.key,
      label: mod.label,
      date: value,
      daysLeft,
      status: statusFor(daysLeft),
    });
  }

  return deadlines.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Nur die Fristen, die abgelaufen sind oder demnächst fällig werden. */
export function urgentDeadlines(vehicle: Vehicle, config: ModuleConfig): Deadline[] {
  return vehicleDeadlines(vehicle, config).filter((d) => d.status !== "ok");
}

export function deadlineText(deadline: Deadline): string {
  if (deadline.daysLeft < 0) {
    return `seit ${Math.abs(deadline.daysLeft)} Tagen überfällig`;
  }
  if (deadline.daysLeft === 0) return "heute fällig";
  return `in ${deadline.daysLeft} Tagen`;
}

/** Vorausschau über den Akutbereich hinaus — für die Planung im Betrieb. */
export const HORIZON_DAYS = 90;

export type DeadlineBucketKey = "overdue" | "soon" | "horizon";

export type DeadlineBucket<T> = {
  key: DeadlineBucketKey;
  label: string;
  hint: string;
  tone: "danger" | "warn" | "neutral";
  items: T[];
};

/**
 * Teilt Fristen in überfällig, in den nächsten 30 Tagen und in den nächsten
 * 90 Tagen.
 *
 * Eine einzige Liste „offene Fristen" macht keinen Unterschied zwischen einem
 * TÜV, der seit drei Wochen abgelaufen ist, und einem, der in vier Wochen
 * ansteht. Genau dieser Unterschied entscheidet aber, ob heute jemand zum
 * Prüfer fahren muss. Der 90-Tage-Block gibt zusätzlich Vorlauf für
 * Werkstatttermine, die man nicht am selben Tag bekommt.
 */
export function bucketDeadlines<T extends { deadline: Deadline }>(
  items: T[],
): DeadlineBucket<T>[] {
  const buckets: DeadlineBucket<T>[] = [
    {
      key: "overdue",
      label: "Überfällig",
      hint: "Sofort handeln — hier drohen Bußgeld und Versicherungsprobleme.",
      tone: "danger",
      items: [],
    },
    {
      key: "soon",
      label: "Nächste 30 Tage",
      hint: "Termin vereinbaren.",
      tone: "warn",
      items: [],
    },
    {
      key: "horizon",
      label: `Nächste ${HORIZON_DAYS} Tage`,
      hint: "Zur Planung — noch kein Handlungsbedarf.",
      tone: "neutral",
      items: [],
    },
  ];

  for (const item of items) {
    const { daysLeft } = item.deadline;
    if (daysLeft < 0) buckets[0].items.push(item);
    else if (daysLeft <= DUE_SOON_DAYS) buckets[1].items.push(item);
    else if (daysLeft <= HORIZON_DAYS) buckets[2].items.push(item);
  }

  for (const bucket of buckets) {
    bucket.items.sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft);
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
}
