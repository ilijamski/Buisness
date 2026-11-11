"use client";

import { ArrowLeft, CalendarDays, FolderKanban, GripVertical, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";
import { ConfirmModal, FormModal } from "@/components/ui/modal";
import { Badge, Button, EmptyState, Field, IconButton, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/toast";
import { setTaskStatus } from "@/features/tasks/actions";
import type { TaskRow } from "@/features/tasks/queries";
import { Checkbox, DueBadge, PriorityBadge, TaskDialog, useNextNotice } from "@/features/tasks/task-ui";
import {
  PRIORITY_RANK,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  slotVar,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type ProjectStatus,
  type TaskStatus,
} from "@/lib/constants";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/format";
import { deleteProject, saveProject } from "./actions";
import type { ProjectRow } from "./queries";

type ProjectData = { id: string; name: string; description: string; status: string; color: number; dueDate: string | null };

function ProjectDialog({ open, onClose, project, onDeleted }: { open: boolean; onClose: () => void; project?: ProjectData | null; onDeleted?: () => void }) {
  const { run, pending } = useAction();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <FormModal
        open={open && !confirm}
        onClose={onClose}
        title={project ? "Projekt bearbeiten" : "Neues Projekt"}
        pending={pending}
        submitLabel={project ? "Speichern" : "Anlegen"}
        onDelete={project ? () => setConfirm(true) : undefined}
        onSubmit={(data) =>
          run(
            () =>
              saveProject({
                id: project?.id,
                name: String(data.get("name")),
                description: String(data.get("description")),
                status: data.get("status") as ProjectStatus,
                color: Number(data.get("color")),
                dueDate: String(data.get("dueDate")),
              }),
            {
              success: project ? "Projekt gespeichert" : "Projekt angelegt",
              onSuccess: (result) => {
                onClose();
                if (!project) router.push(`/projekte/${result.id}`);
              },
            },
          )
        }
      >
        <Field label="Name">
          <input name="name" className="field" required maxLength={200} autoFocus={!project} defaultValue={project?.name} placeholder="z. B. Website-Relaunch" />
        </Field>
        <Field label="Beschreibung">
          <textarea name="description" className="field" rows={2} maxLength={5000} defaultValue={project?.description} placeholder="Worum geht es und was ist das Ergebnis?" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select name="status" className="field" defaultValue={project?.status ?? "active"}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Zieltermin">
            <input name="dueDate" type="date" className="field" defaultValue={project?.dueDate ?? ""} />
          </Field>
        </div>
        <div>
          <span className="mb-2 block text-[13px] font-medium text-ink-2">Farbe</span>
          <ColorPicker name="color" defaultValue={project?.color ?? 1} />
        </div>
      </FormModal>
      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        pending={pending}
        title="Projekt löschen?"
        text={`„${project?.name}“ wird mitsamt allen zugehörigen Aufgaben endgültig gelöscht.`}
        onConfirm={() =>
          project &&
          run(() => deleteProject({ id: project.id }), {
            success: "Projekt gelöscht",
            onSuccess: () => {
              setConfirm(false);
              onClose();
              onDeleted?.();
            },
          })
        }
      />
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (PROJECT_STATUSES as readonly string[]).includes(status) ? (status as ProjectStatus) : "active";
  return <Badge tone={s === "active" ? "strong" : "muted"}>{PROJECT_STATUS_LABEL[s]}</Badge>;
}

/* ---------- Übersicht ---------- */

export function ProjectsView({ projects, today }: { projects: ProjectRow[]; today: string }) {
  const [open, setOpen] = useState(false);
  const active = projects.filter((p) => p.status === "active").length;
  return (
    <>
      <PageHeader title="Projekte" subtitle={projects.length ? `${active} aktiv · ${projects.length} insgesamt` : "Größere Vorhaben in Etappen planen."}>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} />
          Neues Projekt
        </Button>
      </PageHeader>

      {projects.length ? (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const ratio = p.total ? p.done / p.total : 0;
            return (
              <Link
                key={p.id}
                href={`/projekte/${p.id}`}
                className="card group flex flex-col p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${slotVar(p.color)} 18%, transparent)` }}>
                    <FolderKanban size={19} style={{ color: slotVar(p.color) }} />
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <h2 className="mt-4 truncate text-base font-semibold tracking-tight text-ink">{p.name}</h2>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{p.description || "Keine Beschreibung"}</p>
                <div className="mt-5">
                  <div className="mb-2 flex items-baseline justify-between text-[13px]">
                    <span className="text-muted">
                      {p.done} von {p.total} Aufgaben
                    </span>
                    <span className="font-medium text-ink tabular-nums">{Math.round(ratio * 100)} %</span>
                  </div>
                  <ProgressBar value={ratio} color={slotVar(p.color)} label={`Fortschritt ${p.name}`} />
                </div>
                {p.dueDate ? (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                    <CalendarDays size={13} />
                    Zieltermin {formatRelative(p.dueDate, today)}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<FolderKanban size={22} />}
            title="Noch keine Projekte"
            text="Bündle zusammengehörige Aufgaben in einem Projekt und verfolge den Fortschritt auf einem Board."
            action={
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus size={16} />
                Erstes Projekt anlegen
              </Button>
            }
          />
        </div>
      )}
      <ProjectDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ---------- Detail mit Kanban-Board ---------- */

export function ProjectBoard({ project, tasks, today }: { project: ProjectData; tasks: TaskRow[]; today: string }) {
  const router = useRouter();
  const { run } = useAction();
  const notice = useNextNotice(today);
  const [board, moveTask] = useOptimistic(tasks, (state, move: { id: string; status: string }) =>
    state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t)),
  );
  const [editProject, setEditProject] = useState(false);
  const [dialog, setDialog] = useState<{ task: TaskRow | null; status?: TaskStatus } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const move = (id: string, status: TaskStatus) => {
    if (board.find((t) => t.id === id)?.status === status) return;
    run(() => setTaskStatus({ id, status }), { optimistic: () => moveTask({ id, status }), onSuccess: notice });
  };
  const done = board.filter((t) => t.status === "done").length;
  const ratio = board.length ? done / board.length : 0;
  const color = slotVar(project.color);

  return (
    <>
      <Link href="/projekte" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
        <ArrowLeft size={15} />
        Alle Projekte
      </Link>
      <PageHeader title={project.name} subtitle={project.description || undefined}>
        <Button onClick={() => setEditProject(true)}>
          <Pencil size={15} />
          Bearbeiten
        </Button>
        <Button variant="primary" onClick={() => setDialog({ task: null, status: "todo" })}>
          <Plus size={16} />
          Aufgabe
        </Button>
      </PageHeader>

      <div className="card mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <StatusBadge status={project.status} />
        {project.dueDate ? (
          <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <CalendarDays size={14} className="text-muted" />
            Zieltermin {formatRelative(project.dueDate, today)}
          </span>
        ) : null}
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <ProgressBar value={ratio} color={color} className="flex-1" label="Projektfortschritt" />
          <span className="text-[13px] text-ink-2 tabular-nums">
            {done}/{board.length} · {Math.round(ratio * 100)} %
          </span>
        </div>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {TASK_STATUSES.map((status) => {
          const items = board
            .filter((t) => t.status === status)
            .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2));
          return (
            <section
              key={status}
              aria-label={TASK_STATUS_LABEL[status]}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) move(id, status);
                setOver(null);
                setDragId(null);
              }}
              className={cn(
                "flex w-[82vw] max-w-sm shrink-0 snap-center flex-col rounded-2xl border bg-surface/60 p-2 transition-colors md:w-auto md:max-w-none",
                over === status && dragId ? "border-accent/60 bg-accent-soft" : "border-line",
              )}
            >
              <header className="flex items-center justify-between px-2 py-1.5">
                <h2 className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                  {TASK_STATUS_LABEL[status]}
                  <span className="rounded-md bg-white/[0.06] px-1.5 text-xs tabular-nums">{items.length}</span>
                </h2>
                <IconButton label={`Aufgabe in „${TASK_STATUS_LABEL[status]}“ anlegen`} className="!size-7" onClick={() => setDialog({ task: null, status })}>
                  <Plus size={15} />
                </IconButton>
              </header>
              <ul className="flex min-h-24 flex-1 flex-col gap-2 p-1">
                {items.map((task) => (
                  <li
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(task.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    onClick={() => setDialog({ task })}
                    className={cn(
                      "group cursor-pointer rounded-xl border border-line bg-raised p-3 transition-[border-color,opacity,transform] hover:border-line-strong active:cursor-grabbing",
                      dragId === task.id && "opacity-40",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        checked={task.status === "done"}
                        color={color}
                        label={task.status === "done" ? `„${task.title}“ wieder öffnen` : `„${task.title}“ erledigen`}
                        onChange={() => move(task.id, task.status === "done" ? "todo" : "done")}
                      />
                      <p className={cn("min-w-0 flex-1 text-sm leading-[22px] break-words", task.status === "done" ? "text-muted line-through decoration-white/20" : "text-ink")}>
                        {task.title}
                      </p>
                      <GripVertical size={15} className="mt-1 hidden shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 md:block" aria-hidden />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-8 empty:hidden">
                      {task.status !== "done" && task.priority !== "medium" ? <PriorityBadge priority={task.priority} /> : null}
                      {task.dueDate ? <DueBadge date={task.dueDate} today={today} done={task.status === "done"} /> : null}
                    </div>
                  </li>
                ))}
                {!items.length ? (
                  <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                    {status === "done" ? "Erledigtes landet hier." : "Keine Aufgaben"}
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted md:hidden">Tippe auf eine Karte, um ihren Status zu ändern.</p>

      <ProjectDialog open={editProject} onClose={() => setEditProject(false)} project={project} onDeleted={() => router.push("/projekte")} />
      <TaskDialog
        today={today}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        task={dialog?.task}
        projects={[{ id: project.id, name: project.name, color: project.color }]}
        defaults={{ projectId: project.id, status: dialog?.status }}
      />
    </>
  );
}
