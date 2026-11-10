import { HabitsView } from "@/features/habits/habits-view";
import { HABIT_HISTORY_DAYS, listHabits } from "@/features/habits/queries";
import { getClock, requireUser } from "@/lib/auth/session";

export const metadata = { title: "Gewohnheiten" };

export default async function HabitsPage() {
  const user = await requireUser();
  const { today } = await getClock();
  const habits = await listHabits(user.id, today);
  return <HabitsView habits={habits} today={today} historyDays={HABIT_HISTORY_DAYS} />;
}
