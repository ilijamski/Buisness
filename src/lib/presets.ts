/**
 * Branchen-Profile: sinnvolle Startaufstellung der Module.
 *
 * Warum das nötig ist: Ohne Vorauswahl wären alle Module aktiv, und das
 * Formular „Fahrzeug anlegen" hätte knapp dreißig Felder — von der
 * Tachograf-Eichung bis zum Restwert. Für einen Betrieb mit drei
 * Transportern ist das eine Wand, hinter der die eigentliche Funktion
 * verschwindet. Jedes Profil zeigt nur, was in der jeweiligen Branche
 * wirklich anfällt; nachschärfen lässt sich alles einzeln.
 */

export type PresetKey = "handwerk" | "transport" | "dienstwagen" | "alles";

export type Preset = {
  key: PresetKey;
  label: string;
  /** Für wen das Profil gedacht ist — eine Zeile, in der man sich wiedererkennt. */
  audience: string;
  description: string;
  /** Module, die dieses Profil einschaltet. Alle übrigen bleiben aus. */
  modules: string[];
  /**
   * Schaltet ausnahmslos jedes Modul ein — auch später hinzugekommene.
   * Aufgelöst wird das dort, wo die Modulliste ohnehin vorliegt; dadurch
   * bleibt diese Datei frei von einem Import aus `modules` und damit vom
   * Importzyklus (`modules` braucht von hier die Grundaufstellung).
   */
  all?: true;
};

export const PRESETS: Preset[] = [
  {
    key: "handwerk",
    label: "Handwerk & Bau",
    audience: "Transporter, Anhänger, Maschinen",
    description:
      "Prüffristen inklusive UVV, Werkstatt-Historie und Belege. Ohne Fahrtenbuch und Finanzkennzahlen.",
    modules: [
      "hu",
      "au",
      "uvv",
      "insurance",
      "mileage",
      "service",
      "tires",
      "driver",
      "receipts",
      "workshop",
      "damages",
      "documents",
    ],
  },
  {
    key: "transport",
    label: "Spedition & LKW",
    audience: "LKW, Sattelzüge, Berufskraftfahrer",
    description:
      "Alles rund um gewerblichen Güterverkehr: Tachograf, UVV, Bremsen, Fahrtenbuch, Führerscheinklassen und Tankkarten.",
    modules: [
      "hu",
      "au",
      "uvv",
      "tachograph",
      "insurance",
      "mileage",
      "service",
      "tires",
      "brakes",
      "driver",
      "license",
      "logbook",
      "fuelcard",
      "receipts",
      "workshop",
      "damages",
      "documents",
    ],
  },
  {
    key: "dienstwagen",
    label: "Firmenwagen & Außendienst",
    audience: "PKW, Leasingflotten, Vertrieb",
    description:
      "Fahrtenbuch für die 1-%-Regel, Leasingverträge und Tankkarten. Ohne Nutzfahrzeug-Prüfungen.",
    modules: [
      "hu",
      "insurance",
      "mileage",
      "service",
      "tires",
      "driver",
      "logbook",
      "fuelcard",
      "receipts",
      "leasing",
      "damages",
      "documents",
    ],
  },
  {
    key: "alles",
    label: "Alles anzeigen",
    audience: "Gemischter Fuhrpark",
    description:
      "Jedes Modul aktiv. Sinnvoll, wenn du erst einmal sehen willst, was die App alles kann.",
    modules: [],
    all: true,
  },
];

/** Löst `all` gegen die tatsächliche Modulliste auf. */
export function presetModules(preset: Preset, allKeys: string[]): string[] {
  return preset.all ? allKeys : preset.modules;
}

export const PRESET_BY_KEY = new Map(PRESETS.map((p) => [p.key, p]));

/**
 * Profil, das gilt, solange eine Firma nichts eigenes gespeichert hat.
 *
 * „Handwerk & Bau" deckt den kleinsten gemeinsamen Nenner ab: Prüffristen,
 * Wartung, Belege. Wer mehr braucht, schaltet es in den Modul-Einstellungen
 * mit einem Klick dazu.
 */
export const DEFAULT_PRESET_KEY: PresetKey = "handwerk";

const DEFAULT_MODULES = new Set(PRESET_BY_KEY.get(DEFAULT_PRESET_KEY)!.modules);

/** Ist das Modul in der Grundaufstellung aktiv? */
export function enabledByDefault(moduleKey: string): boolean {
  return DEFAULT_MODULES.has(moduleKey);
}
