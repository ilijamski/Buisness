"use client";

import { CalendarDays, Check, CircleAlert, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import { useOptimistic } from "react";
import { FormModal } from "@/components/ui/modal";
import { Badge, Dot, Field, type BadgeTone } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/toast";
import { PRIORITIES, PRIORITY_LABEL, slotVar, TASK_STATUSES, TASK_STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/constants";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/format";
import { deleteTask, saveTask, setTaskStatus } from "./actions";
import type { TaskRow } from "./queries";

export type ProjectOption = { id: string; name: string; color: number };

const PRIORITY_STYLE: Record<Priority, { icon: typeof SignalLow; tone: BadgeTone }> = {
  urgent: { icon: CircleAlert, tone: "critical" },
  high: { icon: SignalHigh, tone: "serious" },
  medium: { icon: SignalMedium, tone: "neutral" },
  low: { icon: SignalLow, tone: "muted" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const p = (PRIORITIES as readonly string[]).includes(priority) ? (priority as Priority) : "medium";
  const { icon: Icon, tone } = PRIORITY_STYLE[p];
  return (
    <Badge tone={tone}>
      <Icon size={12} />
      {PRIORITY_LABEL[p]}
    </Badge>
  );
}

export function DueBadge({ date, today, done }: { date: string; today: string; done?: boolean }) {
  const overdue = !done && date < today;
  return (
    <Badge tone={overdue ? "critical" : date === today && !done ? "strong" : "neutral"}>
      {overdue ? <CircleAlert size={12} /> : <CalendarDays size={12} />}
      {overdue ? `Überfällig · ${formatRelative(date, today)}` : formatRelative(date, today)}
    </Badge>
  );
}

export function Checkbox({ checked, onChange, label, color }: { checked: boolean; onChange: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "relative flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-200 before:absolute before:-inset-2.5 active:scale-90",
        checked ? "border-transparent" : "border-white/25 hover:border-white/50",
      )}
      style={checked ? { background: color ?? "var(--color-accent-strong)" } : undefined}
    >
      {checked ? <Check size={13} strokeWidth={3} className="animate-pop text-white" /> : null}
    </button>
  );
}

/** Eine Aufgabenzeile mit sofort reagierendem Haken. */
export function TaskItem({
  task,
  today,
  onOpen,
  showProject = true,
}: {
  task: TaskRow;
  today: string;
  onOpen?: (task: TaskRow) => void;
  showProject?: boolean;
}) {
  const { run } = useAction();
  const [status, setStatus] = useOptimistic(task.status);
  const done = status === "done";
  const toggle = () => {
    const next = done ? "todo" : "done";
    run(() => setTaskStatus({ id: task.id, status: next }), { optimistic: () => setStatus(next) });
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
        onOpen && "cursor-pointer hover:bg-white/[0.04]",
      )}
      onClick={() => onOpen?.(task)}
      onKeyDown={(e) => {
        if (onOpen && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(task);
        }
      }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <span className="pt-px">
        <Checkbox checked={done} onChange={toggle} label={done ? `„${task.title}“ wieder öffnen` : `„${task.title}“ erledigen`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-[22px] break-words transition-colors", done ? "text-muted line-through decoration-white/20" : "text-ink")}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
          {!done && task.priority !== "medium" ? <PriorityBadge priority={task.priority} /> : null}
          {status === "in_progress" ? <Badge tone="strong">In Arbeit</Badge> : null}
          {task.dueDate ? <DueBadge date={task.dueDate} today={today} done={done} /> : null}
          {showProject && task.projectName ? (
            <Badge>
              <Dot color={slotVar(task.projectColor ?? 0)} />
              <span className="max-w-32 truncate">{task.projectName}</span>
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Dialog zum Anlegen und Bearbeiten einer Aufgabe. */
export function TaskDialog({
  open,
  onClose,
  task,
  projects,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  task?: TaskRow | null;
  projects: ProjectOption[];
  defaults?: { projectId?: string; status?: TaskStatus; dueDate?: string };
}) {
  const { run, pending } = useAction();
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={task ? "Aufgabe bearbeiten" : "Neue Aufgabe"}
      pending={pending}
      submitLabel={task ? "Speichern" : "Anlegen"}
      onDelete={task ? () => run(() => deleteTask({ id: task.id }), { success: "Aufgabe gelöscht", onSuccess: onClose }) : undefined}
      onSubmit={(data) =>
        run(
          () =>
            saveTask({
              id: task?.id,
              title: String(data.get("title")),
              notes: String(data.get("notes")),
              priority: data.get("priority") as Priority,
              status: data.get("status") as TaskStatus,
              dueDate: String(data.get("dueDate")),
              projectId: String(data.get("projectId")),
            }),
          { success: task ? "Aufgabe gespeichert" : "Aufgabe angelegt", onSuccess: onClose },
        )
      }
    >
      <Field label="Titel">
        <input name="title" className="field" required maxLength={200} autoFocus={!task} defaultValue={task?.title} placeholder="Was steht an?" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priorität">
          <select name="priority" className="field" defaultValue={task?.priority ?? "medium"}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" className="field" defaultValue={task?.status ?? defaults?.status ?? "todo"}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fällig am">
          <input name="dueDate" type="date" className="field" defaultValue={task?.dueDate ?? defaults?.dueDate ?? ""} />
        </Field>
        <Field label="Projekt">
          <select name="projectId" className="field" defaultValue={task?.projectId ?? defaults?.projectId ?? ""}>
            <option value="">Kein Projekt</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notizen">
        <textarea name="notes" className="field" rows={3} maxLength={5000} defaultValue={task?.notes} placeholder="Details, Links, nächste Schritte …" />
      </Field>
    </FormModal>
  );
}
