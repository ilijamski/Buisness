/**
 * Liest Depotauszüge (Bestandsübersichten) im CSV-Format, wie Broker und Banken
 * sie exportieren. Reine Funktionen ohne Datenbankzugriff.
 */
import { CsvError, findColumn, parseDecimal, splitCsv } from "./csv.ts";

export type Position = {
  name: string;
  isin: string;
  assetClass: string;
  quantity: number;
  valueCents: number;
  costCents: number | null;
};

export type ParsedPortfolio = {
  positions: Position[];
  skipped: number;
  columns: string[];
};

// Reihenfolge = Vorrang.
const COLS = {
  name: ["bezeichnung", "wertpapierbezeichnung", "wertpapiername", "wertpapier", "name", "produkt", "titel", "instrument", "position", "description", "security"],
  isin: ["isin"],
  wkn: ["wkn", "symbol", "ticker"],
  quantity: ["stueckzahl", "stueck", "stueckenominale", "anzahl", "bestand", "nominale", "menge", "quantity", "shares", "units"],
  value: ["kurswertineur", "kurswert", "marktwert", "aktuellerwert", "gesamtwert", "wertineur", "depotwert", "wert", "marketvalue", "value", "currentvalue"],
  price: ["aktuellerkurs", "kurs", "letzterkurs", "preis", "price", "lastprice"],
  cost: ["einstandswert", "kaufwert", "einstandsbetrag", "investiert", "anschaffungswert", "costbasis", "purchasevalue"],
  costPrice: ["einstandskurs", "kaufkurs", "einstiegskurs", "durchschnittskurs", "durchschnittlicherkaufkurs", "kaufpreis", "purchaseprice", "avgprice"],
  assetClass: ["gattung", "wertpapierart", "art", "typ", "assetklasse", "anlageklasse", "type", "assetclass"],
} as const;

/** Anlageklasse aus einer Spalte der Datei oder – als Näherung – aus dem Namen. */
export function guessAssetClass(name: string, hint = ""): string {
  const t = `${hint} ${name}`.toLowerCase();
  if (/\b(etf|ucits|etc|index\s?fonds|ishares|xtrackers|vanguard|amundi|lyxor|spdr)\b/.test(t)) return "etf";
  if (/\b(bitcoin|btc|ethereum|eth|krypto|crypto|solana|coin)\b/.test(t)) return "crypto";
  if (/\b(anleihe|bond|bundesanleihe|pfandbrief|schatzanweisung|rente)\b/.test(t)) return "bond";
  if (/\b(fonds|fund|investmentfonds)\b/.test(t)) return "fund";
  if (/\b(aktie|stock|equity|share)\b/.test(t) || !hint) return "stock";
  return "other";
}

const toCents = (n: number | null) => {
  if (n === null) return null;
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) && Math.abs(cents) <= 2_000_000_000 ? cents : null;
};

export function parsePortfolio(text: string): ParsedPortfolio {
  const firstLines = text.split(/\r?\n/, 40).join("\n");
  const isHeader = (r: string[]) =>
    findColumn(r, COLS.name) >= 0 &&
    (findColumn(r, COLS.value) >= 0 || (findColumn(r, COLS.quantity) >= 0 && findColumn(r, COLS.price) >= 0));

  let best: { delimiter: string; header: string[] } | null = null;
  for (const delimiter of [";", ",", "\t"]) {
    const header = splitCsv(firstLines, delimiter).find(isHeader);
    if (header && (!best || header.length > best.header.length)) best = { delimiter, header };
  }
  if (!best) {
    throw new CsvError("In der Datei wurde keine Kopfzeile mit Bezeichnung und Wert (oder Stückzahl und Kurs) gefunden. Bitte die Depotübersicht als CSV exportieren.");
  }

  const all = splitCsv(text, best.delimiter);
  const headerIndex = all.findIndex(isHeader);
  const header = all[headerIndex];
  const col = Object.fromEntries(Object.entries(COLS).map(([key, names]) => [key, findColumn(header, names)])) as Record<keyof typeof COLS, number>;
  const cell = (cells: string[], key: keyof typeof COLS) => (col[key] >= 0 ? (cells[col[key]] ?? "") : "");
  const number = (cells: string[], key: keyof typeof COLS) => (col[key] >= 0 ? parseDecimal(cells[col[key]] ?? "") : null);

  const positions: Position[] = [];
  let skipped = 0;
  for (const cells of all.slice(headerIndex + 1)) {
    if (cells.every((c) => !c.trim())) continue;
    const name = cell(cells, "name").replace(/\s+/g, " ").trim().slice(0, 200);
    const quantity = number(cells, "quantity");
    const price = number(cells, "price");
    const value = toCents(number(cells, "value") ?? (quantity !== null && price !== null ? quantity * price : null));
    // Summen- und Leerzeilen haben keinen Namen oder keinen Wert.
    if (!name || value === null || value <= 0 || /^(summe|gesamt|total)\b/i.test(name)) {
      skipped++;
      continue;
    }
    const costPrice = number(cells, "costPrice");
    const cost = toCents(number(cells, "cost") ?? (quantity !== null && costPrice !== null ? quantity * costPrice : null));
    const isinCell = cell(cells, "isin").trim().toUpperCase();
    positions.push({
      name,
      isin: /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isinCell) ? isinCell : cell(cells, "wkn").trim().toUpperCase().slice(0, 12),
      assetClass: guessAssetClass(name, cell(cells, "assetClass")),
      quantity: quantity !== null && quantity > 0 ? quantity : 0,
      valueCents: value,
      costCents: cost !== null && cost > 0 ? cost : null,
    });
  }
  return {
    positions,
    skipped,
    columns: (Object.keys(COLS) as (keyof typeof COLS)[]).filter((k) => col[k] >= 0).map((k) => header[col[k]].trim()),
  };
}
