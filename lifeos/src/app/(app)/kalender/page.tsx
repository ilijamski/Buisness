import { CalendarView } from "@/features/calendar/calendar-view";
import { listEvents } from "@/features/calendar/queries";
import { listTasks } from "@/features/tasks/queries";
import { getClock, requireUser } from "@/lib/auth/session";
import { addDays, isMonthKey, monthOf, startOfWeek } from "@/lib/dates";

export const metadata = { title: "Kalender" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const [{ today }, params] = await Promise.all([getClock(), searchParams]);
  const month = isMonthKey(params.m) ? params.m : monthOf(today);
  const from = startOfWeek(`${month}-01`);
  const to = addDays(from, 41);
  const [events, tasks] = await Promise.all([listEvents(user.id, from, to), listTasks(user.id)]);
  return (
    <CalendarView
      key={month}
      month={month}
      today={today}
      events={events.map(({ id, title, description, location, date, startTime, endTime, color }) => ({
        id, title, description, location, date, startTime, endTime, color,
      }))}
      tasks={tasks
        .filter((t) => t.dueDate && t.dueDate >= from && t.dueDate <= to)
        .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate!, done: t.status === "done" }))}
    />
  );
}
