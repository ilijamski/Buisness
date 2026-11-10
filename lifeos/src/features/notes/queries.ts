import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

const { notes } = schema;

export async function listNotes(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt));
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    updatedAt: n.updatedAt.toISOString(),
  }));
}
export type NoteView = Awaited<ReturnType<typeof listNotes>>[number];
