import "server-only";
import { and, between, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { addDays, rangeDays } from "@/lib/dates";

const { tasks, habits, habitLogs, transactions, events } = schema;

export type DayStat = {
  date: string;
  tasksDone: number;
  habitsDone: number;
  habitsPossible: number;
  spent: number;
  earned: number;
  events: number;
};
export type WeekTotals = {
  tasksDone: number;
  habitsDone: number;
  habitsPossible: number;
  habitRate: number;
  spent: number;
  earned: number;
  events: number;
};
export type WeekStat = WeekTotals & { weekStart: string };

const sum = (days: DayStat[]): WeekTotals => {
  const t = days.reduce(
    (a, d) => ({
      tasksDone: a.tasksDone + d.tasksDone,
      habitsDone: a.habitsDone + d.habitsDone,
      habitsPossible: a.habitsPossible + d.habitsPossible,
      spent: a.spent + d.spent,
      earned: a.earned + d.earned,
      events: a.events + d.events,
    }),
    { tasksDone: 0, habitsDone: 0, habitsPossible: 0, spent: 0, earned: 0, events: 0 },
  );
  return { ...t, habitRate: t.habitsPossible ? t.habitsDone / t.habitsPossible : 0 };
};

/**
 * Tageswerte für `weeks` Wochen bis einschließlich der Woche ab `weekStart`.
 * Tage nach `today` zählen bei Gewohnheiten nicht als "möglich".
 */
export async function weeklyStats(userId: string, weekStart: string, today: string, weeks = 12) {
  const db = await getDb();
  const from = addDays(weekStart, -7 * (weeks - 1));
  const to = addDays(weekStart, 6);
  const [doneTasks, habitRows, logs, txs, evs] = await Promise.all([
    db
      .select({ date: tasks.completedOn })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), between(tasks.completedOn, from, to))),
    db.select({ id: habits.id, createdAt: habits.createdAt }).from(habits).where(eq(habits.userId, userId)),
    db
      .select({ date: habitLogs.date })
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), between(habitLogs.date, from, to))),
    db
      .select({ date: transactions.date, type: transactions.type, amount: transactions.amountCents })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), between(transactions.date, from, to))),
    db
      .select({ date: events.date })
      .from(events)
      .where(and(eq(events.userId, userId), between(events.date, from, to))),
  ]);

  const count = (rows: { date: string | null }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.date) m.set(r.date, (m.get(r.date) ?? 0) + 1);
    return m;
  };
  const taskMap = count(doneTasks);
  const logMap = count(logs);
  const eventMap = count(evs);
  const habitStarts = habitRows.map((h) => h.createdAt.toISOString().slice(0, 10));

  const days: DayStat[] = rangeDays(from, weeks * 7).map((date) => ({
    date,
    tasksDone: taskMap.get(date) ?? 0,
    habitsDone: logMap.get(date) ?? 0,
    habitsPossible: date > today ? 0 : habitStarts.filter((s) => s <= date).length,
    spent: 0,
    earned: 0,
    events: eventMap.get(date) ?? 0,
  }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const t of txs) {
    const day = byDate.get(t.date);
    if (!day) continue;
    if (t.type === "expense") day.spent += t.amount;
    else day.earned += t.amount;
  }
  // Nachträglich angelegte Gewohnheiten können ältere Haken haben – Quote nie über 100 %.
  for (const d of days) d.habitsPossible = Math.max(d.habitsPossible, d.habitsDone);

  const trend: WeekStat[] = Array.from({ length: weeks }, (_, i) => {
    const slice = days.slice(i * 7, i * 7 + 7);
    return { weekStart: slice[0].date, ...sum(slice) };
  });
  return {
    days: days.slice(-7),
    current: trend[trend.length - 1],
    previous: trend[trend.length - 2] ?? null,
    trend,
  };
}
