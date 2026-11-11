"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { zId, zOptionalId } from "@/lib/validation";

const { notes, noteFolders } = schema;

async function assertFolder(db: Parameters<Parameters<typeof userAction>[1]>[1]["db"], userId: string, folderId: string) {
  const rows = await db
    .select({ id: noteFolders.id })
    .from(noteFolders)
    .where(and(eq(noteFolders.id, folderId), eq(noteFolders.userId, userId)));
  if (!rows.length) throw new UserError("Der Ordner wurde nicht gefunden.");
}

export const createNote = userAction(z.object({ folderId: zOptionalId.optional() }), async ({ folderId }, { db, userId }) => {
  if (folderId) await assertFolder(db, userId, folderId);
  const [row] = await db.insert(notes).values({ userId, folderId: folderId ?? null }).returning({ id: notes.id });
  return { id: row.id };
});

export const updateNote = userAction(
  z.object({
    id: zId,
    title: z.string().max(200, "Der Titel ist zu lang.").optional(),
    content: z.string().max(100_000, "Die Notiz ist zu lang.").optional(),
    pinned: z.boolean().optional(),
    /** leerer Wert = aus dem Ordner herausnehmen */
    folderId: zOptionalId.optional(),
  }),
  async ({ id, ...patch }, { db, userId }) => {
    if (patch.folderId) await assertFolder(db, userId, patch.folderId);
    // Anheften soll die Sortierung nach Bearbeitungszeit nicht verändern.
    const touched = patch.title !== undefined || patch.content !== undefined;
    const rows = await db
      .update(notes)
      .set({ ...patch, ...(touched ? { updatedAt: new Date() } : {}) })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning({ id: notes.id });
    if (!rows.length) throw new UserError("Die Notiz wurde nicht gefunden.");
  },
);

export const deleteNote = userAction(z.object({ id: zId }), async ({ id }, { db, userId }) => {
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
});

export const saveFolder = userAction(
  z.object({
    id: zOptionalId.optional(),
    name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(60, "Der Name ist zu lang."),
  }),
  async ({ id, name }, { db, userId }) => {
    if (id) {
      const rows = await db
        .update(noteFolders)
        .set({ name })
        .where(and(eq(noteFolders.id, id), eq(noteFolders.userId, userId)))
        .returning({ id: noteFolders.id });
      if (!rows.length) throw new UserError("Der Ordner wurde nicht gefunden.");
      return { id };
    }
    const [row] = await db.insert(noteFolders).values({ userId, name }).returning({ id: noteFolders.id });
    return { id: row.id };
  },
);

/** Löscht nur den Ordner; seine Notizen bleiben erhalten und liegen danach in keinem Ordner. */
export const deleteFolder = userAction(z.object({ id: zId }), async ({ id }, { db, userId }) => {
  await db.delete(noteFolders).where(and(eq(noteFolders.id, id), eq(noteFolders.userId, userId)));
});
