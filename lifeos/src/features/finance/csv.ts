/**
 * Liest Kontoauszüge im CSV-Format, wie deutsche Banken sie exportieren:
 * wechselnde Trennzeichen, Vorspann vor der Kopfzeile, Windows-1252 statt UTF-8,
 * deutsche Datums- und Zahlenschreibweise. Reine Funktionen ohne Datenbankzugriff.
 */

export type BankRow = {
  date: string; // YYYY-MM-DD
  amountCents: number; // negativ = Ausgabe
  description: string;
  counterparty: string;
};

export type ParsedStatement = {
  rows: BankRow[];
  /** Zeilen unter der Kopfzeile, die sich nicht lesen ließen (z. B. Summenzeilen) */
  skipped: number;
  columns: { date: string; amount: string; description: string | null; counterparty: string | null };
};

export class CsvError extends Error {}

/** UTF-8, sonst Windows-1252 (bei Sparkassen, Volksbanken u. a. üblich). */
export function decodeBytes(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

/** Zerlegt CSV-Text in Zeilen und Felder; Anführungszeichen dürfen Trenner und Umbrüche enthalten. */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");

// Reihenfolge = Vorrang: das Buchungsdatum schlägt die Wertstellung usw.
const COLUMN_NAMES = {
  date: ["buchungstag", "buchungsdatum", "buchung", "datum", "date", "bookingdate", "valutadatum", "valuta", "wertstellung"],
  amount: ["betrag", "umsatz", "amount", "betrageur", "umsatzineur", "betragineur"],
  debit: ["soll", "ausgang", "lastschrift", "debit"],
  credit: ["haben", "eingang", "gutschrift", "credit"],
  description: ["verwendungszweck", "buchungstext", "beschreibung", "vorgangverwendungszweck", "description", "text", "zweck", "buchungsdetails"],
  counterparty: [
    "beguenstigterzahlungspflichtiger",
    "namezahlungsbeteiligter",
    "zahlungsempfaenger",
    "zahlungspflichtiger",
    "auftraggeberempfaenger",
    "empfaenger",
    "auftraggeber",
    "beguenstigter",
    "gegenpartei",
    "payee",
    "name",
  ],
} as const;

export function findColumn(header: string[], names: readonly string[]): number {
  const cells = header.map(norm);
  for (const name of names) {
    const exact = cells.indexOf(name);
    if (exact >= 0) return exact;
  }
  for (const name of names) {
    const partial = cells.findIndex((c) => c.startsWith(name));
    if (partial >= 0) return partial;
  }
  return -1;
}

export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s);
  let y: number, mo: number, d: number;
  if (m) {
    d = +m[1];
    mo = +m[2];
    y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  } else if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) {
    y = +m[1];
    mo = +m[2];
    d = +m[3];
  } else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) {
    d = +m[1];
    mo = +m[2];
    y = +m[3];
  } else return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || y < 1990 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Zahl in deutscher oder englischer Schreibweise ("-1.234,56", "1,234.56", "12,5", "45,00 S") als Kommazahl. */
export function parseDecimal(raw: string): number | null {
  let s = raw.trim().replace(/[\s\u00A0€%]|EUR|USD|Stk\.?|St\./gi, "");
  if (!s) return null;
  let sign = 1;
  if (/[sS]$/.test(s)) sign = -1; // Soll
  s = s.replace(/[sShH]$/, "");
  if (s.endsWith("-")) {
    sign = -sign;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    sign = -sign;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Das zuletzt stehende Zeichen ist das Dezimaltrennzeichen.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = sign * Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Betrag in Cent mit Vorzeichen; null bei ungültiger Eingabe. */
export function parseAmount(raw: string): number | null {
  const n = parseDecimal(raw);
  if (n === null) return null;
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

const clean = (s: string | undefined, max: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function parseStatement(text: string): ParsedStatement {
  const firstLines = text.split(/\r?\n/, 40);
  // Trennzeichen: das häufigste in der Zeile, die am ehesten die Kopfzeile ist.
  let best: { delimiter: string; headerIndex: number; header: string[] } | null = null;
  for (const delimiter of [";", ",", "\t"]) {
    const rows = splitCsv(firstLines.join("\n"), delimiter);
    const headerIndex = rows.findIndex(
      (r) => findColumn(r, COLUMN_NAMES.date) >= 0 && (findColumn(r, COLUMN_NAMES.amount) >= 0 || findColumn(r, COLUMN_NAMES.debit) >= 0),
    );
    if (headerIndex >= 0 && (!best || rows[headerIndex].length > best.header.length)) {
      best = { delimiter, headerIndex, header: rows[headerIndex] };
    }
  }
  if (!best) {
    throw new CsvError("In der Datei wurde keine Kopfzeile mit Datum und Betrag gefunden. Bitte den CSV-Export deiner Bank verwenden.");
  }

  const all = splitCsv(text, best.delimiter);
  // Die Kopfzeile im vollständigen Text wiederfinden (der Vorspann kann mehrzeilige Felder enthalten).
  const headerKey = best.header.map(norm).join("|");
  const headerIndex = all.findIndex((r) => r.map(norm).join("|") === headerKey);
  const header = all[headerIndex];
  const col = {
    date: findColumn(header, COLUMN_NAMES.date),
    amount: findColumn(header, COLUMN_NAMES.amount),
    debit: findColumn(header, COLUMN_NAMES.debit),
    credit: findColumn(header, COLUMN_NAMES.credit),
    description: findColumn(header, COLUMN_NAMES.description),
    counterparty: findColumn(header, COLUMN_NAMES.counterparty),
  };

  const rows: BankRow[] = [];
  let skipped = 0;
  for (const cells of all.slice(headerIndex + 1)) {
    if (cells.every((c) => !c.trim())) continue;
    const date = parseDate(cells[col.date] ?? "");
    let amount = col.amount >= 0 ? parseAmount(cells[col.amount] ?? "") : null;
    if (amount === null && (col.debit >= 0 || col.credit >= 0)) {
      const debit = col.debit >= 0 ? parseAmount(cells[col.debit] ?? "") : null;
      const credit = col.credit >= 0 ? parseAmount(cells[col.credit] ?? "") : null;
      if (debit) amount = -Math.abs(debit);
      else if (credit) amount = Math.abs(credit);
    }
    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    rows.push({
      date,
      amountCents: amount,
      description: clean(cells[col.description], 200),
      counterparty: clean(cells[col.counterparty], 120),
    });
  }
  return {
    rows,
    skipped,
    columns: {
      date: header[col.date].trim(),
      amount: (header[col.amount] ?? `${header[col.debit] ?? ""} / ${header[col.credit] ?? ""}`).trim(),
      description: col.description >= 0 ? header[col.description].trim() : null,
      counterparty: col.counterparty >= 0 ? header[col.counterparty].trim() : null,
    },
  };
}

/* ---------- Automatische Kategorie ---------- */

const RULES: { category: string; type: "income" | "expense"; words: RegExp }[] = [
  { type: "income", category: "salary", words: /\b(gehalt|lohn|bezuege|bezüge|verguetung|vergütung|entgelt)\b/ },
  { type: "income", category: "investment", words: /\b(dividende|zinsen|zinsgutschrift|ertraegnis|erträgnis|ausschuettung|ausschüttung)\b/ },
  { type: "income", category: "freelance", words: /\b(honorar|rechnung|invoice)\b/ },
  { type: "expense", category: "housing", words: /\b(miete|nebenkosten|hausgeld|stadtwerke|strom|gas|vattenfall|eon|e\.on|enbw|rundfunk|telekom|vodafone|o2|1&1|internet)\b/ },
  { type: "expense", category: "food", words: /\b(rewe|edeka|aldi|lidl|netto|penny|kaufland|dm|rossmann|baeckerei|bäckerei|supermarkt|wochenmarkt|denns|alnatura|tegut|norma)\b/ },
  { type: "expense", category: "mobility", words: /\b(db|bahn|deutschlandticket|bvg|hvv|mvg|kvb|tankstelle|aral|shell|esso|jet|total|flixbus|uber|bolt|carsharing|parkhaus|lufthansa|ryanair|easyjet)\b/ },
  { type: "expense", category: "subscriptions", words: /\b(netflix|spotify|disney|prime|apple\.com|icloud|youtube|audible|abo|abonnement|dazn|adobe|microsoft)\b/ },
  { type: "expense", category: "health", words: /\b(apotheke|arzt|praxis|zahnarzt|krankenkasse|fitness|fitnessstudio|physio|optiker|klinik)\b/ },
  { type: "expense", category: "leisure", words: /\b(restaurant|kino|bar|cafe|café|konzert|museum|theater|ticket|eventim|lieferando|hotel|booking|airbnb)\b/ },
  { type: "expense", category: "shopping", words: /\b(amazon|zalando|otto|ikea|mediamarkt|saturn|h&m|zara|ebay|paypal|kleidung|decathlon|thalia)\b/ },
];

export const counterpartyKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Kategorie für eine Bankbuchung. Zuerst zählt, wie derselbe Zahlungspartner
 * zuletzt eingeordnet wurde (auch nach manueller Korrektur), dann Stichwörter.
 */
export function categorize(row: BankRow, learned: Map<string, string>): { type: "income" | "expense"; category: string } {
  const type = row.amountCents > 0 ? "income" : "expense";
  const known = row.counterparty ? learned.get(`${type}:${counterpartyKey(row.counterparty)}`) : undefined;
  if (known) return { type, category: known };
  const text = `${row.counterparty} ${row.description}`.toLowerCase();
  const rule = RULES.find((r) => r.type === type && r.words.test(text));
  return { type, category: rule?.category ?? (type === "income" ? "other_income" : "other") };
}
