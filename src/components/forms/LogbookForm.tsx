"use client";

import { useActionState, useEffect, useRef } from "react";
import { createLogbookEntry, idleState } from "@/app/fahrzeuge/actions";
import { Button, Field, Notice } from "@/components/ui";

export function LogbookForm({
  vehicleId,
  lastMileage,
}: {
  vehicleId: string;
  lastMileage: number | null;
}) {
  const [state, formAction, pending] = useActionState(createLogbookEntry, idleState);
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

        <Field label="Fahrtart" required>
          <select name="trip_type" required defaultValue="dienstlich">
            <option value="dienstlich">Dienstlich</option>
            <option value="arbeitsweg">Arbeitsweg</option>
            <option value="privat">Privat</option>
          </select>
        </Field>

        <Field label="km Start" required>
          <input
            name="start_mileage"
            type="number"
            min="0"
            required
            defaultValue={lastMileage ?? undefined}
          />
        </Field>

        <Field label="km Ende" required>
          <input name="end_mileage" type="number" min="0" required />
        </Field>

        <Field label="Von">
          <input name="start_location" placeholder="Betrieb" />
        </Field>

        <Field label="Nach">
          <input name="end_location" placeholder="Baustelle Nord" />
        </Field>
      </div>

      <Field label="Zweck / Anlass">
        <input name="purpose" placeholder="Materialtransport, Kundentermin…" />
      </Field>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Fahrt gespeichert.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Fahrt eintragen"}
      </Button>
    </form>
  );
}
