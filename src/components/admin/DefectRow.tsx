"use client";

import { useActionState, useState } from "react";
import { updateDefect } from "@/app/checks/actions";
import { idleState } from "@/lib/action-state";
import { Button, Badge, Field, Notice } from "@/components/ui";
import { DEFECT_STATUS_LABELS, SEVERITY_LABELS, openSinceDays } from "@/lib/checks";
import { formatDate } from "@/lib/format";
import type { DefectStatus, DefectWithContext } from "@/lib/types";

const STATUS: DefectStatus[] = ["offen", "in_arbeit", "erledigt", "verworfen"];

const inputClass = "w-full rounded border border-border bg-bg px-3 py-2 text-sm";

/**
 * Ein Mangel in der Liste, aufklappbar zum Bearbeiten.
 *
 * Aufgeklappt statt auf einer eigenen Seite: Wer eine Mängelliste abarbeitet,
 * geht sie der Reihe nach durch. Ein Seitenwechsel je Eintrag reißt ihn
 * jedes Mal aus dem Zusammenhang.
 */
export function DefectRow({
  defect,
  photoUrl,
}: {
  defect: DefectWithContext;
  photoUrl?: string;
}) {
  const [state, formAction, pending] = useActionState(updateDefect, idleState);
  const [open, setOpen] = useState(false);

  const days = openSinceDays(defect);
  const active = defect.status === "offen" || defect.status === "in_arbeit";

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-medium">{defect.title}</p>
          <p className="text-xs text-muted">
            {defect.vehicles?.name ?? "Fahrzeug entfernt"}
            {defect.vehicles?.plate ? ` · ${defect.vehicles.plate}` : ""}
            {" · gemeldet von "}
            {defect.profiles?.full_name || defect.profiles?.email || "unbekannt"}
            {active && ` · offen seit ${days} ${days === 1 ? "Tag" : "Tagen"}`}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <Badge
            tone={
              defect.severity === "kritisch"
                ? "danger"
                : defect.severity === "mittel"
                  ? "warn"
                  : "neutral"
            }
          >
            {SEVERITY_LABELS[defect.severity]}
          </Badge>
          <Badge tone={active ? "warn" : "ok"}>
            {DEFECT_STATUS_LABELS[defect.status]}
          </Badge>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded border border-border bg-page p-3">
          {defect.description && <p className="text-sm">{defect.description}</p>}

          {photoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element --
               Signed URLs von Supabase Storage laufen ab; next/image würde sie
               zur Bauzeit optimieren wollen und dabei scheitern. */
            <img
              src={photoUrl}
              alt={`Foto zum Mangel: ${defect.title}`}
              className="max-h-64 rounded border border-border object-contain"
            />
          )}

          {defect.due_date && (
            <p className="text-xs text-muted">Termin: {formatDate(defect.due_date)}</p>
          )}

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="id" value={defect.id} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <select name="status" defaultValue={defect.status} className={inputClass}>
                  {STATUS.map((status) => (
                    <option key={status} value={status}>
                      {DEFECT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Termin" hint="Bis wann soll es behoben sein?">
                <input
                  name="due_date"
                  type="date"
                  defaultValue={defect.due_date ?? ""}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kosten" hint="Was die Behebung gekostet hat.">
                <input
                  name="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={defect.cost ?? ""}
                  className={inputClass}
                />
              </Field>

              <Field label="Erledigt durch">
                <input
                  name="resolution"
                  defaultValue={defect.resolution ?? ""}
                  placeholder="z. B. Werkstatt Müller, Birne getauscht"
                  className={inputClass}
                />
              </Field>
            </div>

            {state.error && <Notice kind="error">{state.error}</Notice>}
            {state.success && <Notice kind="success">Gespeichert.</Notice>}

            <Button type="submit" disabled={pending}>
              {pending ? "Wird gespeichert…" : "Speichern"}
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}
