"use client";

import { useActionState } from "react";
import {
  saveProfile,
  changePassword,
  saveCompany,
} from "@/app/einstellungen/actions";
import { Button, Field, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";
import type { Company, Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(saveProfile, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Name">
        <input name="full_name" defaultValue={profile.full_name ?? ""} placeholder="Max Mustermann" />
      </Field>

      <Field label="E-Mail" hint="Die Anmelde-Adresse lässt sich hier nicht ändern.">
        <input value={profile.email} disabled readOnly />
      </Field>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Profil gespeichert.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Speichern"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Neues Passwort" required hint="Mindestens 8 Zeichen.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>

      <Field label="Neues Passwort wiederholen" required>
        <input
          name="password_confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Passwort geändert.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Wird geändert…" : "Passwort ändern"}
      </Button>
    </form>
  );
}

export function CompanyForm({ company }: { company: Company }) {
  const [state, formAction, pending] = useActionState(saveCompany, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Firmenname" required>
        <input name="name" required defaultValue={company.name} />
      </Field>

      <Field
        label="Vorlaufzeit für Erinnerungen (Tage)"
        required
        hint="So viele Tage vor einer Frist wird die Erinnerungs-Mail verschickt."
      >
        <input
          name="reminder_lead_days"
          type="number"
          min="1"
          max="365"
          required
          defaultValue={company.reminder_lead_days ?? 30}
        />
      </Field>

      <Field label="Kontakt-E-Mail" hint="Erscheint im Impressum der App.">
        <input name="contact_email" type="email" defaultValue={company.contact_email ?? ""} />
      </Field>

      <Field label="Anschrift" hint="Erscheint im Impressum und in der Datenschutzerklärung.">
        <textarea
          name="contact_address"
          rows={3}
          defaultValue={company.contact_address ?? ""}
          placeholder={"Muster Bau GmbH\nMusterstraße 1\n12345 Musterstadt"}
        />
      </Field>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Firmendaten gespeichert.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Speichern"}
      </Button>
    </form>
  );
}
