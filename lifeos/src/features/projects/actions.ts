"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { PROJECT_STATUSES } from "@/lib/constants";
import { zColor, zId, zOptionalDate, zOptionalId, zText, zTitle } from "@/lib/validation";

const { projects } = schema;

export const saveProject = userAction(
  z.object({
    id: zOptionalId.optional(),
    name: zTitle,
    description: zText,
    status: z.enum(PROJECT_STATUSES).default("active"),
    color: zColor,
    dueDate: zOptionalDate.optional(),
  }),
  async ({ id, ...input }, { db, userId }) => {
    const values = { ...input, dueDate: input.dueDate ?? null };
    if (id) {
      const rows = await db
        .update(projects)
        .set(values)
        .where(and(eq(projects.id, id), eq(projects.userId, userId)))
        .returning({ id: projects.id });
      if (!rows.length) throw new UserError("Das Projekt wurde nicht gefunden.");
      return { id };
    }
    const [row] = await db.insert(projects).values({ ...values, userId }).returning({ id: projects.id });
    return { id: row.id };
  },
);

export const deleteProject = userAction(z.object({ id: zId }), async ({ id }, { db, userId }) => {
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
});
