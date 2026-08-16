"use client";

import { useActionState } from "react";
import { reportDefect } from "@/app/checks/actions";
import { idleState } from "@/lib/action-state";
import { Button, Field, Notice } from "@/components/ui";
import { SEVERITY_LABELS } from "@/lib/checks";
import type { DefectSeverity } from "@/lib/types";

const SEVERITIES: DefectSeverity[] = ["gering", "mittel", "kritisch"];

const inputClass = "w-full rounded border border-border bg-bg px-3 py-2 text-sm";

/** Einzelnen Mangel melden, ohne die ganze Checkliste durchzugehen. */
export function DefectForm({ vehicleId }: { vehicleId: string }) {
  const [state, formAction, pending] = useActionState(reportDefect, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="vehicle_id" value={vehicleId} />

      <Field label="Was ist defekt?" required>
        <input
          name="title"
          required
          maxLength={120}
          placeholder="z. B. Rücklicht links ohne Funktion"
          className={inputClass}
        />
      </Field>

      <Field label="Beschreibung" hint="Seit wann, wie äußert es sich?">
        <textarea name="description" rows={3} className={inputClass} />
      </Field>

      <Field label="Schweregrad">
        <select name="severity" defaultValue="mittel" className={inputClass}>
          {SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_LABELS[severity]}
              {severity === "kritisch" ? " — Fahrzeug nicht verkehrssicher" : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Foto" hint="Optional, spart der Werkstatt Rückfragen.">
        <input
          type="file"
          name="photo"
          accept="image/*"
          capture="environment"
          className="w-full text-sm"
        />
      </Field>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && (
        <Notice kind="success">
          Mangel gemeldet. Der Fuhrpark-Admin sieht ihn in seiner Mängelliste.
        </Notice>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Wird gemeldet…" : "Mangel melden"}
      </Button>
    </form>
  );
}
