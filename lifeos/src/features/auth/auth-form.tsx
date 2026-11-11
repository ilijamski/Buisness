"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button, Field } from "@/components/ui/primitives";
import { login, register, type AuthState } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const [state, action, pending] = useActionState<AuthState, FormData>(isLogin ? login : register, {});

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{isLogin ? "Willkommen zurück" : "Konto erstellen"}</h1>
      <p className="mt-1.5 text-sm text-muted">
        {isLogin ? "Melde dich an, um dort weiterzumachen, wo du aufgehört hast." : "In einer Minute startklar – kostenlos und ohne Umwege."}
      </p>

      <form action={action} className="mt-8 space-y-4">
        {!isLogin ? (
          <Field label="Name">
            <input name="name" className="field" autoComplete="name" required maxLength={80} defaultValue={state.values?.name} placeholder="Wie dürfen wir dich nennen?" />
          </Field>
        ) : null}
        <Field label="E-Mail-Adresse">
          <input name="email" type="email" className="field" autoComplete="email" required defaultValue={state.values?.email} placeholder="du@beispiel.de" />
        </Field>
        <Field label="Passwort" hint={isLogin ? undefined : "Mindestens 8 Zeichen."}>
          <input
            name="password"
            type="password"
            className="field"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={isLogin ? undefined : 8}
          />
        </Field>

        {state.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-[10px] border border-critical/40 bg-critical/10 px-3 py-2.5 text-sm text-danger">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Einen Moment …" : isLogin ? "Anmelden" : "Konto erstellen"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {isLogin ? "Noch kein Konto?" : "Schon registriert?"}{" "}
        <Link href={isLogin ? "/registrieren" : "/login"} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
          {isLogin ? "Jetzt registrieren" : "Zur Anmeldung"}
        </Link>
      </p>
    </>
  );
}
