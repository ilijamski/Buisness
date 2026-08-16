import type { Company } from "@/lib/types";

export type Plan = "monthly" | "yearly";

/**
 * Alle Preise sind **Bruttopreise** — der ausgewiesene Betrag ist der, der
 * abgebucht wird. In Stripe müssen die zugehörigen Preise deshalb auf
 * „inklusive Steuer" (tax_behavior: inclusive) stehen, sonst schlägt Stripe
 * die Umsatzsteuer noch einmal obendrauf.
 */
export const VAT_RATE = 0.19;

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
    hint: "Entspricht 17,49 € im Monat — zwei Monate geschenkt.",
  },
};

/**
 * Länge des Gratiszeitraums, den ein Testcode gewährt.
 *
 * Es gibt keinen automatischen Probemonat mehr: Wer sich registriert, hat
 * erst nach Abschluss eines Abos oder nach Einlösen eines Codes Zugang.
 * Gratiszeit entsteht ausschließlich über einen Code.
 */
export const TRIAL_DAYS = 30;

/** Nettoanteil eines Bruttopreises, für den Ausweis auf der Abo-Seite. */
export function netFromGross(grossCents: number): number {
  return Math.round(grossCents / (1 + VAT_RATE));
}

export function vatFromGross(grossCents: number): number {
  return grossCents - netFromGross(grossCents);
}

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
  /**
   * Firma war noch nie freigeschaltet — frisch registriert, nichts bezahlt,
   * kein Code eingelöst. Unterscheidet den Neukunden vom abgelaufenen Abo;
   * beide sehen dieselbe Seite, brauchen aber eine andere Ansprache.
   */
  neverActivated: boolean;
  status: Company["subscription_status"];
};

/**
 * Spiegelt `company_has_access()` aus der Datenbank.
 * Verbindlich ist die SQL-Funktion; das hier steuert nur die Anzeige.
 */
export function accessState(company: Company | null): AccessState {
  if (!company) {
    return {
      hasAccess: false,
      inTrial: false,
      trialDaysLeft: null,
      paid: false,
      neverActivated: true,
      status: "canceled",
    };
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
    neverActivated: !company.activated_at,
    status: company.subscription_status,
  };
}
