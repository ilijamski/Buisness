"use client";

import Link from "next/link";
import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  registerCompany,
  registerEmployee,
  type RegisterState,
} from "./actions";
import { Button, Field, Notice } from "@/components/ui";
import { OAuthButtons } from "@/components/OAuthButtons";

const initialState: RegisterState = { error: null, sentTo: null };

type Mode = "company" | "employee";

export default function RegisterPage() {
  // useSearchParams braucht eine Suspense-Grenze, damit die Seite statisch
  // ausgeliefert werden kann.
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  // Über einen Einladungslink (?code=…) startet die Seite direkt im
  // Beitritts-Modus mit ausgefülltem Code.
  const searchParams = useSearchParams();
  const invitedCode = searchParams.get("code")?.trim().toUpperCase() ?? "";
  const [mode, setMode] = useState<Mode>(invitedCode ? "employee" : "company");
  const action = mode === "company" ? registerCompany : registerEmployee;
  const [state, formAction, pending] = useActionState(action, initialState);

  // Bei aktiver E-Mail-Bestätigung entsteht noch keine Sitzung. Das Formular
  // durch den Hinweis auf das Postfach zu ersetzen ist hier wichtiger als es
  // aussieht: sonst liefe die Weiterleitung ins Leere und der Login würde die
  // gerade Registrierten wortlos zurückweisen.
  if (state.sentTo) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <h1 className="text-xl font-semibold">Fast geschafft</h1>
        <p className="mt-3 text-sm">
          Wir haben eine Bestätigung an <strong>{state.sentTo}</strong>{" "}
          geschickt. Öffne die Mail und klick auf den Link — danach bist du
          direkt angemeldet.
        </p>
        <p className="mt-3 text-sm text-muted">
          Nichts angekommen? Sieh im Spam-Ordner nach. Der Link gilt 24 Stunden;
          danach kannst du dich einfach erneut registrieren.
        </p>
        <p className="mt-6 text-center text-sm text-muted">
          Schon bestätigt?{" "}
          <Link href="/login" className="text-accent underline">
            Zum Login
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold">Fuhrpark-Manager</h1>
      <p className="mt-1 text-sm text-muted">
        Firmenkonto anlegen oder einer bestehenden Firma beitreten.
      </p>

      <div className="mt-5 flex rounded border border-border-strong text-sm">
        <button
          type="button"
          onClick={() => setMode("company")}
          className={`flex-1 rounded-l px-3 py-2 ${
            mode === "company" ? "bg-primary font-medium text-primary-fg" : "bg-bg hover:bg-page"
          }`}
        >
          Firma anlegen
        </button>
        <button
          type="button"
          onClick={() => setMode("employee")}
          className={`flex-1 rounded-r border-l border-border-strong px-3 py-2 ${
            mode === "employee" ? "bg-primary font-medium text-primary-fg" : "bg-bg hover:bg-page"
          }`}
        >
          Firma beitreten
        </button>
      </div>

      {/* key erzwingt ein frisches Formular beim Moduswechsel */}
      <form key={mode} action={formAction} className="mt-4 space-y-3 rounded border border-border bg-bg p-4">
        {mode === "company" ? (
          <Field label="Firmenname" required>
            <input name="company_name" required placeholder="Muster Bau GmbH" />
          </Field>
        ) : (
          <Field
            label="Firmen-Code"
            required
            hint="Den Code bekommst du von deinem Fuhrpark-Admin."
          >
            <input
              name="join_code"
              required
              defaultValue={invitedCode}
              placeholder="z. B. K7M2PQRS"
              autoCapitalize="characters"
              className="uppercase"
            />
          </Field>
        )}

        <Field label="Name">
          <input name="full_name" placeholder="Max Mustermann" autoComplete="name" />
        </Field>

        <Field label="E-Mail" required>
          <input name="email" type="email" required autoComplete="email" />
        </Field>

        <Field label="Passwort" required hint="Mindestens 8 Zeichen.">
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>

        {state.error && <Notice kind="error">{state.error}</Notice>}

        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? "Wird angelegt…"
            : mode === "company"
              ? "Firmenkonto anlegen"
              : "Firma beitreten"}
        </Button>
      </form>

      <div className="mt-4">
        <OAuthButtons joinCode={mode === "employee" ? invitedCode : undefined} />
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        Schon registriert?{" "}
        <Link href="/login" className="text-accent underline">
          Zum Login
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-muted">
        <Link href="/rechtliches/datenschutz" className="underline">
          Datenschutz
        </Link>
        {" · "}
        <Link href="/rechtliches/nutzungsbedingungen" className="underline">
          Nutzungsbedingungen
        </Link>
        {" · "}
        <Link href="/rechtliches/impressum" className="underline">
          Impressum
        </Link>
      </p>
    </main>
  );
}
