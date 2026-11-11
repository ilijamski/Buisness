import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

const { notes, noteFolders } = schema;

export type FolderView = { id: string; name: string };

export async function listFolders(userId: string): Promise<FolderView[]> {
  const db = await getDb();
  return db
    .select({ id: noteFolders.id, name: noteFolders.name })
    .from(noteFolders)
    .where(eq(noteFolders.userId, userId))
    .orderBy(asc(noteFolders.name));
}

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
    folderId: n.folderId,
    updatedAt: n.updatedAt.toISOString(),
  }));
}
export type NoteView = Awaited<ReturnType<typeof listNotes>>[number];
