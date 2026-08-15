"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button, Field, Notice } from "@/components/ui";
import { OAuthButtons } from "@/components/OAuthButtons";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold">Fuhrpark-Manager</h1>
      <p className="mt-1 text-sm text-muted">Bitte melde dich an.</p>

      <form action={formAction} className="mt-5 space-y-3 rounded border border-border bg-bg p-4">
        <Field label="E-Mail" required>
          <input name="email" type="email" required autoComplete="email" />
        </Field>

        <Field label="Passwort" required>
          <input name="password" type="password" required autoComplete="current-password" />
        </Field>

        <p className="text-right text-sm">
          <Link href="/passwort-vergessen" className="text-accent underline">
            Passwort vergessen?
          </Link>
        </p>

        {state.error && <Notice kind="error">{state.error}</Notice>}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Anmelden…" : "Anmelden"}
        </Button>
      </form>

      <div className="mt-4">
        <OAuthButtons />
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        Noch kein Konto?{" "}
        <Link href="/registrieren" className="text-accent underline">
          Firma anlegen oder beitreten
        </Link>
      </p>
    </main>
  );
}
