import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { EntryType } from "@/lib/types";

/**
 * Belegerkennung: Foto rein, fertige Feldwerte raus.
 *
 * Der Fahrer steht an der Zapfsäule, im Regen, mit Handschuhen. Betrag,
 * Datum, Liter und Kilometerstand abzutippen ist genau der Moment, in dem
 * die Erfassung liegen bleibt und der Beleg im Handschuhfach landet.
 * Fotografieren kann jeder; den Rest übernimmt das Modell.
 *
 * Bewusst als Vorschlag, nicht als Automatik: die erkannten Werte landen im
 * Formular, wo der Fahrer sie sieht und korrigieren kann. Ein Beleg ist ein
 * steuerlich relevanter Nachweis — ungeprüft übernommene Zahlen wären hier
 * schlimmer als gar keine.
 */

const receiptSchema = z.object({
  /** Gesamtbetrag in Euro. */
  total: z.number().nullable(),
  /** Belegdatum als YYYY-MM-DD. */
  date: z.string().nullable(),
  /** Art des Belegs, abgeleitet aus Händler und Positionen. */
  kind: z
    .enum(["tanken", "wartung", "reifen", "bremsen", "inspektion", "schaden", "sonstiges"])
    .nullable(),
  /** Getankte Menge in Litern, falls erkennbar. */
  liters: z.number().nullable(),
  /** Kraftstoffart im Klartext, z. B. „Diesel“ oder „Super E10“. */
  fuel: z.string().nullable(),
  /** Kilometerstand, falls auf dem Beleg vermerkt. */
  mileage: z.number().nullable(),
  /** Händler oder Werkstatt. */
  merchant: z.string().nullable(),
  /**
   * Wie sicher sich das Modell beim Gesamtbetrag ist. Steuert, ob die App
   * zur Prüfung mahnt — bei einem zerknitterten Thermobeleg zu Recht.
   */
  confidence: z.enum(["hoch", "mittel", "niedrig"]),
  /** Grund, falls nichts oder wenig erkannt wurde — für die Anzeige. */
  problem: z.string().nullable(),
});

export type ReceiptScan = z.infer<typeof receiptSchema>;

/** Vorbelegung für das Erfassungsformular. */
export type ScanResult = {
  cost: string;
  date: string;
  type: EntryType | "";
  mileage: string;
  /** Getankte Menge als Zahl — Grundlage für Verbrauch und CO2. */
  liters: string;
  fuelType: string;
  note: string;
  confidence: ReceiptScan["confidence"];
  problem: string | null;
};

/**
 * Kraftstoffbezeichnungen vom Beleg auf die Auswahlliste abbilden.
 *
 * Tankstellen schreiben „Super E10", „SuperE10", „Diesel B7" und ein
 * Dutzend weitere Varianten. Was sich nicht sicher zuordnen lässt, bleibt
 * leer — dann rechnet die CO2-Bilanz mit dem Standardfaktor, statt eine
 * falsche Sorte zu behaupten.
 */
function normalizeFuel(fuel: string | null): string {
  if (!fuel) return "";
  const value = fuel.toLowerCase().replace(/\s+/g, "");

  if (value.includes("e10")) return "super e10";
  if (value.includes("diesel")) return "diesel";
  if (value.includes("super")) return "super";
  if (value.includes("benzin")) return "benzin";
  if (value.includes("lpg") || value.includes("autogas")) return "lpg";
  if (value.includes("cng") || value.includes("erdgas")) return "cng";
  return "";
}

const SYSTEM = `Du liest Belege aus einem Fuhrpark: Tankquittungen, Werkstattrechnungen, Reifenrechnungen.

Trag nur ein, was tatsächlich auf dem Beleg steht. Was du nicht sicher lesen kannst, lässt du null — eine geratene Zahl richtet auf einem Buchungsbeleg mehr Schaden an als eine leere Zeile.

Zum Betrag: Es zählt die Summe, die der Kunde bezahlt hat — bei Tankbelegen der Endbetrag inklusive Mehrwertsteuer, nicht der Nettobetrag und nicht der Literpreis.

Zum Datum: deutsche Schreibweise (31.12.2026) ins Format 2026-12-31 übersetzen. Ohne Jahreszahl auf dem Beleg bleibt das Feld leer.

Zum Kilometerstand: Werkstattrechnungen führen ihn meist im Kopf. Zapfsäulenbelege haben keinen — dort nicht die Literzahl damit verwechseln.

Zur Sicherheitsangabe: „hoch“ nur, wenn der Betrag klar und vollständig lesbar ist. Bei verblasstem Thermopapier, abgeschnittenem Rand oder unscharfem Foto ist „niedrig“ die ehrliche Antwort.

Ist das Bild gar kein Beleg oder unlesbar, lass alle Felder leer und schreib in „problem“ in einem kurzen deutschen Satz, was zu sehen ist.`;

/** Ist die Belegerkennung eingerichtet? */
export function isScanConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt.");
  }
  client ??= new Anthropic();
  return client;
}

/** Erlaubte Bildformate — deckt Handykameras und Scanner-Apps ab. */
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export type ReceiptMediaType = (typeof MEDIA_TYPES)[number];

export function isSupportedMediaType(value: string): value is ReceiptMediaType {
  return (MEDIA_TYPES as readonly string[]).includes(value);
}

/** Liest einen Beleg aus und gibt fertige Formularwerte zurück. */
export async function scanReceipt(
  base64Image: string,
  mediaType: ReceiptMediaType,
): Promise<ScanResult> {
  const response = await getClient().messages.parse({
    model: "claude-opus-5",
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(receiptSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
          { type: "text", text: "Lies diesen Beleg aus." },
        ],
      },
    ],
  });

  // Bei einer Ablehnung aus Sicherheitsgründen bleibt parsed_output leer.
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return emptyResult("Der Beleg konnte nicht ausgewertet werden. Bitte von Hand eintragen.");
  }

  return toFormValues(response.parsed_output);
}

function emptyResult(problem: string): ScanResult {
  return {
    cost: "",
    date: "",
    type: "",
    mileage: "",
    liters: "",
    fuelType: "",
    note: "",
    confidence: "niedrig",
    problem,
  };
}

/** Übersetzt das Modellergebnis in das, was die Formularfelder erwarten. */
function toFormValues(scan: ReceiptScan): ScanResult {
  const noteParts: string[] = [];
  if (scan.merchant) noteParts.push(scan.merchant);
  if (scan.liters !== null) {
    // Deutsches Dezimalkomma, wie es auf dem Beleg steht.
    noteParts.push(`${scan.liters.toFixed(2).replace(".", ",")} l${scan.fuel ? ` ${scan.fuel}` : ""}`);
  } else if (scan.fuel) {
    noteParts.push(scan.fuel);
  }

  return {
    cost: scan.total === null ? "" : scan.total.toFixed(2),
    date: scan.date ?? "",
    type: scan.kind ?? "",
    mileage: scan.mileage === null ? "" : String(scan.mileage),
    liters: scan.liters === null ? "" : scan.liters.toFixed(2),
    fuelType: normalizeFuel(scan.fuel),
    note: noteParts.join(" · "),
    confidence: scan.confidence,
    problem: scan.problem,
  };
}
