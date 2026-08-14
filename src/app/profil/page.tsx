import { requireSession, loadCompanyModules } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Card, PageTitle, DataList, Badge } from "@/components/ui";
import { LicenseForm } from "@/components/LicenseForm";
import { isEnabled } from "@/lib/modules";
import { daysUntil, statusFor } from "@/lib/deadlines";
import { formatDate } from "@/lib/format";

export default async function ProfilePage() {
  const { profile, company } = await requireSession();
  const config = await loadCompanyModules(profile.company_id!);

  const licenseDays = profile.license_expires_on
    ? daysUntil(profile.license_expires_on)
    : null;

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <PageTitle title="Mein Profil" />

        <Card title="Konto">
          <DataList
            items={[
              { label: "Name", value: profile.full_name ?? "—" },
              { label: "E-Mail", value: profile.email },
              { label: "Mitarbeiter-Nr.", value: profile.employee_number ?? "—" },
              { label: "Firma", value: company?.name ?? "—" },
              {
                label: "Rolle",
                value: profile.role === "admin" ? "Admin" : "Mitarbeiter",
              },
            ]}
          />
        </Card>

        {isEnabled(config, "license") && (
          <Card
            title="Führerschein"
            action={
              licenseDays !== null && statusFor(licenseDays) !== "ok" ? (
                <Badge tone={licenseDays < 0 ? "danger" : "warn"}>
                  {licenseDays < 0
                    ? "abgelaufen"
                    : `läuft in ${licenseDays} Tagen ab`}
                </Badge>
              ) : profile.license_expires_on ? (
                <span className="text-xs text-muted">
                  gültig bis {formatDate(profile.license_expires_on)}
                </span>
              ) : null
            }
          >
            <LicenseForm profile={profile} />
          </Card>
        )}
      </main>
    </>
  );
}
