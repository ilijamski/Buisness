"use server";

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { occurrencesBetween } from "@/features/calendar/recurrence";
import { getClock, getUser } from "@/lib/auth/session";
import { addDays } from "@/lib/dates";

export type SearchHit = {
  kind: "task" | "note" | "event" | "project" | "goal";
  id: string;
  title: string;
  detail: string;
  href: string;
};

const PER_KIND = 4;
const { tasks, notes, events, projects, goals } = schema;

/** Durchsucht alle eigenen Inhalte nach einem Begriff (Titel und Text, ohne Groß-/Kleinschreibung). */
export async function searchAll(query: string): Promise<SearchHit[]> {
  const user = await getUser();
  const q = typeof query === "string" ? query.trim().slice(0, 100) : "";
  if (!user || q.length < 2) return [];
  // % und _ sind in LIKE Platzhalter – wörtlich suchen.
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const [db, { today }] = await Promise.all([getDb(), getClock()]);

  const [taskRows, noteRows, eventRows, projectRows, goalRows] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), or(ilike(tasks.title, pattern), ilike(tasks.notes, pattern))))
      .orderBy(desc(tasks.status), desc(tasks.createdAt)) // offene ("todo", "in_progress") vor erledigten
      .limit(PER_KIND),
    db
      .select({ id: notes.id, title: notes.title, content: notes.content })
      .from(notes)
      .where(and(eq(notes.userId, user.id), or(ilike(notes.title, pattern), ilike(notes.content, pattern))))
      .orderBy(desc(notes.updatedAt))
      .limit(PER_KIND),
    db
      .select()
      .from(events)
      .where(and(eq(events.userId, user.id), or(ilike(events.title, pattern), ilike(events.location, pattern), ilike(events.description, pattern))))
      .orderBy(desc(events.date))
      .limit(PER_KIND),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.userId, user.id), or(ilike(projects.name, pattern), ilike(projects.description, pattern))))
      .limit(PER_KIND),
    db
      .select({ id: goals.id, title: goals.title })
      .from(goals)
      .where(and(eq(goals.userId, user.id), or(ilike(goals.title, pattern), ilike(goals.description, pattern))))
      .limit(PER_KIND),
  ]);

  return [
    ...taskRows.map((t): SearchHit => ({
      kind: "task",
      id: t.id,
      title: t.title,
      detail: t.status === "done" ? "Aufgabe · erledigt" : "Aufgabe",
      href: `/aufgaben?q=${encodeURIComponent(t.title)}`,
    })),
    ...noteRows.map((n): SearchHit => ({
      kind: "note",
      id: n.id,
      title: n.title || n.content.slice(0, 60) || "Ohne Titel",
      detail: "Notiz",
      href: `/notizen?id=${n.id}`,
    })),
    ...eventRows.map((e): SearchHit => {
      // Bei Serien zum nächsten anstehenden Termin springen, sonst zum gespeicherten Datum.
      const next = e.repeat === "none" ? null : occurrencesBetween(e, today, addDays(today, 400))[0];
      return { kind: "event", id: e.id, title: e.title, detail: e.repeat === "none" ? "Termin" : "Serientermin", href: `/kalender?d=${next?.start ?? e.date}` };
    }),
    ...projectRows.map((p): SearchHit => ({ kind: "project", id: p.id, title: p.name, detail: "Projekt", href: `/projekte/${p.id}` })),
    ...goalRows.map((g): SearchHit => ({ kind: "goal", id: g.id, title: g.title, detail: "Ziel", href: "/ziele" })),
  ];
}
