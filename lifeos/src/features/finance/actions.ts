"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { zDate, zId, zOptionalId } from "@/lib/validation";

const { transactions } = schema;

export const saveTransaction = userAction(
  z
    .object({
      id: zOptionalId.optional(),
      type: z.enum(["income", "expense"]),
      amountCents: z
        .number("Bitte einen Betrag eingeben.")
        .int()
        .min(1, "Der Betrag muss größer als 0 sein.")
        .max(1_000_000_000, "Der Betrag ist zu groß."),
      category: z.string(),
      description: z.string().trim().max(200).default(""),
      date: zDate,
    })
    .refine(
      (v) => (v.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).some((c) => c.key === v.category),
      "Bitte eine Kategorie wählen.",
    ),
  async ({ id, ...values }, { db, userId }) => {
    if (id) {
      const rows = await db
        .update(transactions)
        .set(values)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
        .returning({ id: transactions.id });
      if (!rows.length) throw new UserError("Die Buchung wurde nicht gefunden.");
      return;
    }
    await db.insert(transactions).values({ ...values, userId });
  },
);

export const deleteTransaction = userAction(z.object({ id: zId }), async ({ id }, { db, userId }) => {
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
});
