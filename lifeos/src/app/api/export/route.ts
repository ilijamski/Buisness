import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { getClock, getUser } from "@/lib/auth/session";

/** Vollständiger Export aller eigenen Daten als JSON-Datei. */
export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const [db, { today }] = await Promise.all([getDb(), getClock()]);
  const own = <T extends { userId: unknown }>(rows: T[]) => rows.map((row) => ({ ...row, userId: undefined }));
  const [projects, tasks, events, goals, habits, habitLogs, notes, transactions, budgets] = await Promise.all([
    db.select().from(schema.projects).where(eq(schema.projects.userId, user.id)),
    db.select().from(schema.tasks).where(eq(schema.tasks.userId, user.id)),
    db.select().from(schema.events).where(eq(schema.events.userId, user.id)),
    db.select().from(schema.goals).where(eq(schema.goals.userId, user.id)),
    db.select().from(schema.habits).where(eq(schema.habits.userId, user.id)),
    db.select().from(schema.habitLogs).where(eq(schema.habitLogs.userId, user.id)),
    db.select().from(schema.notes).where(eq(schema.notes.userId, user.id)),
    db.select().from(schema.transactions).where(eq(schema.transactions.userId, user.id)),
    db.select().from(schema.budgets).where(eq(schema.budgets.userId, user.id)),
  ]);
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: { name: user.name, email: user.email },
      projects: own(projects),
      tasks: own(tasks),
      events: own(events),
      goals: own(goals),
      habits: own(habits),
      habitLogs: own(habitLogs),
      notes: own(notes),
      transactions: own(transactions),
      budgets: own(budgets),
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="lifeos-export-${today}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
