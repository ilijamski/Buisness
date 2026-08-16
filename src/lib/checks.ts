import type {
  CheckItem,
  CheckOutcome,
  CheckResultStatus,
  Defect,
  DefectSeverity,
  DefectStatus,
} from "@/lib/types";

/**
 * Abfahrtskontrolle — Standardliste.
 *
 * Der Inhalt ist nicht frei erfunden: § 36 UVV „Fahrzeuge" (DGUV Vorschrift 70)
 * verlangt vom Fahrer, sich vor Fahrtantritt vom betriebssicheren Zustand zu
 * überzeugen. Die Punkte hier bilden genau das ab, was dabei üblicherweise
 * geprüft wird — und nicht mehr, denn eine Liste, die zu lang ist, wird
 * abgehakt statt durchgegangen.
 *
 * `critical` markiert die Punkte, bei denen ein Mangel die Fahrt verbietet.
 * Wer hier einen Mangel meldet, bekommt das Fahrzeug als stillgelegt
 * angezeigt — das ist der Unterschied zwischen einer Checkliste und einem
 * Formular.
 */
export const DEFAULT_CHECK_ITEMS: CheckItem[] = [
  { key: "beleuchtung", label: "Beleuchtung vorne und hinten", critical: true },
  { key: "bremsen", label: "Bremsen und Handbremse", critical: true },
  { key: "reifen", label: "Reifen: Profil, Druck, Beschädigungen", critical: true },
  { key: "lenkung", label: "Lenkung und Spiel", critical: true },
  { key: "scheiben", label: "Scheiben, Spiegel, Scheibenwischer", critical: true },
  { key: "warnwesten", label: "Warnweste, Warndreieck, Verbandkasten", critical: false },
  { key: "fluessigkeiten", label: "Öl-, Kühl- und Waschwasserstand", critical: false },
  { key: "karosserie", label: "Karosserie: neue Schäden", critical: false },
  { key: "ladung", label: "Ladung gesichert", critical: false },
  { key: "papiere", label: "Fahrzeugschein und Versicherungsnachweis an Bord", critical: false },
];

/** Zusätzliche Vorlagen, die ein Admin als Startpunkt übernehmen kann. */
export const CHECK_PRESETS: { name: string; items: CheckItem[] }[] = [
  { name: "Abfahrtskontrolle (Standard)", items: DEFAULT_CHECK_ITEMS },
  {
    name: "Transporter / Lkw",
    items: [
      ...DEFAULT_CHECK_ITEMS,
      { key: "ladebordwand", label: "Ladebordwand und Verriegelung", critical: true },
      { key: "zurrmittel", label: "Zurrgurte und Spanngurte", critical: false },
      { key: "tachograf", label: "Fahrtenschreiber betriebsbereit", critical: false },
    ],
  },
  {
    name: "Kurzcheck (täglich)",
    items: [
      { key: "beleuchtung", label: "Beleuchtung", critical: true },
      { key: "reifen", label: "Reifen sichtprüfen", critical: true },
      { key: "karosserie", label: "Neue Schäden", critical: false },
      { key: "sauberkeit", label: "Fahrzeug sauber und aufgeräumt", critical: false },
    ],
  },
];

export const CHECK_STATUS_LABELS: Record<CheckResultStatus, string> = {
  ok: "In Ordnung",
  mangel: "Mangel",
  entfaellt: "Entfällt",
};

export const OUTCOME_LABELS: Record<CheckOutcome, string> = {
  ok: "Ohne Beanstandung",
  maengel: "Mängel vorhanden",
  stillgelegt: "Nicht verkehrssicher",
};

export const SEVERITY_LABELS: Record<DefectSeverity, string> = {
  gering: "Gering",
  mittel: "Mittel",
  kritisch: "Kritisch",
};

export const DEFECT_STATUS_LABELS: Record<DefectStatus, string> = {
  offen: "Offen",
  in_arbeit: "In Arbeit",
  erledigt: "Erledigt",
  verworfen: "Verworfen",
};

/**
 * Ergebnis eines Checks aus den Einzelantworten.
 *
 * Ein Mangel an einem kritischen Punkt wiegt schwerer als beliebig viele
 * an unkritischen: sobald einer dabei ist, ist das Fahrzeug stillgelegt.
 */
export function outcomeFor(
  items: CheckItem[],
  answers: Record<string, CheckResultStatus>,
): CheckOutcome {
  const defects = items.filter((item) => answers[item.key] === "mangel");
  if (defects.length === 0) return "ok";
  return defects.some((item) => item.critical) ? "stillgelegt" : "maengel";
}

/** Schweregrad für einen aus dem Check entstandenen Mangel. */
export function severityFor(item: CheckItem): DefectSeverity {
  return item.critical ? "kritisch" : "mittel";
}

export function isOpen(defect: Pick<Defect, "status">): boolean {
  return defect.status === "offen" || defect.status === "in_arbeit";
}

/**
 * Sortierung der Mängelliste: erst was offen und kritisch ist, dann der Rest.
 * Innerhalb gleicher Dringlichkeit das Ältere zuerst — was lange liegt,
 * soll nicht nach unten rutschen.
 */
export function byUrgency(a: Defect, b: Defect): number {
  const openRank = (d: Defect) => (isOpen(d) ? 0 : 1);
  if (openRank(a) !== openRank(b)) return openRank(a) - openRank(b);

  const severityRank: Record<DefectSeverity, number> = {
    kritisch: 0,
    mittel: 1,
    gering: 2,
  };
  if (severityRank[a.severity] !== severityRank[b.severity]) {
    return severityRank[a.severity] - severityRank[b.severity];
  }
  return a.created_at.localeCompare(b.created_at);
}

/** Wie lange ein Mangel schon offen ist, in Tagen. */
export function openSinceDays(defect: Defect, today = new Date()): number {
  const created = new Date(defect.created_at).getTime();
  return Math.max(0, Math.floor((today.getTime() - created) / 86_400_000));
}
