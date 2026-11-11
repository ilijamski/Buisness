"use server";

import { createHash } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, type Db } from "@/db/client";
import type { ActionResult } from "@/lib/action";
import { getUser } from "@/lib/auth/session";
import { categoryMeta } from "@/lib/constants";
import { categorize, counterpartyKey, CsvError, decodeBytes, parseStatement, type BankRow } from "./csv";

const { transactions, accounts } = schema;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 10_000;

export type ImportPreview = {
  total: number;
  fresh: number;
  duplicates: number;
  skipped: number;
  from: string | null;
  to: string | null;
  incomeCents: number;
  expenseCents: number;
  columns: { date: string; amount: string; description: string | null; counterparty: string | null };
  sample: { date: string; title: string; category: string; amountCents: number; duplicate: boolean }[];
};

type Prepared = {
  externalId: string;
  type: "income" | "expense";
  category: string;
  amountCents: number;
  date: string;
  description: string;
  counterparty: string;
};

/**
 * Bereitet Bankbuchungen für ein Konto auf: Kategorie bestimmen und eine stabile
 * Kennung bilden. Zwei identische Buchungen am selben Tag erhalten über ihre
 * Position eigene Kennungen; ein erneuter Import derselben Datei erzeugt dieselben.
 * Auch ein späterer automatischer Bankabruf läuft über diese Funktion.
 */
async function prepare(db: Db, userId: string, accountId: string, rows: BankRow[]): Promise<Prepared[]> {
  const history = await db
    .select({ type: transactions.type, category: transactions.category, counterparty: transactions.counterparty })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), ne(transactions.counterparty, "")))
    .orderBy(desc(transactions.createdAt))
    .limit(5000);
  const learned = new Map<string, string>();
  for (const h of history) {
    const key = `${h.type}:${counterpartyKey(h.counterparty)}`;
    if (!learned.has(key)) learned.set(key, h.category); // jüngste Zuordnung gewinnt
  }

  const seen = new Map<string, number>();
  return rows.map((row) => {
    const base = [accountId, row.date, row.amountCents, row.counterparty, row.description].join("|");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return {
      externalId: createHash("sha256").update(`${base}|${n}`).digest("hex").slice(0, 40),
      ...categorize(row, learned),
      amountCents: Math.abs(row.amountCents),
      date: row.date,
      description: row.description,
      counterparty: row.counterparty,
    };
  });
}

async function existingIds(db: Db, userId: string, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await db
      .select({ externalId: transactions.externalId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.externalId, ids.slice(i, i + 500))));
    for (const r of rows) if (r.externalId) found.add(r.externalId);
  }
  return found;
}

async function load(formData: FormData) {
  const user = await getUser();
  if (!user) throw new CsvError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
  const file = formData.get("file");
  const accountId = String(formData.get("accountId") ?? "");
  if (!(file instanceof File) || file.size === 0) throw new CsvError("Bitte eine CSV-Datei auswählen.");
  if (file.size > MAX_BYTES) throw new CsvError("Die Datei ist größer als 4 MB. Bitte einen kürzeren Zeitraum exportieren.");
  const db = await getDb();
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, user.id)));
  if (!account) throw new CsvError("Bitte ein Konto auswählen.");

  const statement = parseStatement(decodeBytes(new Uint8Array(await file.arrayBuffer())));
  if (!statement.rows.length) throw new CsvError("In der Datei wurden keine Buchungen gefunden.");
  if (statement.rows.length > MAX_ROWS) throw new CsvError(`Die Datei enthält mehr als ${MAX_ROWS} Buchungen. Bitte einen kürzeren Zeitraum exportieren.`);
  const prepared = await prepare(db, user.id, account.id, statement.rows);
  const known = await existingIds(db, user.id, prepared.map((p) => p.externalId));
  return { db, userId: user.id, accountId: account.id, statement, prepared, known };
}

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof CsvError) return { ok: false, error: error.message };
  console.error("[import]", error);
  return { ok: false, error: "Die Datei konnte nicht verarbeitet werden." };
}

/** Liest die Datei, ohne etwas zu speichern, und zeigt, was ein Import bewirken würde. */
export async function previewImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  try {
    const { statement, prepared, known } = await load(formData);
    const fresh = prepared.filter((p) => !known.has(p.externalId));
    const dates = prepared.map((p) => p.date).sort();
    return {
      ok: true,
      data: {
        total: prepared.length,
        fresh: fresh.length,
        duplicates: prepared.length - fresh.length,
        skipped: statement.skipped,
        from: dates[0] ?? null,
        to: dates[dates.length - 1] ?? null,
        incomeCents: fresh.filter((p) => p.type === "income").reduce((a, p) => a + p.amountCents, 0),
        expenseCents: fresh.filter((p) => p.type === "expense").reduce((a, p) => a + p.amountCents, 0),
        columns: statement.columns,
        sample: prepared.slice(0, 6).map((p) => ({
          date: p.date,
          title: p.counterparty || p.description || "Ohne Text",
          category: categoryMeta(p.category).label,
          amountCents: p.type === "income" ? p.amountCents : -p.amountCents,
          duplicate: known.has(p.externalId),
        })),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

/** Speichert alle Buchungen der Datei, die noch nicht vorhanden sind. */
export async function runImport(formData: FormData): Promise<ActionResult<{ imported: number; duplicates: number }>> {
  try {
    const { db, userId, accountId, prepared, known } = await load(formData);
    const fresh = prepared.filter((p) => !known.has(p.externalId));
    let imported = 0;
    await db.transaction(async (tx) => {
      for (let i = 0; i < fresh.length; i += 500) {
        const rows = await tx
          .insert(transactions)
          .values(fresh.slice(i, i + 500).map((p) => ({ ...p, userId, accountId })))
          .onConflictDoNothing({ target: [transactions.userId, transactions.externalId] })
          .returning({ id: transactions.id });
        imported += rows.length;
      }
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { imported, duplicates: prepared.length - imported } };
  } catch (error) {
    return fail(error);
  }
}
