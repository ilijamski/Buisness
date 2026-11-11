import "server-only";
import { and, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { occurrencesBetween } from "./recurrence";

const { events } = schema;

/** Ein Termin-Vorkommen für die Anzeige; `base*` beschreibt den gespeicherten Termin bzw. die Serie. */
export type EventOccurrence = {
  key: string;
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  color: number;
  repeat: string;
  repeatUntil: string | null;
  baseDate: string;
  baseEndDate: string | null;
};

/** Alle Vorkommen (einzelne, mehrtägige und Serientermine), die [from, to] berühren – chronologisch. */
export async function listEvents(userId: string, from: string, to: string): Promise<EventOccurrence[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        lte(events.date, to),
        or(
          and(eq(events.repeat, "none"), gte(sql`coalesce(${events.endDate}, ${events.date})`, from)),
          and(ne(events.repeat, "none"), or(isNull(events.repeatUntil), gte(events.repeatUntil, from))),
        ),
      ),
    );
  return rows
    .flatMap((e) =>
      occurrencesBetween(e, from, to).map((o) => ({
        key: `${e.id}:${o.start}`,
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        date: o.start,
        endDate: o.end,
        startTime: e.startTime,
        endTime: e.endTime,
        color: e.color,
        repeat: e.repeat,
        repeatUntil: e.repeatUntil,
        baseDate: e.date,
        baseEndDate: e.endDate,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title));
}
