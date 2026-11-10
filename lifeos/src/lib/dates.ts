/**
 * Datumslogik auf Basis von ISO-Strings (YYYY-MM-DD). Kalendertage werden
 * bewusst ohne Uhrzeit und Zeitzone gespeichert – "heute" richtet sich nach
 * der Zeitzone des Nutzers, nicht nach der des Servers.
 */
export const DEFAULT_TZ = "Europe/Berlin";

const pad = (n: number) => String(n).padStart(2, "0");
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUtc = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return todayIn(DEFAULT_TZ);
  }
}

export function hourIn(tz: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date())) % 24;
  } catch {
    return 12;
  }
}

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86_400_000);
}

/** 0 = Montag … 6 = Sonntag */
export function weekdayIndex(iso: string): number {
  return (toUtc(iso).getUTCDay() + 6) % 7;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function rangeDays(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export const monthOf = (iso: string) => iso.slice(0, 7);
export const isMonthKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const isIsoDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toUtc(v).getTime()) && fromUtc(toUtc(v)) === v;

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function monthBounds(month: string): { start: string; end: string } {
  const start = `${month}-01`;
  return { start, end: addDays(`${addMonths(month, 1)}-01`, -1) };
}

/** ISO-8601-Kalenderwoche */
export function isoWeek(iso: string): number {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { ...opts, timeZone: "UTC" });
const F = {
  long: fmt({ weekday: "long", day: "numeric", month: "long" }),
  medium: fmt({ day: "numeric", month: "short", year: "numeric" }),
  short: fmt({ day: "numeric", month: "short" }),
  weekday: fmt({ weekday: "short" }),
  month: fmt({ month: "long", year: "numeric" }),
  monthShort: fmt({ month: "short" }),
};

export const formatLong = (iso: string) => F.long.format(toUtc(iso));
export const formatMedium = (iso: string) => F.medium.format(toUtc(iso));
export const formatShort = (iso: string) => F.short.format(toUtc(iso)).replace(/\.$/, "");
export const formatWeekday = (iso: string) => F.weekday.format(toUtc(iso)).replace(/\.$/, "");
export const formatMonth = (month: string) => F.month.format(toUtc(`${month}-01`));
export const formatMonthShort = (month: string) => F.monthShort.format(toUtc(`${month}-01`)).replace(/\.$/, "");

/** "Heute", "Morgen", "Gestern", sonst kurzes Datum */
export function formatRelative(iso: string, today: string): string {
  const d = diffDays(iso, today);
  if (d === 0) return "Heute";
  if (d === 1) return "Morgen";
  if (d === -1) return "Gestern";
  if (d > 1 && d < 7) return F.weekday.format(toUtc(iso)).replace(/\.$/, "") + ", " + formatShort(iso);
  return iso.slice(0, 4) === today.slice(0, 4) ? formatShort(iso) : formatMedium(iso);
}
