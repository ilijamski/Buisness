import { addDays, addMonths, diffDays, isIsoDate } from "../../lib/dates.ts";

export type RecurringEvent = {
  date: string;
  endDate: string | null;
  repeat: string;
  repeatUntil: string | null;
};

/** Ein konkretes Vorkommen eines Termins: erster und letzter Tag. */
export type Occurrence = { start: string; end: string };

const MAX_OCCURRENCES = 2000;

/**
 * Alle Vorkommen eines Termins, die den Zeitraum [from, to] berühren.
 * Monatliche und jährliche Serien überspringen Monate bzw. Jahre, in denen es
 * den Tag nicht gibt (31. bzw. 29. Februar) – wie in gängigen Kalendern.
 */
export function occurrencesBetween(event: RecurringEvent, from: string, to: string): Occurrence[] {
  const duration = Math.max(0, event.endDate ? diffDays(event.endDate, event.date) : 0);
  const lastStart = event.repeatUntil && event.repeatUntil < to ? event.repeatUntil : to;
  const firstStart = addDays(from, -duration); // ein früher begonnener Termin kann noch hineinragen
  const result: Occurrence[] = [];
  const push = (start: string) => {
    if (start >= event.date && start >= firstStart && start <= lastStart) result.push({ start, end: addDays(start, duration) });
  };

  if (event.repeat === "daily" || event.repeat === "weekly") {
    const step = event.repeat === "daily" ? 1 : 7;
    // Direkt zum ersten in Frage kommenden Vorkommen springen statt ab Serienbeginn zu zählen.
    const skipped = Math.max(0, Math.ceil(diffDays(firstStart, event.date) / step));
    for (let s = addDays(event.date, skipped * step); s <= lastStart && result.length < MAX_OCCURRENCES; s = addDays(s, step)) push(s);
  } else if (event.repeat === "monthly" || event.repeat === "yearly") {
    const step = event.repeat === "monthly" ? 1 : 12;
    const day = event.date.slice(7); // "-TT"
    const baseMonth = event.date.slice(0, 7);
    const [fy, fm] = firstStart.split("-").map(Number);
    const [by, bm] = baseMonth.split("-").map(Number);
    const skipped = Math.max(0, Math.floor(((fy - by) * 12 + (fm - bm)) / step));
    for (let i = skipped; result.length < MAX_OCCURRENCES; i++) {
      const candidate = `${addMonths(baseMonth, i * step)}${day}`;
      if (candidate.slice(0, 7) > lastStart.slice(0, 7)) break;
      if (isIsoDate(candidate)) push(candidate);
    }
  } else {
    push(event.date);
  }
  return result;
}
