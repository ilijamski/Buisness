"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { schema } from "@/db/client";
import { UserError, userAction } from "@/lib/action";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { seedDemoData } from "./seed";

const { users } = schema;
const dataTables = [
  schema.habitLogs,
  schema.habits,
  schema.tasks,
  schema.projects,
  schema.events,
  schema.goals,
  schema.notes,
  schema.transactions,
  schema.accounts,
  schema.budgets,
] as const;

export const updateProfile = userAction(
  z.object({
    name: z.string().trim().min(1, "Bitte gib deinen Namen ein.").max(80, "Der Name ist zu lang."),
    email: z.string().trim().toLowerCase().pipe(z.email("Bitte eine gültige E-Mail-Adresse eingeben.").max(254)),
  }),
  async (input, { db, userId }) => {
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, input.email), ne(users.id, userId)));
    if (taken.length) throw new UserError("Diese E-Mail-Adresse wird bereits verwendet.");
    await db.update(users).set(input).where(eq(users.id, userId));
  },
);

export const changePassword = userAction(
  z.object({
    current: z.string().min(1, "Bitte gib dein aktuelles Passwort ein.").max(200),
    next: z.string().min(8, "Das neue Passwort braucht mindestens 8 Zeichen.").max(200),
  }),
  async ({ current, next }, { db, userId }) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !(await verifyPassword(current, user.passwordHash))) {
      throw new UserError("Das aktuelle Passwort stimmt nicht.");
    }
    await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
    // Alle bestehenden Sitzungen (auch auf anderen Geräten) beenden und diese neu ausstellen.
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    await createSession(userId);
  },
);

export const loadDemoData = userAction(z.object({}), async (_input, { db, userId, today }) => {
  await db.transaction(async (tx) => {
    await seedDemoData(tx as unknown as typeof db, userId, today);
  });
});

export const clearAllData = userAction(z.object({}), async (_input, { db, userId }) => {
  await db.transaction(async (tx) => {
    for (const table of dataTables) await tx.delete(table).where(eq(table.userId, userId));
  });
});

export const deleteAccount = userAction(
  z.object({ password: z.string().min(1, "Bitte bestätige mit deinem Passwort.").max(200) }),
  async ({ password }, { db, userId }) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UserError("Das Passwort stimmt nicht.");
    }
    await destroySession();
    await db.delete(users).where(eq(users.id, userId));
    redirect("/login");
  },
);
