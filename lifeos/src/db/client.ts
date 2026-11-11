import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migrations } from "./migrations";
import * as schema from "./schema";

/**
 * Ein Datenbankzugang für zwei Betriebsarten:
 *  - DATABASE_URL gesetzt  → echter Postgres-Server (Produktion).
 *  - sonst                 → eingebettetes Postgres (PGlite) als Datei unter ./.data.
 * Beide sprechen denselben SQL-Dialekt, daher gibt es nur ein Schema.
 */
export type Db = PgliteDatabase<typeof schema>;

type RawExec = (sql: string) => Promise<unknown>;
type RawQuery = (sql: string) => Promise<Record<string, unknown>[]>;

async function runMigrations(exec: RawExec, query: RawQuery) {
  await exec("create table if not exists _migrations (id integer primary key, applied_at timestamptz not null default now())");
  const applied = new Set((await query("select id from _migrations")).map((r) => Number(r.id)));
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    try {
      await exec(`begin; ${m.sql}; insert into _migrations (id) values (${m.id}); commit;`);
    } catch (error) {
      await exec("rollback").catch(() => {});
      // Starten zwei Instanzen gleichzeitig, gewinnt eine – die andere prüft nur nach.
      const now = await query(`select id from _migrations where id = ${m.id}`);
      if (!now.length) throw error;
    }
  }
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // prepare:false hält die Verbindung kompatibel mit Connection-Poolern (z. B. Supabase).
    const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
    await runMigrations(
      (q) => sql.unsafe(q),
      async (q) => (await sql.unsafe(q)) as unknown as Record<string, unknown>[],
    );
    return drizzle(sql, { schema }) as unknown as Db;
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL fehlt: In dieser Umgebung gibt es kein beschreibbares Dateisystem für die eingebettete Datenbank.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.LIFEOS_DATA_DIR ?? ".data/pglite");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.waitReady;
  await runMigrations(
    (q) => client.exec(q),
    async (q) => (await client.query(q)).rows as Record<string, unknown>[],
  );
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as { __lifeosDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__lifeosDb) {
    globalForDb.__lifeosDb = connect().catch((error) => {
      globalForDb.__lifeosDb = undefined;
      throw error;
    });
  }
  return globalForDb.__lifeosDb;
}

export { schema };
