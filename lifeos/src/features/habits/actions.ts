"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { diffDays } from "@/lib/dates";
import { zColor, zDate, zId, zOptionalId, zTitle } from "@/lib/validation";

const { habits, habitLogs } = schema;

export const saveHabit = userAction(
  z.object({
    id: zOptionalId.optional(),
    name: zTitle,
    color: zColor,
    targetPerWeek: z.number().int().min(1).max(7).default(7),
  }),
  async ({ id, ...values }, { db, userId }) => {
    if (id) {
      const rows = await db
        .update(habits)
        .set(values)
        .where(and(eq(habits.id, id), eq(habits.userId, userId)))
        .returning({ id: habits.id });
      if (!rows.length) throw new UserError("Die Gewohnheit wurde nicht gefunden.");
      return;
    }
    await db.insert(habits).values({ ...values, userId });
  },
);

export const deleteHabit = userAction(z.object({ id: zId }), async ({ id }, { db, userId }) => {
  await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
});

/** Setzt oder entfernt den Haken einer Gewohnheit für einen Tag. */
export const setHabitDone = userAction(
  z.object({ habitId: zId, date: zDate, done: z.boolean() }),
  async ({ habitId, date, done }, { db, userId, today }) => {
    // Ein Tag Toleranz, falls die Zeitzone des Browsers noch nicht gemeldet wurde.
    if (diffDays(date, today) > 1) throw new UserError("Tage in der Zukunft lassen sich nicht abhaken.");
    const [habit] = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
    if (!habit) throw new UserError("Die Gewohnheit wurde nicht gefunden.");
    if (done) {
      await db.insert(habitLogs).values({ habitId, userId, date }).onConflictDoNothing();
    } else {
      await db.delete(habitLogs).where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));
    }
  },
);
