"use client";

import { CircleCheck, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, EmptyState, PageHeader, Segmented } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/toast";
import { PRIORITIES, PRIORITY_LABEL, PRIORITY_RANK } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { saveTask } from "./actions";
import type { TaskRow } from "./queries";
import { TaskDialog, TaskItem, type ProjectOption } from "./task-ui";

type Scope = "open" | "done" | "all";

const byUrgency = (a: TaskRow, b: TaskRow) =>
  (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");

export function TasksView({ tasks, projects, today, initialQuery = "" }: { tasks: TaskRow[]; projects: ProjectOption[]; today: string; initialQuery?: string }) {
  // Aus der Suche heraus auch erledigte Aufgaben zeigen.
  const [scope, setScope] = useState<Scope>(initialQuery ? "all" : "open");
  const [priority, setPriority] = useState("");
  const [project, setProject] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [quick, setQuick] = useState("");
  const [dialog, setDialog] = useState<{ task: TaskRow | null } | null>(null);
  const { run, pending } = useAction();

  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = tasks.filter(
      (t) =>
        (scope === "all" || (scope === "done") === (t.status === "done")) &&
        (!priority || t.priority === priority) &&
        (!project || (project === "none" ? !t.projectId : t.projectId === project)) &&
        (!q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q)),
    );
    const active = filtered.filter((t) => t.status !== "done").sort(byUrgency);
    const done = filtered
      .filter((t) => t.status === "done")
      .sort((a, b) => (b.completedOn ?? "").localeCompare(a.completedOn ?? ""));
    const weekEnd = addDays(today, 7);
    return [
      { title: "Überfällig", items: active.filter((t) => t.dueDate && t.dueDate < today) },
      { title: "Heute", items: active.filter((t) => t.dueDate === today) },
      { title: "Nächste 7 Tage", items: active.filter((t) => t.dueDate && t.dueDate > today && t.dueDate <= weekEnd) },
      { title: "Später", items: active.filter((t) => t.dueDate && t.dueDate > weekEnd) },
      { title: "Ohne Datum", items: active.filter((t) => !t.dueDate) },
      { title: "Erledigt", items: done.slice(0, 100), more: Math.max(0, done.length - 100) },
    ].filter((g) => g.items.length);
  }, [tasks, scope, priority, project, query, today]);

  const filtersActive = Boolean(priority || project || query.trim());

  return (
    <>
      <PageHeader
        title="Aufgaben"
        subtitle={
          open.length
            ? `${open.length} offen${overdue ? ` · ${overdue} überfällig` : ""}`
            : "Alles erledigt. Zeit für etwas Schönes."
        }
      >
        <Button variant="primary" onClick={() => setDialog({ task: null })}>
          <Plus size={16} />
          Neue Aufgabe
        </Button>
      </PageHeader>

      <form
        className="card mb-4 flex items-center gap-3 px-4 focus-within:border-accent/60"
        onSubmit={(e) => {
          e.preventDefault();
          const title = quick.trim();
          if (!title || pending) return;
          run(() => saveTask({ title, notes: "" }), { onSuccess: () => setQuick("") });
        }}
      >
        <Plus size={18} className="shrink-0 text-muted" />
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          maxLength={200}
          placeholder="Aufgabe schnell erfassen und mit Enter bestätigen"
          aria-label="Aufgabe schnell erfassen"
          className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented<Scope>
          label="Anzeige"
          value={scope}
          onChange={setScope}
          options={[
            { value: "open", label: "Offen" },
            { value: "done", label: "Erledigt" },
            { value: "all", label: "Alle" },
          ]}
        />
        <select aria-label="Nach Priorität filtern" className="field !h-9 !w-auto" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Alle Prioritäten</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        {projects.length ? (
          <select aria-label="Nach Projekt filtern" className="field !h-9 !w-auto max-w-44" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Alle Projekte</option>
            <option value="none">Ohne Projekt</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        <div className="relative min-w-40 flex-1 sm:max-w-64 sm:flex-none md:ml-auto">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen"
            aria-label="Aufgaben durchsuchen"
            className="field !h-9 !pl-9"
          />
        </div>
      </div>

      {groups.length ? (
        <div className="stagger space-y-4">
          {groups.map((group) => (
            <section key={group.title} className="card p-2">
              <h2 className="flex items-center gap-2 px-3 pt-2 pb-1 text-[13px] font-medium text-muted">
                {group.title}
                <span className="rounded-md bg-white/[0.06] px-1.5 text-xs text-ink-2 tabular-nums">{group.items.length + (group.more ?? 0)}</span>
              </h2>
              {group.items.map((task) => (
                <TaskItem key={task.id} task={task} today={today} onOpen={(t) => setDialog({ task: t })} />
              ))}
              {group.more ? <p className="px-3 py-2 text-xs text-muted">… und {group.more} weitere erledigte Aufgaben.</p> : null}
            </section>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<CircleCheck size={22} />}
            title={filtersActive ? "Keine Treffer" : scope === "done" ? "Noch nichts erledigt" : "Keine offenen Aufgaben"}
            text={
              filtersActive
                ? "Für diese Filter gibt es keine Aufgaben. Passe die Suche an oder setze die Filter zurück."
                : "Erfasse oben deine erste Aufgabe – ein Satz und Enter genügen."
            }
            action={
              filtersActive ? (
                <Button
                  onClick={() => {
                    setPriority("");
                    setProject("");
                    setQuery("");
                  }}
                >
                  Filter zurücksetzen
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      <TaskDialog today={today} open={dialog !== null} onClose={() => setDialog(null)} task={dialog?.task} projects={projects} />
    </>
  );
}
