import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { BarChart, LineChart } from "@/components/charts";
import { Card, CardHeader, PageHeader, StatTile } from "@/components/ui/primitives";
import { weeklyStats, type WeekTotals } from "@/features/stats/queries";
import { getClock, requireUser } from "@/lib/auth/session";
import { addDays, formatLong, formatShort, formatWeekday, isIsoDate, isoWeek, startOfWeek } from "@/lib/dates";
import { formatDelta, formatMoney } from "@/lib/format";

export const metadata = { title: "Statistiken" };

/** Formuliert den Wochenbericht aus den Kennzahlen – ohne Wertung, wo es nichts zu werten gibt. */
function report(cur: WeekTotals, prev: WeekTotals | null, bestDay: string | null, isCurrent: boolean): string[] {
  const lines: string[] = [];
  const verb = isCurrent ? "hast du bisher" : "hast du";
  if (cur.tasksDone) {
    const diff = prev ? cur.tasksDone - prev.tasksDone : 0;
    lines.push(
      `In dieser Woche ${verb} ${cur.tasksDone} ${cur.tasksDone === 1 ? "Aufgabe" : "Aufgaben"} erledigt` +
        (prev && diff !== 0 ? ` – ${Math.abs(diff)} ${diff > 0 ? "mehr" : "weniger"} als in der Vorwoche.` : prev ? " – genauso viele wie in der Vorwoche." : "."),
    );
    if (bestDay) lines.push(`Dein produktivster Tag war ${bestDay}.`);
  } else {
    lines.push("In dieser Woche wurde noch keine Aufgabe als erledigt markiert.");
  }
  if (cur.habitsPossible) {
    const rate = Math.round(cur.habitRate * 100);
    const diff = prev?.habitsPossible ? rate - Math.round(prev.habitRate * 100) : 0;
    lines.push(
      `Deine Gewohnheiten hast du zu ${rate} % eingehalten` +
        (diff ? ` (${formatDelta(diff, " Prozentpunkte")} gegenüber der Vorwoche).` : "."),
    );
  }
  if (cur.spent || cur.earned) {
    lines.push(`Ausgegeben: ${formatMoney(cur.spent)}${cur.earned ? `, eingenommen: ${formatMoney(cur.earned)}` : ""}.`);
  }
  return lines;
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const user = await requireUser();
  const [{ today }, params] = await Promise.all([getClock(), searchParams]);
  const thisWeek = startOfWeek(today);
  const requested = isIsoDate(params.w) ? startOfWeek(params.w) : thisWeek;
  const weekStart = requested > thisWeek ? thisWeek : requested;
  const isCurrent = weekStart === thisWeek;
  const { days, current, previous, trend } = await weeklyStats(user.id, weekStart, today);

  const best = days.reduce((a, d) => (d.tasksDone > a.tasksDone ? d : a), days[0]);
  const lines = report(current, previous, best.tasksDone ? formatLong(best.date) : null, isCurrent);
  const todayIndex = days.findIndex((d) => d.date === today);
  const delta = (value: number, suffix = "") => (previous ? `${formatDelta(value, suffix)} zur Vorwoche` : undefined);
  const hasTrend = trend.some((w) => w.tasksDone || w.habitsDone);

  return (
    <>
      <PageHeader title="Statistiken" subtitle="Dein Wochenbericht und die Entwicklung der letzten Wochen.">
        <div className="flex items-center rounded-[10px] border border-line bg-white/[0.03]">
          <Link href={`/statistiken?w=${addDays(weekStart, -7)}`} aria-label="Vorherige Woche" className="flex size-10 items-center justify-center rounded-l-[10px] text-ink-2 hover:bg-white/[0.07]">
            <ChevronLeft size={17} />
          </Link>
          <span className="min-w-44 px-1 text-center text-sm font-medium tabular-nums">
            KW {isoWeek(weekStart)} · {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
          </span>
          {isCurrent ? (
            <span aria-hidden className="flex size-10 items-center justify-center text-muted/40">
              <ChevronRight size={17} />
            </span>
          ) : (
            <Link href={`/statistiken?w=${addDays(weekStart, 7)}`} aria-label="Nächste Woche" className="flex size-10 items-center justify-center rounded-r-[10px] text-ink-2 hover:bg-white/[0.07]">
              <ChevronRight size={17} />
            </Link>
          )}
        </div>
      </PageHeader>

      <div key={weekStart} className="stagger space-y-5">
        <section className="card relative overflow-hidden p-5 md:p-6">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, var(--color-accent-strong), transparent 65%)" }} />
          <h2 className="relative flex items-center gap-2 text-[13px] font-medium text-accent">
            <Sparkles size={15} />
            Wochenbericht{isCurrent ? " · laufende Woche" : ""}
          </h2>
          <div className="relative mt-3 max-w-2xl space-y-1.5 text-[15px] leading-relaxed text-pretty text-ink-2">
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Aufgaben erledigt" value={current.tasksDone} detail={delta(current.tasksDone - (previous?.tasksDone ?? 0))} />
          <StatTile
            label="Gewohnheiten"
            value={current.habitsPossible ? `${Math.round(current.habitRate * 100)} %` : "–"}
            detail={previous?.habitsPossible ? delta(Math.round(current.habitRate * 100) - Math.round(previous.habitRate * 100), " Pp.") : `${current.habitsDone} Haken`}
          />
          <StatTile label="Ausgaben" value={formatMoney(current.spent)} detail={previous ? `${formatMoney(previous.spent)} in der Vorwoche` : undefined} />
          <StatTile label="Termine" value={current.events} detail={delta(current.events - (previous?.events ?? 0))} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Erledigte Aufgaben" hint="pro Tag in dieser Woche" />
            <BarChart
              label="Säulendiagramm: erledigte Aufgaben pro Tag"
              series={[{ name: "Erledigt", color: "var(--color-s1)" }]}
              highlight={todayIndex >= 0 ? todayIndex : undefined}
              data={days.map((d) => ({ label: formatWeekday(d.date), title: formatLong(d.date), values: [d.tasksDone] }))}
            />
          </Card>
          <Card>
            <CardHeader title="Gewohnheiten" hint="Anteil der abgehakten Gewohnheiten pro Tag" />
            <BarChart
              label="Säulendiagramm: Gewohnheitsquote pro Tag"
              format="percent"
              series={[{ name: "Quote", color: "var(--color-s3)" }]}
              highlight={todayIndex >= 0 ? todayIndex : undefined}
              data={days.map((d) => ({
                label: formatWeekday(d.date),
                title: formatLong(d.date),
                values: [d.habitsPossible ? (d.habitsDone / d.habitsPossible) * 100 : 0],
              }))}
            />
          </Card>
        </div>

        {hasTrend ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Trend: Aufgaben" hint="Erledigte Aufgaben pro Woche, letzte 12 Wochen" />
              <LineChart
                label="Liniendiagramm: erledigte Aufgaben pro Woche"
                series={[{ name: "Erledigt", color: "var(--color-s1)" }]}
                data={trend.map((w) => ({ label: `KW ${isoWeek(w.weekStart)}`, title: `KW ${isoWeek(w.weekStart)} · ab ${formatShort(w.weekStart)}`, values: [w.tasksDone] }))}
              />
            </Card>
            <Card>
              <CardHeader title="Trend: Gewohnheiten" hint="Eingehaltene Gewohnheiten pro Woche in Prozent" />
              <LineChart
                label="Liniendiagramm: Gewohnheitsquote pro Woche"
                format="percent"
                series={[{ name: "Quote", color: "var(--color-s3)" }]}
                data={trend.map((w) => ({ label: `KW ${isoWeek(w.weekStart)}`, title: `KW ${isoWeek(w.weekStart)} · ab ${formatShort(w.weekStart)}`, values: [w.habitRate * 100] }))}
              />
            </Card>
          </div>
        ) : null}

        <details className="card group p-5">
          <summary className="flex list-none items-center justify-between text-[15px] font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
            Wochenwerte als Tabelle
            <ChevronRight size={17} className="text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm tabular-nums">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Tag</th>
                  <th className="py-2 pr-4 text-right font-medium">Aufgaben</th>
                  <th className="py-2 pr-4 text-right font-medium">Gewohnheiten</th>
                  <th className="py-2 pr-4 text-right font-medium">Ausgaben</th>
                  <th className="py-2 text-right font-medium">Termine</th>
                </tr>
              </thead>
              <tbody className="text-ink-2">
                {days.map((d) => (
                  <tr key={d.date} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 capitalize">{formatLong(d.date)}</td>
                    <td className="py-2 pr-4 text-right">{d.tasksDone}</td>
                    <td className="py-2 pr-4 text-right">{d.date > today ? "–" : `${d.habitsDone}/${d.habitsPossible}`}</td>
                    <td className="py-2 pr-4 text-right">{formatMoney(d.spent)}</td>
                    <td className="py-2 text-right">{d.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </>
  );
}
