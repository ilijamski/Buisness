"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { EVENT_REPEATS } from "@/lib/constants";
import { addDays, diffDays } from "@/lib/dates";
import { zColor, zDate, zId, zOptionalDate, zOptionalId, zOptionalTime, zText, zTitle } from "@/lib/validation";

const { events } = schema;

const eventInput = z
  .object({
    id: zOptionalId.optional(),
    title: zTitle,
    description: zText,
    location: z.string().trim().max(200).default(""),
    date: zDate,
    endDate: zOptionalDate.optional(),
    startTime: zOptionalTime.optional(),
    endTime: zOptionalTime.optional(),
    repeat: z.enum(EVENT_REPEATS).default("none"),
    repeatUntil: zOptionalDate.optional(),
    color: zColor,
    /**
     * Nur beim Bearbeiten eines Serientermins: das angeklickte Vorkommen und ob die
     * Änderung nur dafür ("single") oder für die ganze Serie ("series") gelten soll.
     */
    occurrenceDate: zOptionalDate.optional(),
    scope: z.enum(["single", "series"]).default("series"),
  })
  .refine((v) => !v.endDate || v.endDate >= v.date, "Der letzte Tag darf nicht vor dem ersten liegen.")
  .refine((v) => !v.endDate || diffDays(v.endDate, v.date) <= 366, "Ein Termin kann höchstens ein Jahr dauern.")
  .refine(
    // Bei mehrtägigen Terminen liegt das Ende an einem anderen Tag – die Uhrzeiten sind dann unabhängig.
    (v) => (v.endDate && v.endDate > v.date) || !v.startTime || !v.endTime || v.endTime > v.startTime,
    "Das Ende muss nach dem Beginn liegen.",
  )
  .refine(
    (v) => v.scope === "single" || v.repeat === "none" || !v.repeatUntil || v.repeatUntil >= v.date,
    "Die Serie kann nicht vor ihrem ersten Termin enden.",
  );

const addSkip = (list: string, date: string) => [...new Set([...list.split(",").filter(Boolean), date])].sort().join(",");

export const saveEvent = userAction(eventInput, async ({ id, occurrenceDate, scope, ...input }, { db, userId }) => {
  const startTime = input.startTime ?? null;
  const values = {
    ...input,
    startTime,
    endTime: startTime ? (input.endTime ?? null) : null,
    endDate: input.endDate && input.endDate > input.date ? input.endDate : null,
    repeatUntil: input.repeat === "none" ? null : (input.repeatUntil ?? null),
  };
  if (!id) {
    await db.insert(events).values({ ...values, userId });
    return;
  }
  const [existing] = await db.select().from(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  if (!existing) throw new UserError("Der Termin wurde nicht gefunden.");
  const isSeries = existing.repeat !== "none";

  if (isSeries && occurrenceDate && scope === "single") {
    // Nur dieses Vorkommen: aus der Serie herausnehmen und als eigenen Termin ablegen.
    await db.transaction(async (tx) => {
      await tx.update(events).set({ skipDates: addSkip(existing.skipDates, occurrenceDate) }).where(eq(events.id, id));
      await tx.insert(events).values({ ...values, repeat: "none", repeatUntil: null, userId });
    });
    return;
  }

  if (isSeries && occurrenceDate) {
    // Ganze Serie: Das Formular zeigt das angeklickte Vorkommen. Wurde dessen Datum
    // verschoben, wandert der Serienbeginn (samt Ausnahmen) um dieselbe Zahl Tage mit.
    const shift = diffDays(input.date, occurrenceDate);
    const duration = values.endDate ? diffDays(values.endDate, input.date) : 0;
    const date = addDays(existing.date, shift);
    await db
      .update(events)
      .set({
        ...values,
        date,
        endDate: duration > 0 ? addDays(date, duration) : null,
        skipDates: existing.skipDates
          .split(",")
          .filter(Boolean)
          .map((d) => addDays(d, shift))
          .join(","),
      })
      .where(eq(events.id, id));
    return;
  }

  await db.update(events).set(values).where(eq(events.id, id));
});

/** Nimmt ein einzelnes Vorkommen aus einer Serie heraus; alle anderen bleiben. */
export const skipOccurrence = userAction(z.object({ id: zId, date: zDate }), async ({ id, date }, { db, userId }) => {
  const [event] = await db.select().from(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  if (!event) throw new UserError("Der Termin wurde nicht gefunden.");
  if (event.repeat === "none") {
    await db.delete(events).where(eq(events.id, id));
    return;
  }
  await db.update(events).set({ skipDates: addSkip(event.skipDates, date) }).where(eq(events.id, id));
});

export const deleteEvent = userAction(z.object({ id: zId }), async ({ id }, { db, userId }) => {
  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId)));
});

/** Beendet eine Serie am Vortag des angegebenen Vorkommens – frühere Termine bleiben erhalten. */
export const endSeriesBefore = userAction(z.object({ id: zId, date: zDate }), async ({ id, date }, { db, userId }) => {
  const [event] = await db.select().from(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  if (!event) throw new UserError("Der Termin wurde nicht gefunden.");
  if (event.repeat === "none" || date <= event.date) {
    await db.delete(events).where(eq(events.id, id));
    return;
  }
  await db.update(events).set({ repeatUntil: addDays(date, -1) }).where(eq(events.id, id));
});
