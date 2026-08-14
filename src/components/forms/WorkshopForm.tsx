"use client";

import { useActionState, useEffect, useRef } from "react";
import { createWorkshopRecord, idleState } from "@/app/fahrzeuge/actions";
import { Button, Field, Notice } from "@/components/ui";

export function WorkshopForm({ vehicleId }: { vehicleId: string }) {
  const [state, formAction, pending] = useActionState(createWorkshopRecord, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="vehicle_id" value={vehicleId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Datum" required>
          <input name="date" type="date" required defaultValue={today} />
        </Field>
        <Field label="Werkstatt">
          <input name="workshop" placeholder="Autohaus Müller" />
        </Field>
        <Field label="Kilometerstand">
          <input name="mileage" type="number" min="0" />
        </Field>
        <Field label="Kosten (€)">
          <input name="cost" type="number" step="0.01" min="0" defaultValue="0" />
        </Field>
      </div>

      <Field label="Durchgeführte Arbeiten" required>
        <textarea name="description" rows={2} required placeholder="Ölwechsel, Bremsbeläge vorne…" />
      </Field>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Eintrag gespeichert.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "In Historie eintragen"}
      </Button>
    </form>
  );
}
