import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

const { projects, tasks } = schema;

export type ProjectRow = Awaited<ReturnType<typeof listProjects>>[number];

export async function listProjects(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      color: projects.color,
      dueDate: projects.dueDate,
      total: sql<number>`count(${tasks.id})::int`,
      done: sql<number>`(count(${tasks.id}) filter (where ${tasks.status} = 'done'))::int`,
    })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .groupBy(projects.id)
    .orderBy(asc(projects.createdAt));
}

export async function getProject(userId: string, id: string) {
  const db = await getDb();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
  return project ?? null;
}
