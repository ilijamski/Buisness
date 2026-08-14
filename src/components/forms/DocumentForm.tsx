"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadDocument, idleState } from "@/app/fahrzeuge/actions";
import { Button, Field, Notice } from "@/components/ui";

export function DocumentForm({ vehicleId }: { vehicleId: string }) {
  const [state, formAction, pending] = useActionState(uploadDocument, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="vehicle_id" value={vehicleId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Art" required>
          <select name="kind" required defaultValue="fahrzeugschein">
            <option value="fahrzeugschein">Fahrzeugschein</option>
            <option value="fahrzeugbrief">Fahrzeugbrief</option>
            <option value="versicherung">Versicherung</option>
            <option value="leasingvertrag">Leasingvertrag</option>
            <option value="nachweis">Nachweis (z. B. Anhängerkupplung, Klima-Check)</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
        </Field>

        <Field label="Titel" required>
          <input name="title" required placeholder="Fahrzeugschein" />
        </Field>

        <Field label="Gültig bis">
          <input name="valid_until" type="date" />
        </Field>

        <Field label="Datei" required hint="Foto oder PDF, max. 10 MB.">
          <input name="file" type="file" accept="image/*,application/pdf" required />
        </Field>
      </div>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Dokument hinterlegt.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Wird hochgeladen…" : "Dokument hochladen"}
      </Button>
    </form>
  );
}
