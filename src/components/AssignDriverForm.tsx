"use client";

import { useActionState } from "react";
import { assignDriver, unassignDriver } from "@/app/admin/actions";
import { Button, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";

export function AssignDriverForm({
  vehicleId,
  currentDriver,
}: {
  vehicleId: string;
  currentDriver: string | null;
}) {
  const [assignState, assignAction, assigning] = useActionState(assignDriver, idleState);
  const [unassignState, unassignAction, unassigning] = useActionState(
    unassignDriver,
    idleState,
  );

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Aktueller Fahrer:{" "}
        <strong>{currentDriver ?? "nicht zugewiesen"}</strong>
      </p>

      <form action={assignAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="vehicle_id" value={vehicleId} />
        <label className="flex-1 space-y-1">
          <span className="block text-sm font-medium">Mitarbeiter-Nr.</span>
          <input name="employee_number" type="number" min="1" required placeholder="z. B. 3" />
        </label>
        <Button type="submit" disabled={assigning}>
          {assigning ? "Zuweisen…" : "Zuweisen"}
        </Button>
      </form>

      {currentDriver && (
        <form action={unassignAction}>
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          <Button type="submit" variant="secondary" disabled={unassigning}>
            {unassigning ? "Wird aufgehoben…" : "Zuordnung aufheben"}
          </Button>
        </form>
      )}

      {assignState.error && <Notice kind="error">{assignState.error}</Notice>}
      {assignState.success && <Notice kind="success">Fahrer zugewiesen.</Notice>}
      {unassignState.error && <Notice kind="error">{unassignState.error}</Notice>}
    </div>
  );
}
