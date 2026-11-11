"use client";

import { Database, Download, LogOut, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { ConfirmModal, FormModal } from "@/components/ui/modal";
import { Button, Card, CardHeader, Field, PageHeader } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/toast";
import { logout } from "@/features/auth/actions";
import { changePassword, clearAllData, deleteAccount, loadDemoData, updateProfile } from "./actions";

function Row({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-ink-2">{icon}</span>
      <div className="min-w-48 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[13px] text-pretty text-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsView({ user, storage }: { user: { name: string; email: string }; storage: string }) {
  const { run, pending } = useAction();
  const passwordForm = useRef<HTMLFormElement>(null);
  const [confirm, setConfirm] = useState<"clear" | "delete" | null>(null);

  return (
    <>
      <PageHeader title="Einstellungen" subtitle="Konto, Sicherheit und deine Daten." />
      <div className="stagger max-w-2xl space-y-5">
        <Card>
          <CardHeader title="Profil" />
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              run(() => updateProfile({ name: String(data.get("name")), email: String(data.get("email")) }), { success: "Profil gespeichert" });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input name="name" className="field" required maxLength={80} autoComplete="name" defaultValue={user.name} />
              </Field>
              <Field label="E-Mail-Adresse">
                <input name="email" type="email" className="field" required autoComplete="email" defaultValue={user.email} />
              </Field>
            </div>
            <Button type="submit" variant="primary" disabled={pending}>
              Speichern
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Passwort" hint="Nach der Änderung werden alle anderen Geräte abgemeldet." />
          <form
            ref={passwordForm}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              run(() => changePassword({ current: String(data.get("current")), next: String(data.get("next")) }), {
                success: "Passwort geändert",
                onSuccess: () => passwordForm.current?.reset(),
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Aktuelles Passwort">
                <input name="current" type="password" className="field" required autoComplete="current-password" />
              </Field>
              <Field label="Neues Passwort" hint="Mindestens 8 Zeichen.">
                <input name="next" type="password" className="field" required minLength={8} autoComplete="new-password" />
              </Field>
            </div>
            <Button type="submit" disabled={pending}>
              Passwort ändern
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Daten" />
          <div className="divide-y divide-line">
            <Row icon={<Download size={16} />} title="Daten exportieren" text="Alle Einträge als JSON-Datei herunterladen.">
              <a href="/api/export" download className="inline-flex h-10 items-center rounded-[10px] border border-line-strong bg-white/[0.03] px-3.5 text-sm font-medium hover:bg-white/[0.07]">
                Exportieren
              </a>
            </Row>
            <Row icon={<Sparkles size={16} />} title="Beispieldaten laden" text="Fügt Aufgaben, Termine, Gewohnheiten und Buchungen der letzten Wochen hinzu – ideal zum Ausprobieren.">
              <Button disabled={pending} onClick={() => run(() => loadDemoData({}), { success: "Beispieldaten geladen" })}>
                Laden
              </Button>
            </Row>
            <Row icon={<Database size={16} />} title="Speicherort" text={storage}>
              <span />
            </Row>
            <Row icon={<LogOut size={16} />} title="Abmelden" text="Beendet die Sitzung auf diesem Gerät.">
              <form action={logout}>
                <Button type="submit">Abmelden</Button>
              </form>
            </Row>
          </div>
        </Card>

        <Card className="border-critical/30">
          <CardHeader title="Gefahrenzone" hint="Diese Aktionen lassen sich nicht rückgängig machen." />
          <div className="divide-y divide-line">
            <Row icon={<Trash2 size={16} />} title="Alle Inhalte löschen" text="Entfernt sämtliche Aufgaben, Termine, Notizen und Buchungen. Dein Konto bleibt bestehen.">
              <Button variant="danger" onClick={() => setConfirm("clear")}>
                Inhalte löschen
              </Button>
            </Row>
            <Row icon={<Trash2 size={16} />} title="Konto löschen" text="Löscht dein Konto und alle zugehörigen Daten endgültig.">
              <Button variant="danger" onClick={() => setConfirm("delete")}>
                Konto löschen
              </Button>
            </Row>
          </div>
        </Card>
      </div>

      <ConfirmModal
        open={confirm === "clear"}
        onClose={() => setConfirm(null)}
        pending={pending}
        title="Alle Inhalte löschen?"
        text="Sämtliche Aufgaben, Projekte, Termine, Ziele, Gewohnheiten, Notizen und Buchungen werden endgültig gelöscht. Exportiere deine Daten vorher, wenn du sie behalten möchtest."
        confirmLabel="Alles löschen"
        onConfirm={() => run(() => clearAllData({}), { success: "Alle Inhalte gelöscht", onSuccess: () => setConfirm(null) })}
      />
      <FormModal
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Konto endgültig löschen"
        pending={pending}
        submitLabel="Konto löschen"
        onSubmit={(data) => run(() => deleteAccount({ password: String(data.get("password")) }))}
      >
        <p className="text-sm text-pretty text-ink-2">Dein Konto und alle Daten werden unwiderruflich gelöscht. Bestätige mit deinem Passwort.</p>
        <Field label="Passwort">
          <input name="password" type="password" className="field" required autoComplete="current-password" autoFocus />
        </Field>
      </FormModal>
    </>
  );
}
