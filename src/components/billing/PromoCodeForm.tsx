"use client";

import { useActionState } from "react";
import { generatePromoCode } from "@/app/plattform/actions";
import { Button, Field, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";

export function PromoCodeForm() {
  const [state, formAction, pending] = useActionState(generatePromoCode, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Gratis-Tage" required hint="Wird an einen laufenden Zeitraum angehängt.">
          <input name="grants_days" type="number" min="1" max="3650" defaultValue={30} required />
        </Field>
        <Field label="Maximale Einlösungen" required hint="Je Firma zählt nur eine.">
          <input name="max_uses" type="number" min="1" defaultValue={1} required />
        </Field>
      </div>

      <Field label="Notiz" hint="Wofür ist der Code gedacht? Nur für dich sichtbar.">
        <input name="note" placeholder="z. B. Messe Hannover" />
      </Field>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && (
        <Notice kind="success">Code erzeugt — er steht unten in der Liste.</Notice>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Wird erzeugt…" : "Code erzeugen"}
      </Button>
    </form>
  );
}
