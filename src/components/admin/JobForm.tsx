"use client";

import { useActionState } from "react";
import { createJob } from "@/app/checks/actions";
import { idleState } from "@/lib/action-state";
import { Button, Field, Notice } from "@/components/ui";
import type { Profile, Vehicle } from "@/lib/types";

const inputClass = "w-full rounded border border-border bg-bg px-3 py-2 text-sm";

/** Auftrag anlegen und einem Fahrer zuweisen. */
export function JobForm({
  vehicles,
  drivers,
}: {
  vehicles: Pick<Vehicle, "id" | "name" | "plate">[];
  drivers: Pick<Profile, "id" | "full_name" | "email">[];
}) {
  const [state, formAction, pending] = useActionState(createJob, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Titel" required>
        <input
          name="title"
          required
          maxLength={140}
          placeholder="z. B. Material abholen bei Meyer"
          className={inputClass}
        />
      </Field>

      <Field label="Beschreibung">
        <textarea name="description" rows={2} className={inputClass} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Adresse">
          <input name="address" placeholder="Straße, PLZ Ort" className={inputClass} />
        </Field>

        <Field label="Termin">
          <input name="scheduled_for" type="datetime-local" className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fahrer">
          <select name="assigned_to" defaultValue="" className={inputClass}>
            <option value="">Noch offen</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name || driver.email}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fahrzeug">
          <select name="vehicle_id" defaultValue="" className={inputClass}>
            <option value="">Ohne Fahrzeug</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name} · {vehicle.plate}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Auftrag angelegt.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Wird angelegt…" : "Auftrag anlegen"}
      </Button>
    </form>
  );
}
