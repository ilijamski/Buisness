"use client";

import { useActionState } from "react";
import { saveLicense, idleState } from "@/app/admin/actions";
import { Button, Field, Notice } from "@/components/ui";
import type { Profile } from "@/lib/types";

export function LicenseForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(saveLicense, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="profile_id" value={profile.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Führerscheinklassen" hint="z. B. B, BE, C, CE">
          <input name="license_classes" defaultValue={profile.license_classes ?? ""} />
        </Field>
        <Field label="Führerschein gültig bis">
          <input
            name="license_expires_on"
            type="date"
            defaultValue={profile.license_expires_on ?? ""}
          />
        </Field>
      </div>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Gespeichert.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Speichern"}
      </Button>
    </form>
  );
}
