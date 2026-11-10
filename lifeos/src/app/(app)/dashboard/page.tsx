import { CalendarDays, CircleCheck, Clock, Repeat, Target, Wallet } from "lucide-react";
import Link from "next/link";
import { BarChart } from "@/components/charts";
import { Card, CardHeader, PageHeader, ProgressBar, StatTile } from "@/components/ui/primitives";
import { listEvents } from "@/features/calendar/queries";
import { FocusTasks, HabitsToday, MoreLink, NewTaskButton, Onboarding } from "@/features/dashboard/dashboard-widgets";
import { monthlyTotals } from "@/features/finance/queries";
import { listGoals } from "@/features/goals/queries";
import { listHabits } from "@/features/habits/queries";
import { listProjects } from "@/features/projects/queries";
import { weeklyStats } from "@/features/stats/queries";
import { listTasks } from "@/features/tasks/queries";
import { getClock, requireUser } from "@/lib/auth/session";
import { PRIORITY_RANK, slotVar } from "@/lib/constants";
import { addDays, formatLong, formatRelative, formatWeekday, hourIn, monthOf, startOfWeek } from "@/lib/dates";
import { clamp01, formatMoney } from "@/lib/format";

export const metadata = { title: "Dashboard" };

const greeting = (hour: number) => (hour < 5 ? "Gute Nacht" : hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend");

export default async function DashboardPage() {
  const user = await requireUser();
  const { today, tz } = await getClock();
  const [tasks, projects, events, habits, goals, stats, [month]] = await Promise.all([
    listTasks(user.id),
    listProjects(user.id),
    listEvents(user.id, today, addDays(today, 14)),
    listHabits(user.id, today),
    listGoals(user.id),
    weeklyStats(user.id, startOfWeek(today), today, 2),
    monthlyTotals(user.id, monthOf(today), 1),
  ]);
  const projectOptions = projects.map(({ id, name, color }) => ({ id, name, color }));
  const firstName = user.name.trim().split(/\s+/)[0];
  const header = (
    <PageHeader title={`${greeting(hourIn(tz))}, ${firstName}`} subtitle={<span className="capitalize">{formatLong(today)}</span>}>
      <NewTaskButton projects={projectOptions} today={today} />
    </PageHeader>
  );

  const isEmpty = !tasks.length && !events.length && !habits.length && !goals.length && !projects.length && !month.income && !month.expense;
  if (isEmpty) {
    return (
      <>
        {header}
        <Onboarding projects={projectOptions} today={today} />
      </>
    );
  }

  const open = tasks.filter((t) => t.status !== "done");
  const dueNow = open.filter((t) => t.dueDate && t.dueDate <= today);
  const overdue = dueNow.filter((t) => t.dueDate! < today).length;
  const byUrgency = (a: (typeof open)[number], b: (typeof open)[number]) =>
    (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  // Im Fokus: erst alles Fällige, dann die wichtigsten übrigen Aufgaben.
  const focus = [...dueNow.sort(byUrgency), ...open.filter((t) => !dueNow.includes(t)).sort(byUrgency)].slice(0, 6);
  const doneToday = tasks.filter((t) => t.completedOn === today).length;

  const habitsDone = habits.filter((h) => h.doneToday).length;
  const activeGoals = goals.filter((g) => !g.completedOn);
  const goalAvg = activeGoals.length ? activeGoals.reduce((a, g) => a + clamp01(g.current / g.target), 0) / activeGoals.length : 0;
  const balance = month.income - month.expense;
  const upcoming = events.slice(0, 5);
  const todayIndex = stats.days.findIndex((d) => d.date === today);

  return (
    <>
      {header}
      <div className="stagger space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Heute fällig"
            value={dueNow.length}
            icon={<CircleCheck size={16} />}
            detail={overdue ? `davon ${overdue} überfällig` : doneToday ? `${doneToday} heute erledigt` : `${open.length} offen insgesamt`}
          />
          <StatTile
            label="Gewohnheiten"
            value={habits.length ? `${habitsDone}/${habits.length}` : "–"}
            icon={<Repeat size={16} />}
            detail={habits.length ? (habitsDone === habits.length ? "Alle für heute erledigt" : "heute abgehakt") : "Noch keine angelegt"}
          />
          <StatTile label="Saldo im Monat" value={formatMoney(balance)} icon={<Wallet size={16} />} detail={`${formatMoney(month.expense)} ausgegeben`} />
          <StatTile
            label="Zielfortschritt"
            value={activeGoals.length ? `${Math.round(goalAvg * 100)} %` : "–"}
            icon={<Target size={16} />}
            detail={activeGoals.length ? `Ø über ${activeGoals.length} ${activeGoals.length === 1 ? "Ziel" : "Ziele"}` : "Kein aktives Ziel"}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card>
              <CardHeader title="Im Fokus" hint="Fälliges zuerst, dann nach Priorität" action={<MoreLink href="/aufgaben">Alle Aufgaben</MoreLink>} />
              {focus.length ? (
                <FocusTasks tasks={focus} projects={projectOptions} today={today} />
              ) : (
                <p className="py-8 text-center text-sm text-muted">Keine offenen Aufgaben – alles erledigt.</p>
              )}
            </Card>
            <Card>
              <CardHeader
                title="Diese Woche"
                hint={`${stats.current.tasksDone} ${stats.current.tasksDone === 1 ? "Aufgabe" : "Aufgaben"} erledigt`}
                action={<MoreLink href="/statistiken">Wochenbericht</MoreLink>}
              />
              <BarChart
                label="Säulendiagramm: erledigte Aufgaben pro Tag in dieser Woche"
                height={180}
                series={[{ name: "Erledigt", color: "var(--color-s1)" }]}
                highlight={todayIndex >= 0 ? todayIndex : undefined}
                data={stats.days.map((d) => ({ label: formatWeekday(d.date), title: formatLong(d.date), values: [d.tasksDone] }))}
              />
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Nächste Termine" action={<MoreLink href="/kalender">Kalender</MoreLink>} />
              {upcoming.length ? (
                <ul className="space-y-1">
                  {upcoming.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-1.5">
                      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: slotVar(e.color) }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{e.title}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          {e.startTime ? <Clock size={11} /> : <CalendarDays size={11} />}
                          {formatRelative(e.date, today)}
                          {e.startTime ? ` · ${e.startTime}` : " · ganztägig"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted">In den nächsten zwei Wochen ist nichts geplant.</p>
              )}
            </Card>

            <Card>
              <CardHeader title="Gewohnheiten heute" action={<MoreLink href="/gewohnheiten">Alle</MoreLink>} />
              {habits.length ? (
                <HabitsToday habits={habits} today={today} />
              ) : (
                <p className="py-6 text-center text-sm text-muted">
                  <Link href="/gewohnheiten" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
                    Lege deine erste Gewohnheit an
                  </Link>
                </p>
              )}
            </Card>

            <Card>
              <CardHeader title="Ziele" action={<MoreLink href="/ziele">Alle</MoreLink>} />
              {activeGoals.length ? (
                <ul className="space-y-4">
                  {activeGoals.slice(0, 4).map((g) => {
                    const ratio = clamp01(g.current / g.target);
                    return (
                      <li key={g.id}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate text-ink">{g.title}</span>
                          <span className="shrink-0 text-[13px] text-muted tabular-nums">{Math.round(ratio * 100)} %</span>
                        </div>
                        <ProgressBar value={ratio} label={`Fortschritt ${g.title}`} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted">
                  <Link href="/ziele" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
                    Setze dir ein erstes Ziel
                  </Link>
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
