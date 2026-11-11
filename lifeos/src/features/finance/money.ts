/** Eingabehilfen für Geldbeträge in deutscher Schreibweise. */

/** "1.234,56" → 123456 Cent, "1.000" → 100000 Cent; NaN bei ungültiger Eingabe. */
export function parseCents(input: string): number {
  const cleaned = input.replace(/[€\s]/g, "");
  // Deutsche Schreibweise: Punkt als Tausendertrenner ("1.000", "1.234,56"), Komma als Dezimalzeichen.
  const thousands = cleaned.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(cleaned);
  const normalized = thousands ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Math.round(Number(normalized) * 100) : NaN;
}

export const centsToInput = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ","));
