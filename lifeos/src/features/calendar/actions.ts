"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { zColor, zDate, zId, zOptionalId, zOptionalTime, zText, zTitle } from "@/lib/validation";

const { events } = schema;

export const saveEvent = userAction(
  z
    .object({
      id: zOptionalId.optional(),
      title: zTitle,
      description: zText,
      location: z.string().trim().max(200).default(""),
      date: zDate,
      startTime: zOptionalTime.optional(),
      endTime: zOptionalTime.optional(),
      color: zColor,
    })
    .refine((v) => !v.startTime || !v.endTime || v.endTime > v.startTime, "Das Ende muss nach dem Beginn liegen."),
  async ({ id, ...input }, { db, userId }) => {
    const startTime = input.startTime ?? null;
    const values = { ...input, startTime, endTime: startTime ? (input.endTime ?? null) : null };
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
