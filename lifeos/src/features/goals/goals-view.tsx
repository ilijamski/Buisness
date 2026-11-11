"use client";

import { CalendarDays, Check, Minus, Pencil, Plus, Target, Trophy } from "lucide-react";
import { useState } from "react";
import { FormModal } from "@/components/ui/modal";
import { Badge, Button, EmptyState, Field, IconButton, PageHeader, ProgressBar, ProgressRing, StatTile } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/toast";
import { GOAL_CATEGORIES, GOAL_CATEGORY_LABEL, type GoalCategory } from "@/lib/constants";
import { diffDays, formatMedium } from "@/lib/dates";
import { clamp01, formatNumber } from "@/lib/format";
import { deleteGoal, saveGoal, setGoalProgress } from "./actions";

export type GoalData = {
  id: string;
  title: string;
  description: string;
  category: string;
  current: number;
  target: number;
  unit: string;
  deadline: string | null;
  completedOn: string | null;
};

const CATEGORY_COLOR: Record<string, string> = {
  career: "var(--color-s1)",
  health: "var(--color-s3)",
  finance: "var(--color-s4)",
  learning: "var(--color-s7)",
  personal: "var(--color-s5)",
};
const parseNumber = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(",", "."));
const withUnit = (n: number, unit: string) => (unit === "%" || unit === "€" ? `${formatNumber(n)} ${unit}` : `${formatNumber(n)}${unit ? ` ${unit}` : ""}`);

function GoalDialog({ open, onClose, goal }: { open: boolean; onClose: () => void; goal?: GoalData | null }) {
  const { run, pending } = useAction();
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={goal ? "Ziel bearbeiten" : "Neues Ziel"}
      pending={pending}
      submitLabel={goal ? "Speichern" : "Anlegen"}
      onDelete={goal ? () => run(() => deleteGoal({ id: goal.id }), { success: "Ziel gelöscht", onSuccess: onClose }) : undefined}
      onSubmit={(data) =>
        run(
          () =>
            saveGoal({
              id: goal?.id,
              title: String(data.get("title")),
              description: String(data.get("description")),
              category: data.get("category") as GoalCategory,
              current: parseNumber(data.get("current")),
              target: parseNumber(data.get("target")),
              unit: String(data.get("unit")),
              deadline: String(data.get("deadline")),
            }),
          { success: goal ? "Ziel gespeichert" : "Ziel angelegt", onSuccess: onClose },
        )
      }
    >
      <Field label="Titel">
        <input name="title" className="field" required maxLength={200} autoFocus={!goal} defaultValue={goal?.title} placeholder="z. B. Halbmarathon laufen" />
      </Field>
      <Field label="Beschreibung">
        <textarea name="description" className="field" rows={2} maxLength={5000} defaultValue={goal?.description} placeholder="Warum ist dir das wichtig?" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Aktueller Stand">
          <input name="current" className="field" inputMode="decimal" required defaultValue={goal?.current ?? 0} />
        </Field>
        <Field label="Zielwert">
          <input name="target" className="field" inputMode="decimal" required defaultValue={goal?.target ?? 100} />
        </Field>
        <Field label="Einheit">
          <input name="unit" className="field" maxLength={20} defaultValue={goal?.unit ?? "%"} placeholder="km, €, %" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bereich">
          <select name="category" className="field" defaultValue={goal?.category ?? "personal"}>
            {GOAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {GOAL_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bis wann?">
          <input name="deadline" type="date" className="field" defaultValue={goal?.deadline ?? ""} />
        </Field>
      </div>
    </FormModal>
  );
}

function GoalCard({ goal, today, onEdit }: { goal: GoalData; today: string; onEdit: () => void }) {
  const { run, pending } = useAction();
  const [draft, setDraft] = useState<string | null>(null);
  const ratio = clamp01(goal.current / goal.target);
  const done = Boolean(goal.completedOn);
  const color = CATEGORY_COLOR[goal.category] ?? "var(--color-accent)";
  // Sinnvolle Schrittweite: etwa ein Zwanzigstel des Ziels, auf 1/5/10/50/100 … gerundet.
  const step = [1, 5, 10, 50, 100, 500, 1000].find((s) => goal.target / s <= 25) ?? 1000;
  const daysLeft = goal.deadline ? diffDays(goal.deadline, today) : null;
  const set = (value: number) => run(() => setGoalProgress({ id: goal.id, current: Math.max(0, Math.round(value * 100) / 100) }), { onSuccess: () => setDraft(null) });

  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start gap-4">
        <ProgressRing value={ratio} size={64} stroke={6} color={color}>
          {done ? <Check size={20} strokeWidth={3} className="animate-pop" style={{ color }} /> : `${Math.round(ratio * 100)}%`}
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base leading-snug font-semibold tracking-tight text-balance text-ink">{goal.title}</h2>
            <IconButton label={`„${goal.title}“ bearbeiten`} className="-mt-1.5 -mr-2" onClick={onEdit}>
              <Pencil size={15} />
            </IconButton>
          </div>
          {goal.description ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{goal.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge>
              <span className="size-2 rounded-full" style={{ background: color }} />
              {GOAL_CATEGORY_LABEL[goal.category as GoalCategory] ?? "Persönlich"}
            </Badge>
            {done ? (
              <Badge tone="strong">
                <Trophy size={12} className="text-warn" />
                Erreicht am {formatMedium(goal.completedOn!)}
              </Badge>
            ) : daysLeft !== null ? (
              <Badge tone={daysLeft < 0 ? "critical" : "neutral"}>
                <CalendarDays size={12} />
                {daysLeft < 0 ? `${-daysLeft} Tage überfällig` : daysLeft === 0 ? "Heute fällig" : `Noch ${daysLeft} Tage`}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-2 text-[13px]">
          <span className="font-medium text-ink tabular-nums">{withUnit(goal.current, goal.unit)}</span>
          <span className="text-muted tabular-nums">Ziel: {withUnit(goal.target, goal.unit)}</span>
        </div>
        <ProgressBar value={ratio} color={color} label={`Fortschritt ${goal.title}`} />
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = parseNumber(draft);
          if (draft !== null && Number.isFinite(value)) set(value);
        }}
      >
        <IconButton label={`${step} weniger`} className="border border-line" disabled={pending || goal.current <= 0} onClick={() => set(goal.current - step)}>
          <Minus size={15} />
        </IconButton>
        <input
          aria-label="Aktueller Stand"
          inputMode="decimal"
          className="field !h-9 min-w-0 flex-1 text-center tabular-nums"
          value={draft ?? String(goal.current).replace(".", ",")}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const value = parseNumber(draft);
            if (draft !== null && Number.isFinite(value) && value !== goal.current) set(value);
            else setDraft(null);
          }}
        />
        <IconButton label={`${step} mehr`} className="border border-line" disabled={pending} onClick={() => set(goal.current + step)}>
          <Plus size={15} />
        </IconButton>
      </form>
    </article>
  );
}

export function GoalsView({ goals, today }: { goals: GoalData[]; today: string }) {
  const [dialog, setDialog] = useState<{ goal: GoalData | null } | null>(null);
  const active = goals.filter((g) => !g.completedOn);
  const reached = goals.filter((g) => g.completedOn);
  const average = active.length ? active.reduce((a, g) => a + clamp01(g.current / g.target), 0) / active.length : 0;

  return (
    <>
      <PageHeader title="Ziele" subtitle="Große Vorhaben messbar machen und Schritt für Schritt erreichen.">
        <Button variant="primary" onClick={() => setDialog({ goal: null })}>
          <Plus size={16} />
          Neues Ziel
        </Button>
      </PageHeader>

      {goals.length ? (
        <>
          <div className="stagger mb-5 grid grid-cols-3 gap-3">
            <StatTile label="Aktive Ziele" value={active.length} />
            <StatTile label="Ø Fortschritt" value={`${Math.round(average * 100)} %`} />
            <StatTile label="Erreicht" value={reached.length} />
          </div>
          <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[...active, ...reached].map((goal) => (
              <GoalCard key={goal.id} goal={goal} today={today} onEdit={() => setDialog({ goal })} />
            ))}
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Target size={22} />}
            title="Noch keine Ziele"
            text="Lege ein Ziel mit Zielwert und Termin fest – LifeOS zeigt dir, wie weit du schon bist."
            action={
              <Button variant="primary" onClick={() => setDialog({ goal: null })}>
                <Plus size={16} />
                Erstes Ziel anlegen
              </Button>
            }
          />
        </div>
      )}
      <GoalDialog open={dialog !== null} onClose={() => setDialog(null)} goal={dialog?.goal} />
    </>
  );
}
