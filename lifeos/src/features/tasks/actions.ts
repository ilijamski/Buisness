"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import type { Db } from "@/db/client";
import type { Task } from "@/db/schema";
import { PRIORITIES, TASK_REPEATS, TASK_STATUSES } from "@/lib/constants";
import { addDays, addMonthsClamped } from "@/lib/dates";
import { zId, zOptionalDate, zOptionalId, zText, zTitle } from "@/lib/validation";

const { tasks, projects } = schema;

/**
 * Wird eine wiederkehrende Aufgabe erledigt, entsteht die nächste Ausgabe mit dem
 * folgenden Fälligkeitstermin. Die Wiederholung wandert auf die neue Aufgabe, damit
 * erneutes Öffnen und Abhaken der alten keine doppelten Folgeaufgaben erzeugt.
 */
async function spawnNext(db: Db, task: Task, today: string): Promise<string | null> {
  if (task.repeat === "none") return null;
  const step = (d: string) => (task.repeat === "daily" ? addDays(d, 1) : task.repeat === "weekly" ? addDays(d, 7) : addMonthsClamped(d, 1));
  let next = step(task.dueDate ?? today);
  // Lange überfällige Aufgaben nicht in der Vergangenheit fortsetzen.
  for (let i = 0; next <= today && i < 1000; i++) next = step(next);
  await db.insert(tasks).values({
    userId: task.userId,
    projectId: task.projectId,
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    repeat: task.repeat,
    dueDate: next,
  });
  await db.update(tasks).set({ repeat: "none" }).where(eq(tasks.id, task.id));
  return next;
}

const taskInput = z.object({
  id: zOptionalId.optional(),
  title: zTitle,
  notes: zText,
  priority: z.enum(PRIORITIES).default("medium"),
  status: z.enum(TASK_STATUSES).default("todo"),
  dueDate: zOptionalDate.optional(),
  projectId: zOptionalId.optional(),
  repeat: z.enum(TASK_REPEATS).default("none"),
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
    repeat: input.repeat,
  };
  if (input.id) {
    const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, input.id), eq(tasks.userId, userId)));
    if (!existing) throw new UserError("Die Aufgabe wurde nicht gefunden.");
    const completedOn = values.status === "done" ? (existing.completedOn ?? today) : null;
    const [updated] = await db.update(tasks).set({ ...values, completedOn }).where(eq(tasks.id, existing.id)).returning();
    const next = values.status === "done" && existing.status !== "done" ? await spawnNext(db, updated, today) : null;
    return { id: existing.id, next };
  }
  const [row] = await db
    .insert(tasks)
    .values({ ...values, userId, completedOn: values.status === "done" ? today : null })
    .returning();
  return { id: row.id, next: values.status === "done" ? await spawnNext(db, row, today) : null };
});

export const setTaskStatus = userAction(
  z.object({ id: zId, status: z.enum(TASK_STATUSES) }),
  async ({ id, status }, { db, userId, today }) => {
    const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    if (!existing) throw new UserError("Die Aufgabe wurde nicht gefunden.");
    await db
      .update(tasks)
      .set({ status, completedOn: status === "done" ? (existing.completedOn ?? today) : null })
      .where(eq(tasks.id, id));
    return { next: status === "done" && existing.status !== "done" ? await spawnNext(db, existing, today) : null };
  },
);

export const deleteTask = userAction(z.object({ id: zId }), async ({ id }, { db, userId }) => {
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
});
