import "server-only";
import { and, asc, between, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { addMonths, monthBounds } from "@/lib/dates";

const { transactions, budgets, accounts, holdings, portfolioSnapshots } = schema;

export type HoldingView = { id: string; name: string; isin: string; assetClass: string; quantity: number; valueCents: number; costCents: number | null };

export async function listHoldings(userId: string): Promise<HoldingView[]> {
  const db = await getDb();
  return db
    .select({
      id: holdings.id,
      name: holdings.name,
      isin: holdings.isin,
      assetClass: holdings.assetClass,
      quantity: holdings.quantity,
      valueCents: holdings.valueCents,
      costCents: holdings.costCents,
    })
    .from(holdings)
    .where(eq(holdings.userId, userId))
    .orderBy(desc(holdings.valueCents));
}

/** Depotwert je Tag, älteste zuerst (höchstens die letzten 400 Einträge). */
export async function listSnapshots(userId: string): Promise<{ date: string; valueCents: number }[]> {
  const db = await getDb();
  const rows = await db
    .select({ date: portfolioSnapshots.date, valueCents: portfolioSnapshots.valueCents })
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.userId, userId))
    .orderBy(desc(portfolioSnapshots.date))
    .limit(400);
  return rows.reverse();
}

export type AccountView = { id: string; name: string; kind: string; color: number; openingCents: number; balanceCents: number; count: number };

/** Konten mit aktuellem Stand (Anfangsstand plus alle erfassten Buchungen). */
export async function listAccounts(userId: string): Promise<AccountView[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      kind: accounts.kind,
      color: accounts.color,
      openingCents: accounts.openingCents,
      movement: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountCents} else -${transactions.amountCents} end), 0)::int`,
      count: sql<number>`count(${transactions.id})::int`,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .groupBy(accounts.id)
    .orderBy(asc(accounts.createdAt));
  return rows.map(({ movement, ...a }) => ({ ...a, balanceCents: a.openingCents + movement }));
}

/** Monatsbudgets als Zuordnung Kategorie → Cent. */
export async function listBudgets(userId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.select().from(budgets).where(eq(budgets.userId, userId));
  return Object.fromEntries(rows.map((b) => [b.category, b.amountCents]));
}

/** `accountId` schränkt auf ein Konto ein; ohne Angabe zählen alle Buchungen. */
export async function listTransactions(userId: string, month: string, accountId?: string) {
  const db = await getDb();
  const { start, end } = monthBounds(month);
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        between(transactions.date, start, end),
        accountId ? eq(transactions.accountId, accountId) : undefined,
      ),
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
}

export type MonthTotals = { month: string; income: number; expense: number };

/** Einnahmen und Ausgaben je Monat für die letzten `count` Monate bis einschließlich `month`. */
export async function monthlyTotals(userId: string, month: string, count: number, accountId?: string): Promise<MonthTotals[]> {
  const db = await getDb();
  const first = addMonths(month, -(count - 1));
  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      type: transactions.type,
      total: sql<number>`sum(${transactions.amountCents})::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        between(transactions.date, `${first}-01`, monthBounds(month).end),
        accountId ? eq(transactions.accountId, accountId) : undefined,
      ),
    )
    .groupBy(sql`1`, transactions.type);
  return Array.from({ length: count }, (_, i) => {
    const m = addMonths(first, i);
    const pick = (type: string) => rows.find((r) => r.month === m && r.type === type)?.total ?? 0;
    return { month: m, income: pick("income"), expense: pick("expense") };
  });
}
