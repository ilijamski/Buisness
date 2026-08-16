import type { ImportProblem } from "@/lib/csv-import";

/**
 * Ergebnis eines CSV-Imports.
 *
 * Liegt hier und nicht in der Action-Datei: Module mit `"use server"` dürfen
 * ausschließlich asynchrone Funktionen exportieren — eine Konstante daneben
 * bricht den Build.
 */
export type ImportState = {
  error: string | null;
  /** Lauf abgeschlossen — erst dann ist die Zusammenfassung aussagekräftig. */
  done: boolean;
  imported: number;
  /** Übersprungen, weil das Kennzeichen bereits vorhanden war. */
  skipped: number;
  /** Spalten der Datei, die keinem Feld zugeordnet werden konnten. */
  ignoredColumns: string[];
  problems: ImportProblem[];
};

export const idleImportState: ImportState = {
  error: null,
  done: false,
  imported: 0,
  skipped: 0,
  ignoredColumns: [],
  problems: [],
};
