"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema, type Db } from "@/db/client";
import { UserError, userAction, type ActionResult } from "@/lib/action";
import { getClock, getUser } from "@/lib/auth/session";
import { ASSET_CLASSES } from "@/lib/constants";
import { zId, zOptionalId, zTitle } from "@/lib/validation";
import { CsvError, decodeBytes } from "./csv";
import { parsePortfolio, type Position } from "./portfolio-csv";

const { holdings, portfolioSnapshots } = schema;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_POSITIONS = 1000;

/** Hält den heutigen Depotwert fest, damit sich die Entwicklung über die Zeit zeigen lässt. */
async function recordSnapshot(db: Db, userId: string, today: string) {
  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${holdings.valueCents}), 0)::int` })
    .from(holdings)
    .where(eq(holdings.userId, userId));
  await db
    .insert(portfolioSnapshots)
    .values({ userId, date: today, valueCents: total })
    .onConflictDoUpdate({ target: [portfolioSnapshots.userId, portfolioSnapshots.date], set: { valueCents: total } });
}

const zCents = z.number("Bitte einen gültigen Betrag eingeben.").int().min(1, "Der Wert muss größer als 0 sein.").max(2_000_000_000, "Der Betrag ist zu groß.");

export const saveHolding = userAction(
  z.object({
    id: zOptionalId.optional(),
    name: zTitle,
    isin: z.string().trim().toUpperCase().max(12).default(""),
    assetClass: z.enum(ASSET_CLASSES.map((c) => c.key) as [string, ...string[]]).default("stock"),
    quantity: z.number("Bitte eine gültige Stückzahl eingeben.").min(0).max(1e12).default(0),
    valueCents: zCents,
    costCents: zCents.nullable().default(null),
  }),
  async ({ id, ...values }, { db, userId, today }) => {
    if (id) {
      const rows = await db
        .update(holdings)
        .set(values)
        .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
        .returning({ id: holdings.id });
      if (!rows.length) throw new UserError("Die Position wurde nicht gefunden.");
    } else {
      await db.insert(holdings).values({ ...values, userId });
    }
    await recordSnapshot(db, userId, today);
  },
);

export const deleteHolding = userAction(z.object({ id: zId }), async ({ id }, { db, userId, today }) => {
  await db.delete(holdings).where(and(eq(holdings.id, id), eq(holdings.userId, userId)));
  await recordSnapshot(db, userId, today);
});

export type PortfolioPreview = {
  count: number;
  skipped: number;
  valueCents: number;
  costCents: number | null;
  currentCount: number;
  currentValueCents: number;
  columns: string[];
  sample: { name: string; isin: string; quantity: number; valueCents: number }[];
};

async function load(formData: FormData) {
  const user = await getUser();
  if (!user) throw new CsvError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new CsvError("Bitte eine CSV-Datei auswählen.");
  if (file.size > MAX_BYTES) throw new CsvError("Die Datei ist größer als 2 MB.");
  const parsed = parsePortfolio(decodeBytes(new Uint8Array(await file.arrayBuffer())));
  if (!parsed.positions.length) throw new CsvError("In der Datei wurden keine Positionen gefunden.");
  if (parsed.positions.length > MAX_POSITIONS) throw new CsvError(`Die Datei enthält mehr als ${MAX_POSITIONS} Positionen.`);
  return { db: await getDb(), userId: user.id, parsed };
}

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof CsvError) return { ok: false, error: error.message };
  console.error("[portfolio]", error);
  return { ok: false, error: "Die Datei konnte nicht verarbeitet werden." };
}

const sum = (positions: Position[]) => positions.reduce((a, p) => a + p.valueCents, 0);

/** Liest die Depotübersicht, ohne etwas zu speichern. */
export async function previewPortfolio(formData: FormData): Promise<ActionResult<PortfolioPreview>> {
  try {
    const { db, userId, parsed } = await load(formData);
    const [current] = await db
      .select({ count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${holdings.valueCents}), 0)::int` })
      .from(holdings)
      .where(eq(holdings.userId, userId));
    const withCost = parsed.positions.filter((p) => p.costCents !== null);
    return {
      ok: true,
      data: {
        count: parsed.positions.length,
        skipped: parsed.skipped,
        valueCents: sum(parsed.positions),
        costCents: withCost.length === parsed.positions.length ? withCost.reduce((a, p) => a + (p.costCents ?? 0), 0) : null,
        currentCount: current.count,
        currentValueCents: current.total,
        columns: parsed.columns,
        sample: [...parsed.positions]
          .sort((a, b) => b.valueCents - a.valueCents)
          .slice(0, 6)
          .map(({ name, isin, quantity, valueCents }) => ({ name, isin, quantity, valueCents })),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Ersetzt das gesamte Portfolio durch den Stand aus der Datei. Eine Depotübersicht
 * ist eine Momentaufnahme – Positionen, die nicht mehr darin stehen, wurden verkauft.
 */
export async function importPortfolio(formData: FormData): Promise<ActionResult<{ count: number }>> {
  try {
    const { db, userId, parsed } = await load(formData);
    const { today } = await getClock();
    await db.transaction(async (tx) => {
      await tx.delete(holdings).where(eq(holdings.userId, userId));
      await tx.insert(holdings).values(parsed.positions.map((p) => ({ ...p, userId })));
      await recordSnapshot(tx as unknown as Db, userId, today);
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { count: parsed.positions.length } };
  } catch (error) {
    return fail(error);
  }
}
