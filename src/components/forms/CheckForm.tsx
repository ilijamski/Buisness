"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { submitCheck } from "@/app/checks/actions";
import { idleState } from "@/lib/action-state";
import { Button, Field, Notice } from "@/components/ui";
import { outcomeFor, OUTCOME_LABELS } from "@/lib/checks";
import type { CheckItem, CheckResultStatus } from "@/lib/types";

/**
 * Abfahrtskontrolle Punkt für Punkt.
 *
 * Bewusst ein Punkt pro Bildschirm statt einer langen Liste: Eine Liste mit
 * zehn Kästchen wird von oben nach unten durchgeklickt, ohne hinzusehen —
 * und ist damit als Kontrolle wertlos. Wer einen Punkt nach dem anderen
 * bekommt, schaut zumindest hin. Zurückspringen geht trotzdem, und die
 * Übersicht am Ende zeigt alles noch einmal.
 */
export function CheckForm({
  vehicleId,
  vehicleName,
  templateId,
  items,
  currentMileage,
}: {
  vehicleId: string;
  vehicleName: string;
  templateId: string | null;
  items: CheckItem[];
  currentMileage: number | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitCheck, idleState);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, CheckResultStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const done = step >= items.length;
  const current = items[step];
  const answeredCount = Object.keys(answers).length;
  const outcome = outcomeFor(items, answers);
  const defects = items.filter((item) => answers[item.key] === "mangel");

  if (state.success) {
    return (
      <div className="space-y-3">
        <Notice kind="success">
          Check gespeichert.
          {defects.length > 0 &&
            ` ${defects.length} ${defects.length === 1 ? "Mangel wurde" : "Mängel wurden"} an den Fuhrpark-Admin gemeldet.`}
        </Notice>
        <Button type="button" onClick={() => router.push("/mitarbeiter")}>
          Fertig
        </Button>
      </div>
    );
  }

  function answer(status: CheckResultStatus) {
    setAnswers((prev) => ({ ...prev, [current.key]: status }));
    setStep((prev) => prev + 1);
  }

  return (
    <div className="space-y-4">
      {/* Fortschritt: ohne ihn weiß niemand, ob noch zwei oder zwölf Punkte kommen. */}
      <div>
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span>{vehicleName}</span>
          <span className="tabular-nums">
            {Math.min(step + 1, items.length)} von {items.length}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-page">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(answeredCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      {!done && current && (
        <div className="space-y-4 rounded border border-border p-4">
          <div>
            <p className="text-base font-medium">{current.label}</p>
            {current.critical && (
              <p className="mt-1 text-xs text-danger">
                Sicherheitsrelevant — ein Mangel hier bedeutet: nicht losfahren.
              </p>
            )}
          </div>

          <textarea
            rows={2}
            placeholder="Notiz (optional)"
            value={notes[current.key] ?? ""}
            onChange={(event) =>
              setNotes((prev) => ({ ...prev, [current.key]: event.target.value }))
            }
            className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-3 gap-2">
            <Button type="button" onClick={() => answer("ok")}>
              In Ordnung
            </Button>
            <Button type="button" variant="danger" onClick={() => answer("mangel")}>
              Mangel
            </Button>
            <Button type="button" variant="secondary" onClick={() => answer("entfaellt")}>
              Entfällt
            </Button>
          </div>

          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((prev) => prev - 1)}
              className="text-sm text-muted underline underline-offset-2"
            >
              Einen Punkt zurück
            </button>
          )}
        </div>
      )}

      {done && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          {templateId && <input type="hidden" name="template_id" value={templateId} />}
          <input type="hidden" name="items" value={JSON.stringify(items)} />
          {items.map((item) => (
            <input
              key={item.key}
              type="hidden"
              name={`status_${item.key}`}
              value={answers[item.key]}
            />
          ))}
          {items.map((item) => (
            <input
              key={`note-${item.key}`}
              type="hidden"
              name={`note_${item.key}`}
              value={notes[item.key] ?? ""}
            />
          ))}

          <div
            className={`rounded border p-3 ${
              outcome === "stillgelegt"
                ? "border-danger/30 bg-danger-soft"
                : outcome === "maengel"
                  ? "border-accent-bg bg-accent-soft"
                  : "border-ok/30 bg-ok-soft"
            }`}
          >
            <p className="text-sm font-semibold">{OUTCOME_LABELS[outcome]}</p>
            {outcome === "stillgelegt" && (
              <p className="mt-1 text-sm">
                Ein sicherheitsrelevanter Punkt ist beanstandet. Das Fahrzeug darf so
                nicht bewegt werden — bitte sofort den Fuhrpark-Admin verständigen.
              </p>
            )}
          </div>

          <ul className="divide-y divide-border rounded border border-border">
            {items.map((item, index) => (
              <li key={item.key} className="flex items-center justify-between gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  className="min-w-0 flex-1 text-left text-sm underline-offset-2 hover:underline"
                >
                  {item.label}
                </button>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    answers[item.key] === "mangel"
                      ? "text-danger"
                      : answers[item.key] === "ok"
                        ? "text-ok"
                        : "text-muted"
                  }`}
                >
                  {answers[item.key] === "mangel"
                    ? "Mangel"
                    : answers[item.key] === "ok"
                      ? "In Ordnung"
                      : "Entfällt"}
                </span>
              </li>
            ))}
          </ul>

          {/* Fotos nur für die beanstandeten Punkte — für alles andere gäbe es nichts zu sehen. */}
          {defects.map((item) => (
            <Field key={item.key} label={`Foto: ${item.label}`} hint="Optional, hilft der Werkstatt.">
              <input
                type="file"
                name={`photo_${item.key}`}
                accept="image/*"
                capture="environment"
                className="w-full text-sm"
              />
            </Field>
          ))}

          <Field label="Kilometerstand" hint="Optional, aktualisiert den Zählerstand.">
            <input
              name="mileage"
              type="number"
              min="0"
              inputMode="numeric"
              defaultValue={currentMileage ?? ""}
              className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Bemerkung zum Check">
            <textarea
              name="note"
              rows={2}
              className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
            />
          </Field>

          {state.error && <Notice kind="error">{state.error}</Notice>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Wird gespeichert…" : "Check einreichen"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(items.length - 1)}
            >
              Zurück
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
