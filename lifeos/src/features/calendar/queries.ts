import "server-only";
import { and, asc, between, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

const { events } = schema;

export async function listEvents(userId: string, from: string, to: string) {
  const db = await getDb();
  return db
    .select()
    .from(events)
    .where(and(eq(events.userId, userId), between(events.date, from, to)))
    .orderBy(asc(events.date), sql`${events.startTime} asc nulls first`);
}
