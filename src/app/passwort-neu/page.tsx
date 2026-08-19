"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { setNewPassword } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";

/**
 * Neues Passwort setzen — Ziel des Links aus der Reset-Mail.
 *
 * Die Seite geht bewusst nicht davon aus, dass schon eine Sitzung besteht.
 * Supabase liefert den Nachweis je nach Projekteinstellung auf drei Wegen:
 *
 *   * `?code=…`        — PKCE, wird vom Callback getauscht
 *   * `?token_hash=…`  — neueres Mail-Template, ebenfalls über den Callback
 *   * `#access_token=` — impliziter Ablauf, steht im Fragment
 *
 * Der dritte Weg ist der tückische: Alles hinter `#` sendet der Browser
 * niemals an den Server. Ein serverseitiger Callback sieht dort einen
 * scheinbar leeren Aufruf und hält den Link für ungültig, obwohl er es
 * nicht ist. Deshalb wird hier im Browser gewartet, bis die Sitzung steht —
 * der Supabase-Client liest das Fragment von allein aus.
 */
type Phase = "pruefe" | "bereit" | "ungueltig";

export default function NewPasswordPage() {
  const [state, formAction, pending] = useActionState(setNewPassword, idleState);
  const [phase, setPhase] = useState<Phase>("pruefe");

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    // Meldet sich, sobald der Client das Fragment ausgewertet hat.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !done) {
        done = true;
        setPhase("bereit");
      }
    });

    // Und der Fall, dass die Sitzung schon steht, bevor wir zuhören.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !done) {
        done = true;
        setPhase("bereit");
      }
    });

    // Kommt nach kurzer Frist nichts, war im Link nichts Verwertbares.
    const timer = setTimeout(() => {
      if (!done) setPhase("ungueltig");
    }, 4000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold">Neues Passwort setzen</h1>

      {phase === "pruefe" && (
        <p className="mt-1 text-sm text-muted">Link wird geprüft…</p>
      )}

      {phase === "ungueltig" && (
        <div className="mt-4 space-y-3">
          <Notice kind="error">
            Dieser Link lässt sich nicht mehr verwenden. Reset-Links gelten nur
            kurze Zeit und nur einmal.
          </Notice>
          <Link
            href="/passwort-vergessen"
            className="inline-flex items-center rounded border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
          >
            Neuen Link anfordern
          </Link>
        </div>
      )}

      {phase === "bereit" && (
        <>
          <p className="mt-1 text-sm text-muted">
            Wähle ein neues Passwort für dein Konto.
          </p>

          <form
            action={formAction}
            className="mt-5 space-y-3 rounded border border-border bg-bg p-4"
          >
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
        </>
      )}
    </main>
  );
}
