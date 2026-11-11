import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema } from "@/db/client";
import { DEFAULT_TZ, todayIn } from "@/lib/dates";

const COOKIE = "lifeos_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAX_AGE_S * 1000);
  await db.insert(schema.sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  // Abgelaufene Sitzungen gelegentlich aufräumen
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)));
  }
  store.delete(COOKIE);
}

export type SessionUser = { id: string; email: string; name: string };

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Zeitzone des Browsers (per Cookie gemeldet) und der daraus abgeleitete heutige Tag. */
export async function getClock(): Promise<{ tz: string; today: string }> {
  const raw = (await cookies()).get("lifeos_tz")?.value;
  let tz = DEFAULT_TZ;
  try {
    // Der Cookie-Wert stammt vom Client und kann beliebig sein.
    if (raw && raw.length < 100) tz = decodeURIComponent(raw);
  } catch {}
  return { tz, today: todayIn(tz) };
}
