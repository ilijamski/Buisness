"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

const { users } = schema;
export type AuthState = { error?: string; values?: { name?: string; email?: string } };

const zEmail = z.string().trim().toLowerCase().pipe(z.email("Bitte eine gültige E-Mail-Adresse eingeben.").max(254));
const zPassword = z
  .string()
  .min(8, "Das Passwort braucht mindestens 8 Zeichen.")
  .max(200, "Das Passwort ist zu lang.");

/** Einfache Bremse gegen Passwort-Raten: max. 8 Fehlversuche pro Schlüssel in 10 Minuten. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
function isBlocked(key: string) {
  const entry = attempts.get(key);
  if (entry && entry.resetAt < Date.now()) attempts.delete(key);
  return (attempts.get(key)?.count ?? 0) >= MAX_ATTEMPTS;
}
function recordFailure(key: string) {
  const entry = attempts.get(key);
  if (entry) entry.count++;
  else attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  if (attempts.size > 10_000) attempts.clear();
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Bitte gib deinen Namen ein.").max(80, "Der Name ist zu lang."),
      email: zEmail,
      password: zPassword,
    })
    .safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const db = await getDb();
  const passwordHash = await hashPassword(parsed.data.password);
  const inserted = await db
    .insert(users)
    .values({ name: parsed.data.name, email: parsed.data.email, passwordHash })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (!inserted.length) {
    return { error: "Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde dich stattdessen an.", values };
  }
  await createSession(inserted[0].id);
  redirect("/dashboard");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = z
    .object({ email: zEmail, password: z.string().min(1, "Bitte gib dein Passwort ein.").max(200) })
    .safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const keys = [`ip:${ip}`, `email:${parsed.data.email}`];
  if (keys.some(isBlocked)) {
    return { error: "Zu viele Fehlversuche. Bitte warte ein paar Minuten und versuche es dann erneut.", values };
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    keys.forEach(recordFailure);
    return { error: "E-Mail-Adresse oder Passwort stimmen nicht.", values };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
