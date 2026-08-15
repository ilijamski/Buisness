"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "./actions";
import { Button, Field, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, idleState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold">Passwort vergessen</h1>
      <p className="mt-1 text-sm text-muted">
        Wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst.
      </p>

      <form action={formAction} className="mt-5 space-y-3 rounded border border-border bg-bg p-4">
        <Field label="E-Mail" required>
          <input name="email" type="email" required autoComplete="email" />
        </Field>

        {state.error && <Notice kind="error">{state.error}</Notice>}
        {state.success && (
          <Notice kind="success">
            Wenn ein Konto mit dieser Adresse existiert, ist die E-Mail unterwegs.
            Schau auch im Spam-Ordner nach.
          </Notice>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Wird gesendet…" : "Link anfordern"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/login" className="text-accent underline">
          Zurück zum Login
        </Link>
      </p>
    </main>
  );
}
