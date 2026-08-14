"use client";

import { useActionState, useEffect, useRef } from "react";
import { createVehicle, updateVehicle, idleState } from "@/app/admin/actions";
import { Button, Field, Notice } from "@/components/ui";
import { ModuleFields } from "@/components/ModuleFields";
import type { ModuleConfig } from "@/lib/modules";
import type { Vehicle } from "@/lib/types";

/**
 * Ein Formular für Anlegen und Bearbeiten. Welche Fachfelder erscheinen,
 * ergibt sich aus den aktiven Modulen — es gibt keine feste Feldliste.
 */
export function VehicleForm({
  config,
  vehicle = null,
  scope = "admin",
}: {
  config: ModuleConfig;
  vehicle?: Vehicle | null;
  scope?: "admin" | "driver";
}) {
  const isNew = vehicle === null;
  const [state, formAction, pending] = useActionState(
    isNew ? createVehicle : updateVehicle,
    idleState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && isNew) formRef.current?.reset();
  }, [state.success, isNew]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {vehicle && <input type="hidden" name="vehicle_id" value={vehicle.id} />}

      {scope === "admin" && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Stammdaten</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bezeichnung" required>
              <input name="name" required defaultValue={vehicle?.name ?? ""} placeholder="Transporter 1" />
            </Field>
            <Field label="Kennzeichen" required>
              <input name="plate" required defaultValue={vehicle?.plate ?? ""} placeholder="B-AB 1234" />
            </Field>
            <Field label="Fahrzeugtyp">
              <input name="type" defaultValue={vehicle?.type ?? ""} placeholder="PKW, Transporter, LKW…" />
            </Field>
            {vehicle && (
              <Field label="Notiz">
                <input name="notes" defaultValue={vehicle.notes ?? ""} />
              </Field>
            )}
          </div>
        </fieldset>
      )}

      <ModuleFields group="fristen" config={config} vehicle={vehicle} scope={scope} />
      <ModuleFields group="wartung" config={config} vehicle={vehicle} scope={scope} />
      {scope === "admin" && (
        <>
          <ModuleFields group="fahrer" config={config} vehicle={vehicle} scope={scope} />
          <ModuleFields group="finanzen" config={config} vehicle={vehicle} scope={scope} />
        </>
      )}

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && (
        <Notice kind="success">{isNew ? "Fahrzeug angelegt." : "Gespeichert."}</Notice>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : isNew ? "Fahrzeug anlegen" : "Änderungen speichern"}
      </Button>
    </form>
  );
}
