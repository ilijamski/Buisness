"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { ACCOUNT_KINDS, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { zColor, zDate, zId, zOptionalId, zTitle } from "@/lib/validation";

const { transactions, budgets, accounts } = schema;

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
      counterparty: z.string().trim().max(120).default(""),
      accountId: zOptionalId.optional(),
      date: zDate,
    })
    .refine(
      (v) => (v.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).some((c) => c.key === v.category),
      "Bitte eine Kategorie wählen.",
    ),
  async ({ id, ...input }, { db, userId }) => {
    const values = { ...input, accountId: input.accountId ?? null };
    if (values.accountId) {
      const owned = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, values.accountId), eq(accounts.userId, userId)));
      if (!owned.length) throw new UserError("Das Konto wurde nicht gefunden.");
    }
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

/** Setzt die Monatsbudgets je Ausgabenkategorie; `null` entfernt ein Budget. */
export const saveBudgets = userAction(
  z.object({
    budgets: z
      .array(
        z.object({
          category: z.string().refine((c) => EXPENSE_CATEGORIES.some((e) => e.key === c), "Unbekannte Kategorie."),
          amountCents: z
            .number("Bitte gültige Beträge eingeben, z. B. 250 oder 250,50.")
            .int()
            .min(1, "Ein Budget muss größer als 0 sein.")
            .max(1_000_000_000, "Der Betrag ist zu groß.")
            .nullable(),
        }),
      )
      .max(EXPENSE_CATEGORIES.length),
  }),
  async (input, { db, userId }) => {
    await db.transaction(async (tx) => {
      for (const { category, amountCents } of input.budgets) {
        if (amountCents === null) {
          await tx.delete(budgets).where(and(eq(budgets.userId, userId), eq(budgets.category, category)));
        } else {
          await tx
            .insert(budgets)
            .values({ userId, category, amountCents })
            .onConflictDoUpdate({ target: [budgets.userId, budgets.category], set: { amountCents } });
        }
      }
    });
  },
);

export const saveAccount = userAction(
  z.object({
    id: zOptionalId.optional(),
    name: zTitle,
    kind: z.enum(ACCOUNT_KINDS).default("checking"),
    openingCents: z.number("Bitte einen gültigen Anfangsstand eingeben.").int().min(-1_000_000_000).max(1_000_000_000).default(0),
    color: zColor,
  }),
  async ({ id, ...values }, { db, userId }) => {
    if (id) {
      const rows = await db
        .update(accounts)
        .set(values)
        .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
        .returning({ id: accounts.id });
      if (!rows.length) throw new UserError("Das Konto wurde nicht gefunden.");
      return { id };
    }
    const [row] = await db.insert(accounts).values({ ...values, userId }).returning({ id: accounts.id });
    return { id: row.id };
  },
);

/** Löscht ein Konto; `withTransactions` entfernt auch dessen Buchungen, sonst bleiben sie ohne Konto erhalten. */
export const deleteAccount = userAction(
  z.object({ id: zId, withTransactions: z.boolean().default(false) }),
  async ({ id, withTransactions }, { db, userId }) => {
    await db.transaction(async (tx) => {
      if (withTransactions) {
        await tx.delete(transactions).where(and(eq(transactions.accountId, id), eq(transactions.userId, userId)));
      }
      await tx.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    });
  },
);
