"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { EVENT_REPEATS } from "@/lib/constants";
import { addDays, diffDays } from "@/lib/dates";
import { zColor, zDate, zId, zOptionalDate, zOptionalId, zOptionalTime, zText, zTitle } from "@/lib/validation";

const { events } = schema;

export const saveEvent = userAction(
  z
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
    })
    .refine((v) => !v.endDate || v.endDate >= v.date, "Der letzte Tag darf nicht vor dem ersten liegen.")
    .refine((v) => !v.endDate || diffDays(v.endDate, v.date) <= 366, "Ein Termin kann höchstens ein Jahr dauern.")
    .refine(
      // Bei mehrtägigen Terminen liegt das Ende an einem anderen Tag – die Uhrzeiten sind dann unabhängig.
      (v) => (v.endDate && v.endDate > v.date) || !v.startTime || !v.endTime || v.endTime > v.startTime,
      "Das Ende muss nach dem Beginn liegen.",
    )
    .refine((v) => v.repeat === "none" || !v.repeatUntil || v.repeatUntil >= v.date, "Die Serie kann nicht vor ihrem ersten Termin enden."),
  async ({ id, ...input }, { db, userId }) => {
    const startTime = input.startTime ?? null;
    const values = {
      ...input,
      startTime,
      endTime: startTime ? (input.endTime ?? null) : null,
      endDate: input.endDate && input.endDate > input.date ? input.endDate : null,
      repeatUntil: input.repeat === "none" ? null : (input.repeatUntil ?? null),
    };
    if (id) {
      const rows = await db
        .update(events)
        .set(values)
        .where(and(eq(events.id, id), eq(events.userId, userId)))
        .returning({ id: events.id });
      if (!rows.length) throw new UserError("Der Termin wurde nicht gefunden.");
      return;
    }
    await db.insert(events).values({ ...values, userId });
  },
);

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
