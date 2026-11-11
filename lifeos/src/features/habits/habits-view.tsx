"use client";

import { Check, Flame, Pencil, Plus, Repeat } from "lucide-react";
import { useOptimistic, useState } from "react";
import { Heatmap } from "@/components/charts";
import { ColorPicker } from "@/components/ui/color-picker";
import { FormModal } from "@/components/ui/modal";
import { Button, Card, CardHeader, EmptyState, Field, IconButton, PageHeader, StatTile } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/toast";
import { slotVar } from "@/lib/constants";
import { addDays, formatLong, formatWeekday, rangeDays, startOfWeek } from "@/lib/dates";
import { cn } from "@/lib/format";
import { deleteHabit, saveHabit, setHabitDone } from "./actions";
import type { HabitView } from "./queries";

function HabitDialog({ open, onClose, habit }: { open: boolean; onClose: () => void; habit?: HabitView | null }) {
  const { run, pending } = useAction();
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={habit ? "Gewohnheit bearbeiten" : "Neue Gewohnheit"}
      pending={pending}
      submitLabel={habit ? "Speichern" : "Anlegen"}
      onDelete={habit ? () => run(() => deleteHabit({ id: habit.id }), { success: "Gewohnheit gelöscht", onSuccess: onClose }) : undefined}
      onSubmit={(data) =>
        run(
          () =>
            saveHabit({
              id: habit?.id,
              name: String(data.get("name")),
              color: Number(data.get("color")),
              targetPerWeek: Number(data.get("targetPerWeek")),
            }),
          { success: habit ? "Gewohnheit gespeichert" : "Gewohnheit angelegt", onSuccess: onClose },
        )
      }
    >
      <Field label="Name">
        <input name="name" className="field" required maxLength={200} autoFocus={!habit} defaultValue={habit?.name} placeholder="z. B. 10 Minuten meditieren" />
      </Field>
      <Field label="Wie oft pro Woche?">
        <select name="targetPerWeek" className="field" defaultValue={habit?.targetPerWeek ?? 7}>
          {[7, 6, 5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n === 7 ? "Täglich" : `${n} × pro Woche`}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <span className="mb-2 block text-[13px] font-medium text-ink-2">Farbe</span>
        <ColorPicker name="color" defaultValue={habit?.color ?? 1} />
      </div>
    </FormModal>
  );
}

/** Abhak-Knopf für einen Tag; reagiert sofort und gleicht sich danach mit dem Server ab. */
export function HabitCheck({ habit, date, done, label, size = "md", onToggle }: { habit: Pick<HabitView, "id" | "color">; date: string; done: boolean; label: string; size?: "md" | "lg"; onToggle: (date: string, done: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      title={label}
      onClick={() => onToggle(date, !done)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-200 active:scale-90",
        size === "lg" ? "size-9" : "size-8",
        done ? "border-transparent" : "border-white/15 hover:border-white/40",
      )}
      style={done ? { background: slotVar(habit.color) } : undefined}
    >
      {done ? <Check size={size === "lg" ? 17 : 15} strokeWidth={3} className="animate-pop text-white" /> : null}
    </button>
  );
}

/** Kapselt den optimistischen Zustand der Haken einer Gewohnheit. */
export function useHabitToggle(habit: HabitView) {
  const { run } = useAction();
  const [dates, apply] = useOptimistic(habit.dates, (state, change: { date: string; done: boolean }) =>
    change.done ? [...state, change.date] : state.filter((d) => d !== change.date),
  );
  const toggle = (date: string, done: boolean) =>
    run(() => setHabitDone({ habitId: habit.id, date, done }), { optimistic: () => apply({ date, done }) });
  return { dates, toggle };
}

function HabitRow({ habit, days, today, onEdit }: { habit: HabitView; days: string[]; today: string; onEdit: () => void }) {
  const { dates, toggle } = useHabitToggle(habit);
  const weekStart = startOfWeek(today);
  const weekCount = dates.filter((d) => d >= weekStart && d <= today).length;
  const reached = weekCount >= habit.targetPerWeek;

  return (
    <li className="flex flex-col gap-3 px-3 py-3 transition-colors md:flex-row md:items-center md:gap-4 md:rounded-xl md:hover:bg-white/[0.03]">
      <div className="flex min-w-0 items-center gap-3 md:contents">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: slotVar(habit.color) }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{habit.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-muted">
              <span className={cn("tabular-nums", reached && "text-ink-2")}>
                Diese Woche {weekCount}/{habit.targetPerWeek}
                {reached ? " ✓" : ""}
              </span>
              <span className="flex items-center gap-1 tabular-nums" title={`Längste Serie: ${habit.bestStreak} Tage`}>
                <Flame size={12} className={habit.streak >= 3 ? "text-serious" : undefined} />
                {habit.streak} {habit.streak === 1 ? "Tag" : "Tage"} in Folge
              </span>
            </p>
          </div>
        </div>
        <IconButton label={`„${habit.name}“ bearbeiten`} onClick={onEdit} className="md:order-last">
          <Pencil size={15} />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 md:flex md:gap-2">
        {days.map((d) => (
          <div key={d} className="flex flex-col items-center gap-1 md:w-9">
            <span className={cn("text-[10px] font-medium uppercase md:hidden", d === today ? "text-ink" : "text-muted")}>{formatWeekday(d)}</span>
            <HabitCheck
              habit={habit}
              date={d}
              done={dates.includes(d)}
              onToggle={toggle}
              label={`${habit.name}, ${formatLong(d)}: ${dates.includes(d) ? "erledigt" : "offen"}`}
            />
          </div>
        ))}
      </div>
    </li>
  );
}

export function HabitsView({ habits, today, historyDays }: { habits: HabitView[]; today: string; historyDays: number }) {
  const [dialog, setDialog] = useState<{ habit: HabitView | null } | null>(null);
  const days = rangeDays(addDays(today, -6), 7);
  const doneToday = habits.filter((h) => h.doneToday).length;
  const weekDone = habits.reduce((a, h) => a + Math.min(h.weekCount, h.targetPerWeek), 0);
  const weekTarget = habits.reduce((a, h) => a + h.targetPerWeek, 0);
  const bestStreak = Math.max(0, ...habits.map((h) => h.streak));

  // Heatmap: volle Wochen (Mo–So) bis einschließlich der laufenden Woche.
  const weeks = Math.floor(historyDays / 7);
  const heatStart = addDays(startOfWeek(today), -7 * (weeks - 1));
  const counts = new Map<string, number>();
  for (const h of habits) for (const d of h.dates) counts.set(d, (counts.get(d) ?? 0) + 1);
  const cells = rangeDays(heatStart, weeks * 7).map((date) => ({
    date,
    title: formatLong(date),
    value: counts.get(date) ?? 0,
    future: date > today,
  }));

  return (
    <>
      <PageHeader title="Gewohnheiten" subtitle="Kleine Schritte, jeden Tag – die Serie macht den Unterschied.">
        <Button variant="primary" onClick={() => setDialog({ habit: null })}>
          <Plus size={16} />
          Neue Gewohnheit
        </Button>
      </PageHeader>

      {habits.length ? (
        <div className="stagger space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Heute" value={`${doneToday}/${habits.length}`} detail="erledigt" />
            <StatTile label="Wochenziel" value={`${weekTarget ? Math.round((weekDone / weekTarget) * 100) : 0} %`} detail={`${weekDone} von ${weekTarget}`} />
            <StatTile label="Beste Serie" value={bestStreak} detail={bestStreak === 1 ? "Tag in Folge" : "Tage in Folge"} />
          </div>

          <section className="card p-2">
            <div className="hidden items-center gap-4 px-3 pt-2 pb-1 md:flex">
              <span className="flex-1 text-[13px] font-medium text-muted">Letzte 7 Tage</span>
              <div className="flex gap-2">
                {days.map((d) => (
                  <span key={d} className={cn("w-9 text-center text-[11px] leading-tight font-medium uppercase", d === today ? "text-ink" : "text-muted")}>
                    {formatWeekday(d)}
                    <span className="block tabular-nums">{Number(d.slice(8))}</span>
                  </span>
                ))}
              </div>
              <span className="w-9" />
            </div>
            <ul className="divide-y divide-line md:divide-y-0">
              {habits.map((habit) => (
                <HabitRow key={habit.id} habit={habit} days={days} today={today} onEdit={() => setDialog({ habit })} />
              ))}
            </ul>
          </section>

          <Card>
            <CardHeader title="Verlauf" hint={`Erledigte Gewohnheiten pro Tag in den letzten ${weeks} Wochen`} />
            <Heatmap cells={cells} max={habits.length} unit={`von ${habits.length} erledigt`} label="Heatmap der erledigten Gewohnheiten pro Tag" />
          </Card>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Repeat size={22} />}
            title="Noch keine Gewohnheiten"
            text="Starte mit einer einzigen Gewohnheit, die du täglich abhaken möchtest."
            action={
              <Button variant="primary" onClick={() => setDialog({ habit: null })}>
                <Plus size={16} />
                Erste Gewohnheit anlegen
              </Button>
            }
          />
        </div>
      )}
      <HabitDialog open={dialog !== null} onClose={() => setDialog(null)} habit={dialog?.habit} />
    </>
  );
}
