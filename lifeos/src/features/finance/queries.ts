import "server-only";
import { and, between, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { addMonths, monthBounds } from "@/lib/dates";

const { transactions, budgets } = schema;

/** Monatsbudgets als Zuordnung Kategorie → Cent. */
export async function listBudgets(userId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.select().from(budgets).where(eq(budgets.userId, userId));
  return Object.fromEntries(rows.map((b) => [b.category, b.amountCents]));
}

export async function listTransactions(userId: string, month: string) {
  const db = await getDb();
  const { start, end } = monthBounds(month);
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), between(transactions.date, start, end)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
}

export type MonthTotals = { month: string; income: number; expense: number };

/** Einnahmen und Ausgaben je Monat für die letzten `count` Monate bis einschließlich `month`. */
export async function monthlyTotals(userId: string, month: string, count: number): Promise<MonthTotals[]> {
  const db = await getDb();
  const first = addMonths(month, -(count - 1));
  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      type: transactions.type,
      total: sql<number>`sum(${transactions.amountCents})::int`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), between(transactions.date, `${first}-01`, monthBounds(month).end)))
    .groupBy(sql`1`, transactions.type);
  return Array.from({ length: count }, (_, i) => {
    const m = addMonths(first, i);
    const pick = (type: string) => rows.find((r) => r.month === m && r.type === type)?.total ?? 0;
    return { month: m, income: pick("income"), expense: pick("expense") };
  });
}
