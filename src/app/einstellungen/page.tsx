import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, DataList, Button } from "@/components/ui";
import { PreferencesForm } from "@/components/settings/PreferencesForm";
import { ProfileForm, PasswordForm, CompanyForm } from "@/components/settings/AccountForms";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { InstallHint } from "@/components/settings/InstallHint";
import { PushToggle } from "@/components/settings/PushToggle";
import { signOut } from "@/app/login/actions";
import { signOutEverywhere } from "./actions";
import { DEFAULT_USER_SETTINGS, APP_VERSION, type UserSettings } from "@/lib/settings";

const LEGAL_LINKS = [
  { href: "/rechtliches/datenschutz", label: "Datenschutzerklärung" },
  { href: "/rechtliches/impressum", label: "Impressum" },
  { href: "/rechtliches/nutzungsbedingungen", label: "Nutzungsbedingungen" },
];

export default async function SettingsPage() {
  const { profile, company } = await requireSession();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const [{ data: stored }, { data: deleteCheck }] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", profile.id).maybeSingle(),
    supabase.rpc("can_delete_own_account"),
  ]);

  const settings = {
    ...DEFAULT_USER_SETTINGS,
    ...((stored as UserSettings | null) ?? {}),
  };

  const verdict = (deleteCheck ?? {}) as {
    allowed?: boolean;
    reason?: string;
    deletes_company?: boolean;
  };

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <PageTitle title="Einstellungen" />

        <Card title="Darstellung & Erfassung">
          <PreferencesForm settings={settings} />
        </Card>

        <Card title="Push-Benachrichtigungen">
          <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
        </Card>

        <Card title="App installieren">
          <InstallHint />
        </Card>

        <Card title="Profil">
          <ProfileForm profile={profile} />
        </Card>

        <Card title="Passwort ändern">
          <PasswordForm />
        </Card>

        {isAdmin && company && (
          <>
            <Card title="Firma">
              <CompanyForm company={company} />
            </Card>

            <Card title="Fuhrpark-Konfiguration">
              <p className="mb-3 text-sm text-muted">
                Welche Funktionsbausteine für deine Flotte aktiv und welche Angaben
                verpflichtend sind, stellst du bei den Modulen ein.
              </p>
              <Link
                href="/admin/module"
                className="inline-flex items-center rounded border border-border-strong bg-bg px-3 py-1.5 text-sm font-medium hover:bg-page"
              >
                Module verwalten
              </Link>
            </Card>
          </>
        )}

        <Card title="Konto">
          <div className="space-y-4">
            <DataList
              items={[
                { label: "Angemeldet als", value: profile.email },
                { label: "Firma", value: company?.name ?? "—" },
                { label: "Mitarbeiter-Nr.", value: profile.employee_number ?? "—" },
                { label: "Rolle", value: isAdmin ? "Admin" : "Mitarbeiter" },
              ]}
            />

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <form action={signOut}>
                <Button type="submit" variant="secondary">
                  Abmelden
                </Button>
              </form>
              <form action={signOutEverywhere}>
                <Button type="submit" variant="secondary">
                  Auf allen Geräten abmelden
                </Button>
              </form>
            </div>
          </div>
        </Card>

        <Card title="Konto löschen">
          {verdict.allowed === false ? (
            <p className="text-sm text-danger">{verdict.reason}</p>
          ) : (
            <DeleteAccount deletesCompany={verdict.deletes_company === true} />
          )}
        </Card>

        <Card title="Rechtliches & Info">
          <ul className="divide-y divide-border text-sm">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center justify-between py-2.5 hover:text-accent"
                >
                  {link.label}
                  <span aria-hidden="true" className="text-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
            Fuhrpark-Manager Version {APP_VERSION}
          </p>
        </Card>
      </main>
    </>
  );
}
