"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { zId } from "@/lib/validation";

const { notes } = schema;

export const createNote = userAction(z.object({}), async (_input, { db, userId }) => {
  const [row] = await db.insert(notes).values({ userId }).returning({ id: notes.id });
  return { id: row.id };
});

export const updateNote = userAction(
  z.object({
    id: zId,
    title: z.string().max(200, "Der Titel ist zu lang.").optional(),
    content: z.string().max(100_000, "Die Notiz ist zu lang.").optional(),
    pinned: z.boolean().optional(),
  }),
  async ({ id, ...patch }, { db, userId }) => {
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
