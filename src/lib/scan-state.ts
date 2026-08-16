import type { ScanResult } from "@/lib/receipt-scan";

/**
 * Zustand der Belegerkennung im Formular.
 *
 * Eigene Datei, weil Module mit `"use server"` ausschließlich asynchrone
 * Funktionen exportieren dürfen — eine Konstante daneben bricht den Build.
 */
export type ScanState = {
  error: string | null;
  result: ScanResult | null;
};

export const idleScanState: ScanState = { error: null, result: null };
