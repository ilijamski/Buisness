/**
 * Zeitfenster, in dem Mitarbeiter eigene Einträge noch selbst korrigieren
 * dürfen. Muss zur SQL-Funktion `within_correction_window` passen — die
 * Datenbank entscheidet verbindlich, hier geht es nur darum, Schaltflächen
 * gar nicht erst anzuzeigen.
 */
export const CORRECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinCorrectionWindow(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < CORRECTION_WINDOW_MS;
}
