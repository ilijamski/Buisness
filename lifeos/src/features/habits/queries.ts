import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { addDays, startOfWeek } from "@/lib/dates";

const { habits, habitLogs } = schema;

export type HabitView = {
  id: string;
  name: string;
  color: number;
  targetPerWeek: number;
  /** ISO-Daten, an denen die Gewohnheit erledigt wurde */
  dates: string[];
  streak: number;
  bestStreak: number;
  weekCount: number;
  doneToday: boolean;
};

export const HABIT_HISTORY_DAYS = 7 * 18;

function streaks(dates: Set<string>, today: string) {
  // Die laufende Serie zählt auch dann weiter, wenn heute noch offen ist.
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...dates].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { streak, best: Math.max(best, streak) };
}

export async function listHabits(userId: string, today: string): Promise<HabitView[]> {
  const db = await getDb();
  const since = addDays(today, -HABIT_HISTORY_DAYS);
  const [rows, logs] = await Promise.all([
    db.select().from(habits).where(eq(habits.userId, userId)).orderBy(asc(habits.createdAt)),
    db
      .select({ habitId: habitLogs.habitId, date: habitLogs.date })
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), gte(habitLogs.date, since))),
  ]);
  const byHabit = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!byHabit.has(log.habitId)) byHabit.set(log.habitId, new Set());
    byHabit.get(log.habitId)!.add(log.date);
  }
  const weekStart = startOfWeek(today);
  return rows.map((h) => {
    const dates = byHabit.get(h.id) ?? new Set<string>();
    const { streak, best } = streaks(dates, today);
    return {
      id: h.id,
      name: h.name,
      color: h.color,
      targetPerWeek: h.targetPerWeek,
      dates: [...dates].sort(),
      streak,
      bestStreak: best,
      weekCount: [...dates].filter((d) => d >= weekStart && d <= today).length,
      doneToday: dates.has(today),
    };
  });
}
