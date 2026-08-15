import type { Company } from "@/lib/types";

export type Plan = "monthly" | "yearly";

export const PLANS: Record<
  Plan,
  { label: string; priceCents: number; interval: string; hint: string }
> = {
  monthly: {
    label: "Monatlich",
    priceCents: 1990,
    interval: "pro Monat",
    hint: "Monatlich kündbar.",
  },
  yearly: {
    label: "Jährlich",
    priceCents: 20990,
    interval: "pro Jahr",
    hint: "Entspricht 17,49 € im Monat.",
  },
};

export const TRIAL_DAYS = 30;

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export type AccessState = {
  /** Darf die Firma die App gerade nutzen? */
  hasAccess: boolean;
  /** Läuft gerade ein Gratiszeitraum (Probemonat oder Testcode)? */
  inTrial: boolean;
  /** Verbleibende Tage des Gratiszeitraums, sonst null. */
  trialDaysLeft: number | null;
  /** Zahlendes Abo aktiv? */
  paid: boolean;
  status: Company["subscription_status"];
};

/**
 * Spiegelt `company_has_access()` aus der Datenbank.
 * Verbindlich ist die SQL-Funktion; das hier steuert nur die Anzeige.
 */
export function accessState(company: Company | null): AccessState {
  if (!company) {
    return { hasAccess: false, inTrial: false, trialDaysLeft: null, paid: false, status: "canceled" };
  }

  const now = Date.now();
  const trialEnd = company.trial_ends_at ? new Date(company.trial_ends_at).getTime() : null;
  const periodEnd = company.current_period_end
    ? new Date(company.current_period_end).getTime()
    : null;

  const inTrial = trialEnd !== null && trialEnd > now;
  const paid =
    (company.subscription_status === "active" && (periodEnd === null || periodEnd > now)) ||
    (company.subscription_status === "past_due" && periodEnd !== null && periodEnd > now);

  return {
    hasAccess: paid || inTrial,
    inTrial,
    trialDaysLeft: inTrial ? Math.ceil((trialEnd! - now) / (1000 * 60 * 60 * 24)) : null,
    paid,
    status: company.subscription_status,
  };
}
