/**
 * Erkennt, ob eine Abfrage nur deshalb scheitert, weil die Datenbank noch
 * nicht auf dem Stand des Codes ist.
 *
 * Hintergrund: Code und Migration werden getrennt ausgeliefert. Zwischen
 * „neue Version ist live" und „Migration ist eingespielt" liegt immer ein
 * Fenster — bei einem Selbstbetreiber auch mal Tage. In diesem Fenster darf
 * die App nicht kaputtgehen und, schlimmer noch, nicht so tun, als sei alles
 * in Ordnung: „0 offene Mängel" ist eine Aussage über die Flotte, und die
 * wäre schlicht gelogen, wenn die Tabelle gar nicht existiert.
 *
 * PostgREST meldet beides mit eigenen Codes:
 *   PGRST205 / 42P01 — Tabelle unbekannt
 *   PGRST204 / 42703 — Spalte unbekannt
 */
const MISSING_SCHEMA_CODES = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);

type MaybeError = { code?: string | null; message?: string | null } | null;

export function isMissingSchema(error: MaybeError): boolean {
  if (!error) return false;
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true;

  // Ältere PostgREST-Versionen liefern den Code nicht immer mit.
  const message = error.message?.toLowerCase() ?? "";
  return (
    message.includes("could not find the table") ||
    message.includes("could not find the") && message.includes("column")
  );
}

/** Hinweistext für Bereiche, deren Tabellen noch fehlen. */
export const MISSING_SCHEMA_HINT =
  "Dieser Bereich ist in der Datenbank noch nicht angelegt. Der Fuhrpark-Admin spielt dafür die Migration 0017 ein — bis dahin bleibt hier alles leer.";
