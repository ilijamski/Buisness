"use client";

import { useActionState, useEffect, useRef } from "react";
import { createEntry } from "@/app/fahrzeuge/actions";
import { Button, Field, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";

export function EntryForm({
  vehicleId,
  showReceipt,
  showMileage,
  mileageRequired,
  receiptRequired,
}: {
  vehicleId: string;
  showReceipt: boolean;
  showMileage: boolean;
  mileageRequired: boolean;
  receiptRequired: boolean;
}) {
  const [state, formAction, pending] = useActionState(createEntry, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="vehicle_id" value={vehicleId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Art" required>
          <select name="type" required defaultValue="tanken">
            <option value="tanken">Tanken</option>
            <option value="wartung">Wartung</option>
            <option value="schaden">Schaden</option>
            <option value="reifen">Reifen</option>
            <option value="bremsen">Bremsen</option>
            <option value="inspektion">Inspektion</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
        </Field>

        <Field label="Kosten (€)" required>
          <input name="cost" type="number" step="0.01" min="0" required placeholder="0,00" />
        </Field>

        <Field label="Datum" required>
          <input name="date" type="date" required defaultValue={today} />
        </Field>

        {showMileage && (
          <Field label="Kilometerstand" required={mileageRequired}>
            <input name="mileage" type="number" min="0" required={mileageRequired} />
          </Field>
        )}
      </div>

      <Field label="Notiz">
        <textarea name="note" rows={2} placeholder="z. B. Tankstelle, Schadenshergang…" />
      </Field>

      {showReceipt && (
        <Field
          label="Beleg-Foto"
          required={receiptRequired}
          hint="Foto oder PDF, max. 10 MB."
        >
          <input
            name="receipt"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            required={receiptRequired}
          />
        </Field>
      )}

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Eintrag gespeichert.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Eintrag speichern"}
      </Button>
    </form>
  );
}
