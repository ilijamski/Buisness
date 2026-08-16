"use client";

import { useActionState } from "react";
import { updateJobStatus } from "@/app/checks/actions";
import { idleState } from "@/lib/action-state";
import { Button, Notice } from "@/components/ui";
import type { Job, JobStatus } from "@/lib/types";

/**
 * Auftrag weiterschalten.
 *
 * Nur der jeweils nächste sinnvolle Schritt als Knopf, statt einer
 * Auswahlliste mit allen vier Zuständen: unterwegs ein Aufklappmenü zu
 * bedienen ist umständlicher, als einmal zu tippen.
 */
export function JobStatusForm({ job }: { job: Job }) {
  const [state, formAction, pending] = useActionState(updateJobStatus, idleState);

  const next: { status: JobStatus; label: string }[] =
    job.status === "geplant"
      ? [
          { status: "unterwegs", label: "Fahrt beginnen" },
          { status: "abgebrochen", label: "Abbrechen" },
        ]
      : job.status === "unterwegs"
        ? [
            { status: "erledigt", label: "Erledigt" },
            { status: "abgebrochen", label: "Abbrechen" },
          ]
        : [{ status: "geplant", label: "Wieder öffnen" }];

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={job.id} />

      {(job.status === "unterwegs" || job.status === "geplant") && (
        <textarea
          name="driver_note"
          rows={2}
          defaultValue={job.driver_note ?? ""}
          placeholder="Notiz (optional) — z. B. Kunde nicht angetroffen"
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
        />
      )}

      {state.error && <Notice kind="error">{state.error}</Notice>}

      <div className="flex flex-wrap gap-2">
        {next.map((option, index) => (
          <Button
            key={option.status}
            type="submit"
            name="status"
            value={option.status}
            disabled={pending}
            variant={index === 0 ? "primary" : "secondary"}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
