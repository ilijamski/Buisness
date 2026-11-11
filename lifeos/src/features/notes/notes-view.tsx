"use client";

import { ArrowLeft, NotebookPen, Pin, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmModal } from "@/components/ui/modal";
import { Button, EmptyState, IconButton, PageHeader } from "@/components/ui/primitives";
import { useAction, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/format";
import { createNote, deleteNote, updateNote } from "./actions";
import type { NoteView } from "./queries";

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
type SaveState = "saved" | "dirty" | "saving" | "error";

/** Editor mit automatischem Speichern kurz nach der letzten Eingabe. */
function Editor({ note, onBack, onDelete }: { note: NoteView; onBack: () => void; onDelete: () => void }) {
  const toast = useToast();
  const { run } = useAction();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [state, setState] = useState<SaveState>("saved");
  const latest = useRef({ title, content });
  const saved = useRef({ title: note.title, content: note.content });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const draft = latest.current;
    if (draft.title === saved.current.title && draft.content === saved.current.content) return;
    setState("saving");
    try {
      const result = await updateNote({ id: note.id, ...draft });
      if (!result.ok) {
        setState("error");
        toast.error(result.error);
        return;
      }
      saved.current = draft;
      setState(latest.current === draft ? "saved" : "dirty");
    } catch {
      setState("error");
    }
  };
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });

  const edit = (patch: Partial<{ title: string; content: string }>) => {
    latest.current = { ...latest.current, ...patch };
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), 700);
  };

  // Beim Verlassen der Notiz oder der Seite noch ausstehende Änderungen sichern.
  useEffect(() => {
    const onHide = () => void flushRef.current();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flushRef.current();
    };
  }, []);

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const status: Record<SaveState, string> = {
    saved: "Gespeichert",
    dirty: "Ungespeicherte Änderungen …",
    saving: "Speichert …",
    error: "Speichern fehlgeschlagen",
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-2 py-2 md:px-3">
        <IconButton label="Zurück zur Liste" onClick={onBack} className="md:hidden">
          <ArrowLeft size={18} />
        </IconButton>
        <span className={cn("flex-1 px-2 text-xs", state === "error" ? "text-danger" : "text-muted")} aria-live="polite">
          {status[state]}
          {state === "error" ? (
            <button type="button" className="ml-2 underline" onClick={() => void flush()}>
              Erneut versuchen
            </button>
          ) : null}
        </span>
        <IconButton
          label={note.pinned ? "Nicht mehr anheften" : "Anheften"}
          aria-pressed={note.pinned}
          onClick={() => run(() => updateNote({ id: note.id, pinned: !note.pinned }))}
          className={note.pinned ? "!text-accent" : undefined}
        >
          <Pin size={16} fill={note.pinned ? "currentColor" : "none"} />
        </IconButton>
        <IconButton label="Notiz löschen" onClick={onDelete}>
          <Trash2 size={16} />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 md:px-8 md:py-7">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            edit({ title: e.target.value });
          }}
          maxLength={200}
          placeholder="Titel"
          aria-label="Titel der Notiz"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight text-ink outline-none placeholder:text-muted/60"
        />
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            edit({ content: e.target.value });
          }}
          maxLength={100000}
          placeholder="Schreib los …"
          aria-label="Inhalt der Notiz"
          className="mt-4 min-h-64 w-full flex-1 resize-none bg-transparent text-[15px] leading-7 text-ink-2 outline-none placeholder:text-muted/60"
        />
      </div>
      <div className="border-t border-line px-5 py-2 text-xs text-muted md:px-8">
        {words} {words === 1 ? "Wort" : "Wörter"} · {content.length} Zeichen
      </div>
    </div>
  );
}

export function NotesView({ notes, initialId }: { notes: NoteView[]; initialId?: string }) {
  const { run, pending } = useAction();
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [mobileOpen, setMobileOpen] = useState(Boolean(initialId));
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) : notes;
  }, [notes, query]);
  // Auf dem Desktop ist immer eine Notiz geöffnet, sofern es welche gibt.
  const selected = notes.find((n) => n.id === selectedId) ?? filtered[0] ?? null;

  const open = (id: string) => {
    setSelectedId(id);
    setMobileOpen(true);
  };
  const create = () => run(() => createNote({}), { onSuccess: ({ id }) => open(id) });

  return (
    <>
      <PageHeader title="Notizen" subtitle={notes.length ? `${notes.length} ${notes.length === 1 ? "Notiz" : "Notizen"} · speichert automatisch` : "Gedanken festhalten, bevor sie verfliegen."}>
        <Button variant="primary" onClick={create} disabled={pending}>
          <Plus size={16} />
          Neue Notiz
        </Button>
      </PageHeader>

      {notes.length ? (
        <div className="card grid h-[calc(100dvh-15.5rem)] min-h-[420px] overflow-hidden md:h-[calc(100dvh-12.5rem)] md:grid-cols-[300px_minmax(0,1fr)]">
          <div className={cn("flex min-h-0 flex-col border-line md:border-r", mobileOpen && "hidden md:flex")}>
            <div className="relative border-b border-line p-3">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Notizen durchsuchen" aria-label="Notizen durchsuchen" className="field !h-9 !pl-9" />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              {filtered.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n.id)}
                    aria-current={selected?.id === n.id}
                    className={cn(
                      "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                      selected?.id === n.id ? "md:bg-white/[0.07]" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {n.pinned ? <Pin size={12} className="shrink-0 text-accent" fill="currentColor" /> : null}
                      <span className={cn("truncate text-sm font-medium", n.title ? "text-ink" : "text-muted")}>{n.title || "Ohne Titel"}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">{n.content.slice(0, 140) || "Noch kein Inhalt"}</span>
                    <span className="mt-1.5 block text-[11px] text-muted/80" suppressHydrationWarning>
                      {dateFormat.format(new Date(n.updatedAt))}
                    </span>
                  </button>
                </li>
              ))}
              {!filtered.length ? <li className="px-3 py-8 text-center text-sm text-muted">Keine Treffer für „{query}“.</li> : null}
            </ul>
          </div>
          <div className={cn("min-h-0", !mobileOpen && "hidden md:block")} onFocusCapture={() => selected && setSelectedId(selected.id)}>
            {selected ? (
              <Editor key={selected.id} note={selected} onBack={() => setMobileOpen(false)} onDelete={() => setConfirm(true)} />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<NotebookPen size={22} />}
            title="Noch keine Notizen"
            text="Ideen, Listen, Gesprächsnotizen – alles landet hier und wird beim Tippen gespeichert."
            action={
              <Button variant="primary" onClick={create} disabled={pending}>
                <Plus size={16} />
                Erste Notiz schreiben
              </Button>
            }
          />
        </div>
      )}

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        pending={pending}
        title="Notiz löschen?"
        text={`„${selected?.title || "Ohne Titel"}“ wird endgültig gelöscht.`}
        onConfirm={() =>
          selected &&
          run(() => deleteNote({ id: selected.id }), {
            success: "Notiz gelöscht",
            onSuccess: () => {
              setConfirm(false);
              setSelectedId(null);
              setMobileOpen(false);
            },
          })
        }
      />
    </>
  );
}
