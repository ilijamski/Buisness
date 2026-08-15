"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Notice } from "@/components/ui";

const CONFIRM_WORD = "LÖSCHEN";

/**
 * Endgültige Kontolöschung. Läuft über die Edge Function `delete-account`,
 * die das Konto anhand des mitgeschickten Tokens identifiziert.
 */
export function DeleteAccount({ deletesCompany }: { deletesCompany: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Deine Sitzung ist abgelaufen. Bitte melde dich neu an.");
        setPending(false);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Das Konto konnte nicht gelöscht werden.");
        setPending(false);
        return;
      }

      await supabase.auth.signOut();
      router.push("/login");
    } catch {
      setError("Das Konto konnte nicht gelöscht werden. Bitte später erneut versuchen.");
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Löscht dein Konto und alle personenbezogenen Daten unwiderruflich.
          {deletesCompany &&
            " Da du das letzte Mitglied deiner Firma bist, werden auch alle Fahrzeuge, Einträge und Dokumente der Firma gelöscht."}
        </p>
        <Button type="button" variant="danger" onClick={() => setOpen(true)}>
          Konto löschen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Notice kind="error">
        Diese Aktion lässt sich nicht rückgängig machen.
        {deletesCompany &&
          " Alle Firmendaten — Fahrzeuge, Fahrtenbuch, Belege und Dokumente — gehen dabei verloren."}
      </Notice>

      <Field label={`Zum Bestätigen „${CONFIRM_WORD}“ eingeben`} required>
        <input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          placeholder={CONFIRM_WORD}
        />
      </Field>

      {error && <Notice kind="error">{error}</Notice>}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="danger"
          disabled={pending || confirmation.trim().toUpperCase() !== CONFIRM_WORD}
          onClick={handleDelete}
        >
          {pending ? "Wird gelöscht…" : "Konto endgültig löschen"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setConfirmation("");
            setError(null);
          }}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
