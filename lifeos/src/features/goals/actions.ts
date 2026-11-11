"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { GOAL_CATEGORIES } from "@/lib/constants";
import { zId, zOptionalDate, zOptionalId, zText, zTitle } from "@/lib/validation";

const { goals } = schema;
const zAmount = z.number("Bitte eine Zahl eingeben.").finite().min(0, "Der Wert darf nicht negativ sein.").max(1e9);

export const saveGoal = userAction(
  z.object({
    id: zOptionalId.optional(),
    title: zTitle,
    description: zText,
    category: z.enum(GOAL_CATEGORIES).default("personal"),
    current: zAmount.default(0),
    target: zAmount.refine((v) => v > 0, "Der Zielwert muss größer als 0 sein."),
    unit: z.string().trim().max(20).default(""),
    deadline: zOptionalDate.optional(),
  }),
  async ({ id, ...input }, { db, userId, today }) => {
    const reached = input.current >= input.target;
    const values = { ...input, deadline: input.deadline ?? null };
    if (id) {
      const [existing] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
      if (!existing) throw new UserError("Das Ziel wurde nicht gefunden.");
      await db
        .update(goals)
        .set({ ...values, completedOn: reached ? (existing.completedOn ?? today) : null })
        .where(eq(goals.id, id));
      return;
    }
    await db.insert(goals).values({ ...values, userId, completedOn: reached ? today : null });
  },
);

export const setGoalProgress = userAction(
  z.object({ id: zId, current: zAmount }),
  async ({ id, current }, { db, userId, today }) => {
    const [goal] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
    if (!goal) throw new UserError("Das Ziel wurde nicht gefunden.");
    const reached = current >= goal.target;
    await db
      .update(goals)
      .set({ current, completedOn: reached ? (goal.completedOn ?? today) : null })
      .where(eq(goals.id, id));
  },
);

export const deleteGoal = userAction(z.object({ id: zId }), async ({ id }, { db, userId }) => {
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
});
