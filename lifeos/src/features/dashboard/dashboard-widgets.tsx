"use client";

import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, EmptyState } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/toast";
import { loadDemoData } from "@/features/account/actions";
import { HabitCheck, useHabitToggle } from "@/features/habits/habits-view";
import type { HabitView } from "@/features/habits/queries";
import type { TaskRow } from "@/features/tasks/queries";
import { TaskDialog, TaskItem, type ProjectOption } from "@/features/tasks/task-ui";
import { cn } from "@/lib/format";

export function NewTaskButton({ projects, today }: { projects: ProjectOption[]; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Aufgabe
      </Button>
      <TaskDialog open={open} onClose={() => setOpen(false)} projects={projects} defaults={{ dueDate: today }} />
    </>
  );
}

export function FocusTasks({ tasks, projects, today }: { tasks: TaskRow[]; projects: ProjectOption[]; today: string }) {
  const [dialog, setDialog] = useState<{ task: TaskRow } | null>(null);
  return (
    <>
      <div className="-mx-2">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} today={today} onOpen={(t) => setDialog({ task: t })} />
        ))}
      </div>
      <TaskDialog open={dialog !== null} onClose={() => setDialog(null)} task={dialog?.task} projects={projects} />
    </>
  );
}

function HabitToday({ habit, today }: { habit: HabitView; today: string }) {
  const { dates, toggle } = useHabitToggle(habit);
  const done = dates.includes(today);
  return (
    <li className="flex items-center gap-3 py-1.5">
      <HabitCheck habit={habit} date={today} done={done} onToggle={toggle} label={`${habit.name}: ${done ? "erledigt" : "offen"}`} />
      <span className={cn("min-w-0 flex-1 truncate text-sm transition-colors", done ? "text-muted" : "text-ink")}>{habit.name}</span>
      <span className="text-xs text-muted tabular-nums">
        {habit.streak} {habit.streak === 1 ? "Tag" : "Tage"}
      </span>
    </li>
  );
}

export function HabitsToday({ habits, today }: { habits: HabitView[]; today: string }) {
  return (
    <ul>
      {habits.map((h) => (
        <HabitToday key={h.id} habit={h} today={today} />
      ))}
    </ul>
  );
}

/** Begrüßung für ein leeres Konto: selbst loslegen oder mit Beispieldaten umsehen. */
export function Onboarding({ projects, today }: { projects: ProjectOption[]; today: string }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <div className="card relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, var(--color-accent-strong), transparent 65%)" }} />
      <EmptyState
        className="relative !py-16"
        icon={<Sparkles size={22} />}
        title="Willkommen bei LifeOS"
        text="Dein Dashboard füllt sich, sobald du Aufgaben, Termine oder Gewohnheiten anlegst. Zum Umsehen kannst du Beispieldaten laden – sie lassen sich in den Einstellungen wieder entfernen."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus size={16} />
              Erste Aufgabe anlegen
            </Button>
            <Button disabled={pending} onClick={() => run(() => loadDemoData({}), { success: "Beispieldaten geladen" })}>
              {pending ? "Lädt …" : "Beispieldaten laden"}
            </Button>
          </div>
        }
      />
      <TaskDialog open={open} onClose={() => setOpen(false)} projects={projects} defaults={{ dueDate: today }} />
    </div>
  );
}

export function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="shrink-0 text-[13px] text-muted transition-colors hover:text-ink">
      {children}
    </Link>
  );
}
