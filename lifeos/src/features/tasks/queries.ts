import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

const { tasks, projects } = schema;

export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

export async function listTasks(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      notes: tasks.notes,
      priority: tasks.priority,
      status: tasks.status,
      dueDate: tasks.dueDate,
      completedOn: tasks.completedOn,
      projectId: tasks.projectId,
      projectName: projects.name,
      projectColor: projects.color,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.createdAt));
}
