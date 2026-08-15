import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Card, PageTitle, DataList, Badge, Notice, Button } from "@/components/ui";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { accessState, PLANS, formatPrice, TRIAL_DAYS } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { openBillingPortal } from "./actions";

export default async function BillingPage() {
  const { profile, company } = await requireSession();
  const access = accessState(company);
  const isAdmin = profile.role === "admin";

  const statusLabel = access.paid
    ? "Aktiv"
    : access.inTrial
      ? "Testphase"
      : "Abgelaufen";

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <PageTitle
          title="Abo"
          subtitle={company?.name}
          action={
            <Badge tone={access.hasAccess ? (access.paid ? "ok" : "warn") : "danger"}>
              {statusLabel}
            </Badge>
          }
        />

        {!access.hasAccess && (
          <Notice kind="error">
            {isAdmin
              ? "Der Zugang ist abgelaufen. Nach Abschluss eines Abos steht sofort wieder alles zur Verfügung — eure Daten bleiben in der Zwischenzeit gespeichert."
              : "Der Zugang eurer Firma ist abgelaufen. Bitte wende dich an deinen Fuhrpark-Admin."}
          </Notice>
        )}

        {access.inTrial && access.trialDaysLeft !== null && (
          <Notice kind="info">
            {access.trialDaysLeft === 1
              ? "Deine Testphase endet morgen."
              : `Noch ${access.trialDaysLeft} Tage kostenlos testen.`}
          </Notice>
        )}

        <Card title="Status">
          <DataList
            items={[
              { label: "Zustand", value: statusLabel },
              {
                label: "Tarif",
                value: company?.plan ? PLANS[company.plan].label : "—",
              },
              {
                label: "Testphase bis",
                value: company?.trial_ends_at ? formatDate(company.trial_ends_at) : "—",
              },
              {
                label: access.paid ? "Nächste Abrechnung" : "Bezahlt bis",
                value: company?.current_period_end
                  ? formatDate(company.current_period_end)
                  : "—",
              },
              ...(company?.cancel_at_period_end
                ? [{ label: "Kündigung", value: "zum Ende des Zeitraums" }]
                : []),
            ]}
          />
        </Card>

        {isAdmin ? (
          <>
            <Card title={access.paid ? "Tarif wechseln" : "Abo abschließen"}>
              <PlanPicker />
            </Card>

            {company?.stripe_customer_id && (
              <Card title="Zahlung verwalten">
                <p className="mb-3 text-sm text-muted">
                  Rechnungen, Zahlungsmittel und Kündigung im Kundenportal.
                </p>
                <form action={openBillingPortal}>
                  <Button type="submit" variant="secondary">
                    Kundenportal öffnen
                  </Button>
                </form>
              </Card>
            )}
          </>
        ) : (
          <Card title="Tarife">
            <DataList
              items={(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((key) => ({
                label: PLANS[key].label,
                value: `${formatPrice(PLANS[key].priceCents)} ${PLANS[key].interval}`,
              }))}
            />
            <p className="mt-3 text-sm text-muted">
              Das Abo schließt der Fuhrpark-Admin eurer Firma ab.
            </p>
          </Card>
        )}

        <Card title="Eure Daten">
          <p className="mb-3 text-sm text-muted">
            Auch bei abgelaufenem Zugang bleiben eure Daten erhalten und lassen sich
            jederzeit exportieren.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              Download braucht echte Navigation. */}
          <a
            href="/export/eintraege"
            className="inline-flex items-center rounded border border-border-strong bg-bg px-3 py-1.5 text-sm font-medium hover:bg-page"
          >
            Daten als CSV exportieren
          </a>
        </Card>

        <p className="text-center text-xs text-muted">
          Der Probemonat läuft {TRIAL_DAYS} Tage und endet automatisch — es entstehen
          keine Kosten, solange kein Abo abgeschlossen wird.{" "}
          <Link href="/rechtliches/nutzungsbedingungen" className="underline">
            Nutzungsbedingungen
          </Link>
        </p>
      </main>
    </>
  );
}
