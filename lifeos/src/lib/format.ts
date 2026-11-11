const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const eur0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export const formatMoney = (cents: number) => eur.format(cents / 100);
export const formatMoneyRound = (cents: number) => eur0.format(Math.round(cents / 100));
export const formatNumber = (n: number) => num.format(n);
export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)} %`;
export const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Vorzeichenbehaftete Veränderung, z. B. "+3" / "−2" / "±0" */
export function formatDelta(n: number, suffix = ""): string {
  if (n === 0) return `±0${suffix}`;
  return `${n > 0 ? "+" : "−"}${formatNumber(Math.abs(n))}${suffix}`;
}
