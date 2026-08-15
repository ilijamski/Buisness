import { Card, Badge, EmptyState } from "@/components/ui";
import { formatPrice, PLANS } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import type { PlatformCompany, PlatformStats as Stats } from "@/lib/types";

/**
 * Betreiber-Kennzahlen.
 *
 * Bewusst ohne Diagramme: Es sind Momentaufnahmen einzelner Zahlen, keine
 * Verläufe und keine Serien — dafür sind Kennzahlen-Kacheln die richtige Form,
 * ein Balkendiagramm mit einem Balken wäre nur Dekoration. Statuszustände
 * tragen immer ein Wort, nie nur eine Farbe.
 */

function StatTile({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: number; label: string };
}) {
  return (
    <div className="rounded border border-border bg-bg p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
      {delta && (
        <p className="mt-0.5 text-xs text-muted">
          <span aria-hidden="true">
            {delta.value > 0 ? "↑" : delta.value < 0 ? "↓" : "→"}
          </span>{" "}
          {delta.value > 0 ? "+" : ""}
          {delta.value} {delta.label}
        </p>
      )}
      {hint && !delta && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function PlatformStats({
  stats,
  companies,
}: {
  stats: Stats;
  companies: PlatformCompany[];
}) {
  const growth = stats.new_companies_30d - stats.new_companies_prev30d;

  // Anteil zahlender Kunden an allen, die die Testphase hinter sich haben.
  const converted = stats.companies_paying;
  const finishedTrial = stats.companies_total - stats.companies_trialing;
  const conversionRate =
    finishedTrial > 0 ? Math.round((converted / finishedTrial) * 100) : null;

  return (
    <>
      {/* Die eine Zahl, mit der das Dashboard führt. */}
      <Card title="Monatlicher Umsatz">
        <p className="text-5xl leading-none font-semibold tabular-nums">
          {formatPrice(stats.mrr_gross_cents)}
        </p>
        <p className="mt-2 text-sm text-muted">
          brutto pro Monat · netto {formatPrice(stats.mrr_net_cents)} ·
          hochgerechnet {formatPrice(stats.arr_gross_cents)} im Jahr
        </p>
        <p className="mt-1 text-xs text-muted">
          Laufende Abos, Jahrestarife anteilig auf den Monat umgelegt. Testphasen
          zählen nicht mit.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Zahlende Kunden"
          value={String(stats.companies_paying)}
          hint={`${stats.plan_monthly}× monatlich, ${stats.plan_yearly}× jährlich`}
        />
        <StatTile
          label="In Testphase"
          value={String(stats.companies_trialing)}
          hint="Probemonat oder Testcode läuft"
        />
        <StatTile
          label="Neue Firmen (30 Tage)"
          value={String(stats.new_companies_30d)}
          delta={{ value: growth, label: "ggü. den 30 Tagen davor" }}
        />
        <StatTile
          label="Ohne Zugang"
          value={String(stats.companies_expired)}
          hint="Testphase abgelaufen, kein Abo"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Firmen gesamt"
          value={String(stats.companies_total)}
          hint={
            conversionRate !== null
              ? `${conversionRate} % davon zahlend (nach Testphase)`
              : undefined
          }
        />
        <StatTile
          label="Nutzer gesamt"
          value={String(stats.users_total)}
          hint={`${stats.vehicles_total} Fahrzeuge verwaltet`}
        />
        <StatTile
          label="Gekündigt"
          value={String(stats.companies_canceling)}
          hint="läuft zum Periodenende aus"
        />
        <StatTile
          label="Zahlung offen"
          value={String(stats.companies_past_due)}
          hint={`${stats.codes_redeemed} Testcodes eingelöst`}
        />
      </div>

      <Card title="Kunden">
        {companies.length === 0 ? (
          <EmptyState>Noch keine Firmen registriert.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Firma</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Tarif</th>
                  <th className="py-2 pr-3 font-medium">Läuft bis</th>
                  <th className="py-2 pr-3 text-right font-medium">Nutzer</th>
                  <th className="py-2 pr-3 text-right font-medium">Fahrzeuge</th>
                  <th className="py-2 text-right font-medium">Seit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.map((company) => {
                  const paying =
                    company.subscription_status === "active" && company.has_access;
                  const trialing = !paying && company.has_access;

                  return (
                    <tr key={company.id}>
                      <td className="py-2 pr-3 font-medium">{company.name}</td>
                      <td className="py-2 pr-3">
                        <Badge
                          tone={paying ? "ok" : trialing ? "warn" : "danger"}
                        >
                          {paying ? "Zahlend" : trialing ? "Testphase" : "Kein Zugang"}
                        </Badge>
                        {company.cancel_at_period_end && (
                          <span className="ml-1.5 text-xs text-muted">gekündigt</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted">
                        {company.plan ? PLANS[company.plan].label : "—"}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-muted">
                        {company.current_period_end
                          ? formatDate(company.current_period_end)
                          : company.trial_ends_at
                            ? formatDate(company.trial_ends_at)
                            : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {company.user_count}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {company.vehicle_count}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap text-muted">
                        {formatDate(company.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
