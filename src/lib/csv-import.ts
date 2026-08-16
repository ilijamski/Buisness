import { MODULES, isEnabled, type ModuleConfig } from "@/lib/modules";
import type { Vehicle } from "@/lib/types";

/**
 * CSV-Import für Fahrzeuge.
 *
 * Ein Betrieb mit zwanzig Fahrzeugen tippt sie nicht einzeln ab — er hat sie
 * längst in einer Excel-Tabelle. Ohne Importweg bleibt genau dieser Betrieb
 * beim ersten Fahrzeug stehen und kommt nicht wieder.
 *
 * Bewusst nachsichtig beim Einlesen: Spalten werden unabhängig von Groß- und
 * Kleinschreibung, Umlauten und Reihenfolge erkannt, Datumsangaben in
 * deutscher wie internationaler Schreibweise akzeptiert. Was nicht zugeordnet
 * werden kann, wird gemeldet statt still verworfen.
 */

export type ImportRow = {
  /** Zeilennummer in der Datei, für die Fehlermeldung. */
  line: number;
  values: Partial<Vehicle> & { name: string; plate: string };
};

export type ImportProblem = {
  line: number;
  message: string;
};

export type ParseResult = {
  rows: ImportRow[];
  problems: ImportProblem[];
  /** Spaltenüberschriften, die keinem Feld zugeordnet werden konnten. */
  ignoredColumns: string[];
};

/** Vereinheitlicht eine Überschrift für den Vergleich. */
function normalize(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/** Erlaubte Überschriften je Fahrzeugfeld. */
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "bezeichnung", "fahrzeug"],
  plate: ["kennzeichen", "nummernschild", "plate", "kfzkennzeichen"],
  type: ["typ", "fahrzeugtyp", "art", "kategorie"],
  notes: ["notiz", "notizen", "bemerkung", "kommentar"],
};

/**
 * Baut die Spaltenzuordnung: Stammdaten plus alle Felder aktiver Module.
 * Modulfelder werden über ihre Beschriftung erkannt, sodass eine Datei, die
 * aus dem Export dieser App stammt, ohne Nacharbeit wieder eingelesen wird.
 */
export function columnMap(config: ModuleConfig): Map<string, { key: string; type: string }> {
  const map = new Map<string, { key: string; type: string }>();

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      map.set(normalize(alias), { key, type: "text" });
    }
  }

  for (const mod of MODULES) {
    if (!isEnabled(config, mod.key)) continue;
    for (const field of mod.fields) {
      map.set(normalize(field.label), { key: field.key, type: field.type });
      map.set(normalize(field.key), { key: field.key, type: field.type });
    }
  }

  return map;
}

/** Zerlegt eine CSV-Zeile unter Beachtung von Anführungszeichen. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quoted) {
      if (char === '"') {
        // Doppeltes Anführungszeichen steht für ein echtes Zeichen.
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/** Erkennt das Trennzeichen an der Kopfzeile — Excel nutzt je nach Land beides. */
function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

/** `31.12.2026`, `2026-12-31` und `31/12/2026` → `2026-12-31`. */
export function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return value;

  const german = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/.exec(value);
  if (german) {
    const [, day, month, yearRaw] = german;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function parseNumber(raw: string, decimal: boolean): number | null {
  // Tausenderpunkte entfernen, deutsches Dezimalkomma auf Punkt drehen.
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const value = decimal ? Number(cleaned) : Number.parseInt(cleaned, 10);
  return Number.isFinite(value) ? value : null;
}

export function parseVehicleCsv(text: string, config: ModuleConfig): ParseResult {
  const problems: ImportProblem[] = [];
  const rows: ImportRow[] = [];

  // BOM entfernen, alle Zeilenenden vereinheitlichen.
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      rows: [],
      problems: [{ line: 0, message: "Die Datei enthält keine Datenzeilen." }],
      ignoredColumns: [],
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter);
  const map = columnMap(config);

  const resolved = headers.map((header) => map.get(normalize(header)) ?? null);
  const ignoredColumns = headers.filter((_, index) => resolved[index] === null);

  if (!resolved.some((column) => column?.key === "name")) {
    problems.push({ line: 1, message: "Spalte „Bezeichnung“ fehlt." });
  }
  if (!resolved.some((column) => column?.key === "plate")) {
    problems.push({ line: 1, message: "Spalte „Kennzeichen“ fehlt." });
  }
  if (problems.length > 0) {
    return { rows: [], problems, ignoredColumns };
  }

  for (let index = 1; index < lines.length; index += 1) {
    const line = index + 1;
    const cells = splitLine(lines[index], delimiter);
    const values: Record<string, string | number | null> = {};

    for (let column = 0; column < resolved.length; column += 1) {
      const target = resolved[column];
      if (!target) continue;

      const raw = (cells[column] ?? "").trim();
      if (!raw) continue;

      if (target.type === "date") {
        const parsed = parseDate(raw);
        if (parsed === null) {
          problems.push({
            line,
            message: `„${raw}“ ist kein gültiges Datum (erwartet 31.12.2026 oder 2026-12-31).`,
          });
          continue;
        }
        values[target.key] = parsed;
      } else if (target.type === "number" || target.type === "decimal") {
        const parsed = parseNumber(raw, target.type === "decimal");
        if (parsed === null) {
          problems.push({ line, message: `„${raw}“ ist keine gültige Zahl.` });
          continue;
        }
        values[target.key] = parsed;
      } else {
        values[target.key] = raw;
      }
    }

    const name = String(values.name ?? "").trim();
    const plate = String(values.plate ?? "").trim();

    if (!name || !plate) {
      problems.push({ line, message: "Bezeichnung und Kennzeichen sind Pflichtangaben." });
      continue;
    }

    rows.push({ line, values: { ...values, name, plate } as ImportRow["values"] });
  }

  return { rows, problems, ignoredColumns };
}

/** Beispieldatei zum Herunterladen — zeigt die erwarteten Spalten. */
export function sampleCsv(): string {
  return [
    "Bezeichnung;Kennzeichen;Typ;HU fällig am;Kilometerstand",
    "Transporter 1;B-AB 1234;Transporter;31.03.2027;84500",
    "Sprinter Bau;B-XY 7788;Transporter;15.09.2026;120300",
  ].join("\r\n");
}
