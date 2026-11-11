import { CalendarView } from "@/features/calendar/calendar-view";
import { listEvents } from "@/features/calendar/queries";
import { listTasks } from "@/features/tasks/queries";
import { getClock, requireUser } from "@/lib/auth/session";
import { addDays, isIsoDate, isMonthKey, monthOf, startOfWeek } from "@/lib/dates";

export const metadata = { title: "Kalender" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const user = await requireUser();
  const [{ today }, params] = await Promise.all([getClock(), searchParams]);
  const day = isIsoDate(params.d) ? params.d : undefined;
  const month = day ? monthOf(day) : isMonthKey(params.m) ? params.m : monthOf(today);
  const from = startOfWeek(`${month}-01`);
  const to = addDays(from, 41);
  const [events, tasks] = await Promise.all([listEvents(user.id, from, to), listTasks(user.id)]);
  return (
    <CalendarView
      key={`${month}:${day ?? ""}`}
      month={month}
      today={today}
      initialDay={day}
      events={events}
      tasks={tasks
        .filter((t) => t.dueDate && t.dueDate >= from && t.dueDate <= to)
        .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate!, done: t.status === "done" }))}
    />
  );
}
