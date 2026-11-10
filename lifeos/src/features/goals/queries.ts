import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export async function listGoals(userId: string) {
  const db = await getDb();
  return db.select().from(schema.goals).where(eq(schema.goals.userId, userId)).orderBy(asc(schema.goals.createdAt));
}
