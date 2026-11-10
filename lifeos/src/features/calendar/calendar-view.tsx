"use client";

import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Clock, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";
import { FormModal } from "@/components/ui/modal";
import { Button, Dot, EmptyState, Field, PageHeader } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/toast";
import type { CalendarEvent } from "@/db/schema";
import { slotVar } from "@/lib/constants";
import { addDays, addMonths, formatLong, formatMonth, monthOf, rangeDays, startOfWeek } from "@/lib/dates";
import { cn } from "@/lib/format";
import { deleteEvent, saveEvent } from "./actions";

type EventData = Pick<CalendarEvent, "id" | "title" | "description" | "location" | "date" | "startTime" | "endTime" | "color">;
type DueTask = { id: string; title: string; dueDate: string; done: boolean };
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const timeLabel = (e: EventData) => (e.startTime ? (e.endTime ? `${e.startTime} – ${e.endTime}` : e.startTime) : "Ganztägig");

function EventDialog({ open, onClose, event, date }: { open: boolean; onClose: () => void; event?: EventData | null; date: string }) {
  const { run, pending } = useAction();
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={event ? "Termin bearbeiten" : "Neuer Termin"}
      pending={pending}
      submitLabel={event ? "Speichern" : "Anlegen"}
      onDelete={event ? () => run(() => deleteEvent({ id: event.id }), { success: "Termin gelöscht", onSuccess: onClose }) : undefined}
      onSubmit={(data) =>
        run(
          () =>
            saveEvent({
              id: event?.id,
              title: String(data.get("title")),
              description: String(data.get("description")),
              location: String(data.get("location")),
              date: String(data.get("date")),
              startTime: String(data.get("startTime")),
              endTime: String(data.get("endTime")),
              color: Number(data.get("color")),
            }),
          { success: event ? "Termin gespeichert" : "Termin angelegt", onSuccess: onClose },
        )
      }
    >
      <Field label="Titel">
        <input name="title" className="field" required maxLength={200} autoFocus={!event} defaultValue={event?.title} placeholder="z. B. Abendessen mit Lena" />
      </Field>
      <Field label="Datum">
        <input name="date" type="date" className="field" required defaultValue={event?.date ?? date} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Beginn" hint="Leer lassen für ganztägig.">
          <input name="startTime" type="time" className="field" defaultValue={event?.startTime ?? ""} />
        </Field>
        <Field label="Ende">
          <input name="endTime" type="time" className="field" defaultValue={event?.endTime ?? ""} />
        </Field>
      </div>
      <Field label="Ort">
        <input name="location" className="field" maxLength={200} defaultValue={event?.location} placeholder="Optional" />
      </Field>
      <Field label="Beschreibung">
        <textarea name="description" className="field" rows={2} maxLength={5000} defaultValue={event?.description} placeholder="Optional" />
      </Field>
      <div>
        <span className="mb-2 block text-[13px] font-medium text-ink-2">Farbe</span>
        <ColorPicker name="color" defaultValue={event?.color ?? 1} />
      </div>
    </FormModal>
  );
}

export function CalendarView({ month, today, events, tasks }: { month: string; today: string; events: EventData[]; tasks: DueTask[] }) {
  const [selected, setSelected] = useState(monthOf(today) === month ? today : `${month}-01`);
  const [dialog, setDialog] = useState<{ event: EventData | null } | null>(null);

  const gridStart = startOfWeek(`${month}-01`);
  const days = rangeDays(gridStart, 42);
  // Die sechste Zeile nur zeigen, wenn sie noch Tage des Monats enthält.
  const visible = monthOf(days[35]) === month ? days : days.slice(0, 35);
  const eventsOn = (d: string) => events.filter((e) => e.date === d);
  const tasksOn = (d: string) => tasks.filter((t) => t.dueDate === d);
  const dayEvents = eventsOn(selected);
  const dayTasks = tasksOn(selected);

  return (
    <>
      <PageHeader title="Kalender" subtitle="Termine und fällige Aufgaben im Monatsüberblick.">
        <Button variant="primary" onClick={() => setDialog({ event: null })}>
          <Plus size={16} />
          Neuer Termin
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <h2 className="text-base font-semibold tracking-tight capitalize">{formatMonth(month)}</h2>
            <div className="flex items-center gap-1">
              {monthOf(today) !== month ? (
                <Link href="/kalender" className="mr-1 flex h-8 items-center rounded-lg border border-line px-2.5 text-[13px] text-ink-2 hover:bg-white/[0.06]">
                  Heute
                </Link>
              ) : null}
              <Link href={`/kalender?m=${addMonths(month, -1)}`} aria-label="Vorheriger Monat" className="flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-white/[0.07]">
                <ChevronLeft size={18} />
              </Link>
              <Link href={`/kalender?m=${addMonths(month, 1)}`} aria-label="Nächster Monat" className="flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-white/[0.07]">
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-medium tracking-wide text-muted uppercase">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>
          <div key={month} className="grid animate-fade grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
            {visible.map((d) => {
              const inMonth = monthOf(d) === month;
              const evs = eventsOn(d);
              const tks = tasksOn(d).filter((t) => !t.done);
              const isSelected = d === selected;
              const shownEvents = Math.min(2, evs.length);
              const hiddenCount = evs.length + tks.length - Math.min(2, evs.length + tks.length);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelected(d)}
                  onDoubleClick={() => setDialog({ event: null })}
                  aria-label={`${formatLong(d)}, ${evs.length} Termine, ${tks.length} offene Aufgaben`}
                  aria-pressed={isSelected}
                  className={cn(
                    "relative flex min-h-14 flex-col items-stretch gap-1 bg-surface p-1 text-left transition-colors hover:bg-hover md:min-h-[104px] md:p-1.5",
                    isSelected && "bg-raised ring-1 ring-accent/70 ring-inset",
                  )}
                >
                  <span
                    className={cn(
                      "mx-auto flex size-6 items-center justify-center rounded-full text-xs tabular-nums md:mx-0",
                      d === today ? "bg-accent-strong font-semibold text-white" : inMonth ? "text-ink-2" : "text-muted/50",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {/* Desktop: Einträge als Zeilen */}
                  <span className={cn("hidden flex-col gap-0.5 md:flex", !inMonth && "opacity-50")}>
                    {evs.slice(0, 2).map((e) => (
                      <span key={e.id} className="flex items-center gap-1.5 truncate rounded px-1 text-[11px] leading-[18px] text-ink-2" style={{ background: `color-mix(in srgb, ${slotVar(e.color)} 16%, transparent)` }}>
                        <Dot color={slotVar(e.color)} className="!size-1.5" />
                        <span className="truncate">{e.title}</span>
                      </span>
                    ))}
                    {tks.slice(0, 2 - shownEvents).map((t) => (
                      <span key={t.id} className="flex items-center gap-1 truncate px-1 text-[11px] leading-[18px] text-muted">
                        <CircleCheck size={10} className="shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </span>
                    ))}
                    {hiddenCount > 0 ? <span className="px-1 text-[11px] text-muted">+{hiddenCount} mehr</span> : null}
                  </span>
                  {/* Smartphone: Punkte */}
                  <span className="flex justify-center gap-0.5 md:hidden">
                    {evs.slice(0, 3).map((e) => (
                      <Dot key={e.id} color={slotVar(e.color)} className="!size-1" />
                    ))}
                    {tks.length ? <span className="size-1 rounded-full bg-white/40" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card flex flex-col p-4" aria-live="polite">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight capitalize">{formatLong(selected)}</h2>
              <p className="text-[13px] text-muted">{selected === today ? "Heute" : selected === addDays(today, 1) ? "Morgen" : "Ausgewählter Tag"}</p>
            </div>
            <Button size="sm" onClick={() => setDialog({ event: null })}>
              <Plus size={14} />
              Termin
            </Button>
          </div>
          {dayEvents.length || dayTasks.length ? (
            <ul key={selected} className="stagger space-y-2">
              {dayEvents.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setDialog({ event: e })}
                    className="flex w-full gap-3 rounded-xl border border-line bg-white/[0.02] p-3 text-left transition-colors hover:border-line-strong hover:bg-white/[0.05]"
                  >
                    <span className="w-1 shrink-0 rounded-full" style={{ background: slotVar(e.color) }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{e.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {timeLabel(e)}
                        </span>
                        {e.location ? (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin size={12} className="shrink-0" />
                            <span className="truncate">{e.location}</span>
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {dayTasks.map((t) => (
                <li key={t.id}>
                  <Link href="/aufgaben" className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3 text-sm transition-colors hover:border-line-strong">
                    <CircleCheck size={16} className={t.done ? "text-good" : "text-muted"} />
                    <span className={cn("min-w-0 flex-1 truncate", t.done ? "text-muted line-through" : "text-ink-2")}>{t.title}</span>
                    <span className="text-xs text-muted">Aufgabe</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="!py-8" icon={<CalendarDays size={20} />} title="Nichts geplant" text="An diesem Tag gibt es weder Termine noch fällige Aufgaben." />
          )}
        </section>
      </div>

      <EventDialog open={dialog !== null} onClose={() => setDialog(null)} event={dialog?.event} date={selected} />
    </>
  );
}
