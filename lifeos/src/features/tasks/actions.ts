"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { zId, zOptionalDate, zOptionalId, zText, zTitle } from "@/lib/validation";

const { tasks, projects } = schema;

const taskInput = z.object({
  id: zOptionalId.optional(),
  title: zTitle,
  notes: zText,
  priority: z.enum(PRIORITIES).default("medium"),
  status: z.enum(TASK_STATUSES).default("todo"),
  dueDate: zOptionalDate.optional(),
  projectId: zOptionalId.optional(),
});

export const saveTask = userAction(taskInput, async (input, { db, userId, today }) => {
  if (input.projectId) {
    const owned = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.userId, userId)));
    if (!owned.length) throw new UserError("Das Projekt wurde nicht gefunden.");
  }
  const values = {
    title: input.title,
    notes: input.notes,
    priority: input.priority,
    status: input.status,
    dueDate: input.dueDate ?? null,
    projectId: input.projectId ?? null,
  };
  if (input.id) {
    const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, input.id), eq(tasks.userId, userId)));
    if (!existing) throw new UserError("Die Aufgabe wurde nicht gefunden.");
    const completedOn = values.status === "done" ? (existing.completedOn ?? today) : null;
    await db.update(tasks).set({ ...values, completedOn }).where(eq(tasks.id, existing.id));
    return { id: existing.id };
  }
  const [row] = await db
    .insert(tasks)
    .values({ ...values, userId, completedOn: values.status === "done" ? today : null })
    .returning({ id: tasks.id });
  return { id: row.id };
});

export const setTaskStatus = userAction(
  z.object({ id: zId, status: z.enum(TASK_STATUSES) }),
  async ({ id, status }, { db, userId, today }) => {
    await db
      .update(tasks)
      .set({ status, completedOn: status === "done" ? today : null })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  },
);

export const deleteTask = userAction(z.object({ id: zId }), async ({ id }, { db, userId }) => {
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
});
