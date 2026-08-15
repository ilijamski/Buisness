"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Button, Field, Notice } from "@/components/ui";

const initialState: OnboardingState = { error: null };

export function OnboardingForm({ invitedCode = "" }: { invitedCode?: string }) {
  const [mode, setMode] = useState<"company" | "employee">(
    invitedCode ? "employee" : "company",
  );
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);

  return (
    <>
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

      <form action={formAction} className="mt-4 space-y-3 rounded border border-border bg-bg p-4">
        <input type="hidden" name="mode" value={mode} />

        {mode === "company" ? (
          <Field label="Firmenname" required>
            <input name="company_name" required placeholder="Muster Bau GmbH" />
          </Field>
        ) : (
          <Field label="Firmen-Code" required hint="Den Code bekommst du von deinem Admin.">
            <input
              name="join_code"
              required
              defaultValue={invitedCode}
              autoCapitalize="characters"
              className="uppercase"
            />
          </Field>
        )}

        <Field label="Name">
          <input name="full_name" placeholder="Max Mustermann" />
        </Field>

        {state.error && <Notice kind="error">{state.error}</Notice>}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Wird gespeichert…" : "Weiter"}
        </Button>
      </form>
    </>
  );
}
