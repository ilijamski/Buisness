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
