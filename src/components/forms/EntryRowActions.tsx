"use client";

import { useActionState, useState } from "react";
import { updateEntry, deleteEntry } from "@/app/fahrzeuge/actions";
import { Button, Field, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";
import type { Entry } from "@/lib/types";

/**
 * Korrigieren und Löschen direkt an der Eintragszeile.
 * Wird nur gerendert, wenn der Server das Korrekturfenster als offen meldet —
 * die endgültige Entscheidung trifft aber die RLS-Policy.
 */
export function EntryRowActions({
  entry,
  vehicleId,
}: {
  entry: Entry;
  vehicleId: string;
}) {
  const [open, setOpen] = useState(false);
  const [editState, editAction, editing] = useActionState(updateEntry, idleState);
  const [deleteState, deleteFormAction, deleting] = useActionState(deleteEntry, idleState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-accent underline"
      >
        korrigieren
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded border border-border bg-page p-3">
      <form action={editAction} className="space-y-2">
        <input type="hidden" name="entry_id" value={entry.id} />
        <input type="hidden" name="vehicle_id" value={vehicleId} />

        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Art">
            <select name="type" defaultValue={entry.type}>
              <option value="tanken">Tanken</option>
              <option value="wartung">Wartung</option>
              <option value="schaden">Schaden</option>
              <option value="reifen">Reifen</option>
              <option value="bremsen">Bremsen</option>
              <option value="inspektion">Inspektion</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </Field>
          <Field label="Kosten (€)">
            <input name="cost" type="number" step="0.01" min="0" defaultValue={entry.cost} />
          </Field>
          <Field label="Datum">
            <input name="date" type="date" defaultValue={entry.date} />
          </Field>
        </div>

        <Field label="Notiz">
          <input name="note" defaultValue={entry.note ?? ""} />
        </Field>

        {editState.error && <Notice kind="error">{editState.error}</Notice>}
        {editState.success && <Notice kind="success">Gespeichert.</Notice>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={editing}>
            {editing ? "Speichern…" : "Speichern"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Schließen
          </Button>
        </div>
      </form>

      <form action={deleteFormAction} className="border-t border-border pt-2">
        <input type="hidden" name="entry_id" value={entry.id} />
        <input type="hidden" name="vehicle_id" value={vehicleId} />
        {deleteState.error && <Notice kind="error">{deleteState.error}</Notice>}
        <Button type="submit" variant="danger" disabled={deleting}>
          {deleting ? "Wird gelöscht…" : "Eintrag löschen"}
        </Button>
      </form>
    </div>
  );
}
