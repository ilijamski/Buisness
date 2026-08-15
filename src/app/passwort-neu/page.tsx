"use client";

import { useActionState } from "react";
import { setNewPassword } from "./actions";
import { Button, Field, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";

/**
 * Wird über den Link aus der Reset-Mail erreicht. Der Callback hat zu diesem
 * Zeitpunkt bereits eine Sitzung hergestellt, sodass das Passwort direkt
 * gesetzt werden kann.
 */
export default function NewPasswordPage() {
  const [state, formAction, pending] = useActionState(setNewPassword, idleState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold">Neues Passwort setzen</h1>
      <p className="mt-1 text-sm text-muted">
        Wähle ein neues Passwort für dein Konto.
      </p>

      <form action={formAction} className="mt-5 space-y-3 rounded border border-border bg-bg p-4">
        <Field label="Neues Passwort" required hint="Mindestens 8 Zeichen.">
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>

        <Field label="Passwort wiederholen" required>
          <input
            name="password_confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>

        {state.error && <Notice kind="error">{state.error}</Notice>}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Wird gespeichert…" : "Passwort speichern"}
        </Button>
      </form>
    </main>
  );
}
