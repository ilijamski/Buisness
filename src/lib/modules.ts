import type { Vehicle } from "@/lib/types";

/**
 * Zentrale Definition aller optionalen Funktionsbausteine.
 *
 * Jedes Modul kann vom Admin firmenweit an-/abgeschaltet und als Pflicht
 * markiert werden; pro Fahrzeug lässt sich das überschreiben. Die hier
 * definierten Felder steuern zugleich, welche Eingabefelder in den Formularen
 * erscheinen — es gibt keine zweite Feldliste an anderer Stelle.
 */

export type ModuleGroup = "fristen" | "wartung" | "fahrer" | "finanzen" | "dokumente";

export type VehicleFieldKey = keyof Vehicle;

export type FieldType = "date" | "number" | "text" | "decimal";

export type ModuleField = {
  key: VehicleFieldKey;
  label: string;
  type: FieldType;
  /** Kurzer Hinweis unter dem Feld. */
  hint?: string;
  /** Feld darf auch vom Fahrer gepflegt werden (sonst nur Admin). */
  driverEditable?: boolean;
  /** Feld zählt zur Pflicht, wenn das Modul als Pflicht markiert ist. */
  requirable?: boolean;
};

export type ModuleDefinition = {
  key: string;
  label: string;
  group: ModuleGroup;
  description: string;
  /** Fahrzeugfelder, die dieses Modul mitbringt. */
  fields: ModuleField[];
  /** Feld, das als überwachte Frist in der Fristenübersicht auftaucht. */
  deadlineField?: VehicleFieldKey;
  /** Modul steuert einen eigenen Bereich statt reiner Fahrzeugfelder. */
  section?: "logbook" | "workshop" | "documents" | "fuelcard" | "receipts" | "damages" | "driver" | "license";
};

export const MODULE_GROUP_LABELS: Record<ModuleGroup, string> = {
  fristen: "Fristen & Prüfungen",
  wartung: "Wartung & Technik",
  fahrer: "Fahrer & Nutzung",
  finanzen: "Finanzen & Verwaltung",
  dokumente: "Dokumente",
};

export const MODULES: ModuleDefinition[] = [
  // --- Fristen & Prüfungen ------------------------------------------------
  {
    key: "hu",
    label: "TÜV / Hauptuntersuchung",
    group: "fristen",
    description: "Termin der nächsten Hauptuntersuchung.",
    deadlineField: "hu_date",
    fields: [{ key: "hu_date", label: "HU fällig am", type: "date", requirable: true }],
  },
  {
    key: "au",
    label: "Abgasuntersuchung (AU)",
    group: "fristen",
    description: "Termin der nächsten Abgasuntersuchung.",
    deadlineField: "au_date",
    fields: [{ key: "au_date", label: "AU fällig am", type: "date", requirable: true }],
  },
  {
    key: "uvv",
    label: "UVV-Prüfung",
    group: "fristen",
    description: "Pflichtprüfung für Nutzfahrzeuge, Krane, Hebebühnen etc.",
    deadlineField: "uvv_date",
    fields: [{ key: "uvv_date", label: "UVV-Prüfung fällig am", type: "date", requirable: true }],
  },
  {
    key: "tachograph",
    label: "Tachograf-Eichung",
    group: "fristen",
    description: "Eichfrist des digitalen Tachografen (LKW).",
    deadlineField: "tachograph_date",
    fields: [{ key: "tachograph_date", label: "Eichung fällig am", type: "date", requirable: true }],
  },
  {
    key: "insurance",
    label: "Kfz-Versicherung",
    group: "fristen",
    description: "Versicherer, Police und Ablaufdatum.",
    deadlineField: "insurance_expires_on",
    fields: [
      { key: "insurance_company", label: "Versicherung", type: "text" },
      { key: "insurance_policy_number", label: "Versicherungsschein-Nr.", type: "text" },
      { key: "insurance_expires_on", label: "Läuft ab am", type: "date", requirable: true },
    ],
  },
  {
    key: "registration",
    label: "Zulassung & Saisonkennzeichen",
    group: "fristen",
    description: "Erstzulassung und Gültigkeitszeitraum bei Saisonkennzeichen.",
    fields: [
      { key: "registration_date", label: "Zulassung am", type: "date" },
      { key: "season_plate_from", label: "Saison von (MM)", type: "text", hint: "z. B. 03" },
      { key: "season_plate_to", label: "Saison bis (MM)", type: "text", hint: "z. B. 10" },
    ],
  },

  // --- Wartung & Technik --------------------------------------------------
  {
    key: "mileage",
    label: "Kilometerstand",
    group: "wartung",
    description: "Aktueller Kilometerstand — Basis für Wartungsintervalle.",
    fields: [
      {
        key: "current_mileage",
        label: "Kilometerstand",
        type: "number",
        driverEditable: true,
        requirable: true,
        hint: "Wird vom Fahrer gepflegt.",
      },
    ],
  },
  {
    key: "service",
    label: "Inspektion / Ölwechsel",
    group: "wartung",
    description: "Nächste Inspektion nach Datum oder Kilometerstand.",
    deadlineField: "next_service_date",
    fields: [
      { key: "next_service_date", label: "Nächste Inspektion am", type: "date", requirable: true },
      { key: "next_service_mileage", label: "Nächste Inspektion bei km", type: "number" },
    ],
  },
  {
    key: "tires",
    label: "Reifen & Profiltiefe",
    group: "wartung",
    description: "Reifenwechseltermin, montierter Reifentyp und Profiltiefe.",
    deadlineField: "next_tire_change_date",
    fields: [
      { key: "next_tire_change_date", label: "Nächster Reifenwechsel am", type: "date" },
      { key: "tire_type", label: "Aktuelle Bereifung", type: "text", hint: "Sommer / Winter / Ganzjahr" },
      {
        key: "tread_depth_mm",
        label: "Profiltiefe (mm)",
        type: "decimal",
        driverEditable: true,
        requirable: true,
      },
    ],
  },
  {
    key: "brakes",
    label: "Bremsen-Check",
    group: "wartung",
    description: "Termin der nächsten Bremsenprüfung.",
    deadlineField: "next_brake_check_date",
    fields: [{ key: "next_brake_check_date", label: "Bremsen-Check fällig am", type: "date" }],
  },
  {
    key: "workshop",
    label: "Werkstatt-Historie",
    group: "wartung",
    description: "Reparatur- und Wartungsprotokoll je Fahrzeug.",
    section: "workshop",
    fields: [],
  },

  // --- Fahrer & Nutzung ---------------------------------------------------
  {
    key: "driver",
    label: "Fahrerzuordnung",
    group: "fahrer",
    description: "Wer fährt aktuell welches Fahrzeug.",
    section: "driver",
    fields: [],
  },
  {
    key: "license",
    label: "Führerschein-Ablauf",
    group: "fahrer",
    description: "Ablaufdatum und Klassen des Fahrers (wichtig bei C/CE).",
    section: "license",
    fields: [],
  },
  {
    key: "logbook",
    label: "Fahrtenbuch",
    group: "fahrer",
    description: "Kilometerprotokoll mit dienstlich / privat / Arbeitsweg.",
    section: "logbook",
    fields: [],
  },
  {
    key: "fuelcard",
    label: "Tankkarten",
    group: "fahrer",
    description: "Tankkarten verwalten und Fahrzeugen zuordnen.",
    section: "fuelcard",
    fields: [],
  },
  {
    key: "receipts",
    label: "Tankbelege",
    group: "fahrer",
    description: "Beleg-Fotos zu Einträgen hochladen.",
    section: "receipts",
    fields: [],
  },

  // --- Finanzen & Verwaltung ---------------------------------------------
  {
    key: "leasing",
    label: "Leasing / Finanzierung",
    group: "finanzen",
    description: "Vertragspartner, Rate und Laufzeitende.",
    deadlineField: "leasing_end_date",
    fields: [
      { key: "leasing_provider", label: "Leasinggeber / Bank", type: "text" },
      { key: "leasing_monthly_cost", label: "Monatliche Rate (€)", type: "decimal" },
      { key: "leasing_end_date", label: "Laufzeitende", type: "date", requirable: true },
    ],
  },
  {
    key: "tax",
    label: "Kfz-Steuer",
    group: "finanzen",
    description: "Fälligkeit und Höhe der Kfz-Steuer.",
    deadlineField: "tax_due_date",
    fields: [
      { key: "tax_due_date", label: "Steuer fällig am", type: "date" },
      { key: "tax_amount", label: "Jahresbetrag (€)", type: "decimal" },
    ],
  },
  {
    key: "valuation",
    label: "Anschaffungs- & Restwert",
    group: "finanzen",
    description: "Grundlage für die Abschreibung.",
    fields: [
      { key: "purchase_date", label: "Anschaffung am", type: "date" },
      { key: "purchase_value", label: "Anschaffungswert (€)", type: "decimal" },
      { key: "residual_value", label: "Restwert (€)", type: "decimal" },
    ],
  },
  {
    key: "damages",
    label: "Schadensfälle & Unfallhistorie",
    group: "finanzen",
    description: "Schäden inkl. Fotos und Kostenübersicht.",
    section: "damages",
    fields: [],
  },

  // --- Dokumente ----------------------------------------------------------
  {
    key: "documents",
    label: "Fahrzeugdokumente",
    group: "dokumente",
    description: "Fahrzeugschein/-brief und Nachweise digital ablegen.",
    section: "documents",
    fields: [],
  },
];

export const MODULE_BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

export const MODULE_KEYS = MODULES.map((m) => m.key);

/** Effektive Einstellung eines Moduls für ein konkretes Fahrzeug. */
export type EffectiveModule = {
  enabled: boolean;
  required: boolean;
};

export type ModuleConfig = Map<string, EffectiveModule>;

/**
 * Löst Firmen-Grundeinstellung und Fahrzeug-Override zusammen.
 * Fehlende Zeile = Standard (aktiv, nicht verpflichtend).
 * Fahrzeugwert `null` = erbt die Firmeneinstellung.
 */
export function resolveModules(
  companySettings: { module_key: string; enabled: boolean; required: boolean }[],
  vehicleSettings: { module_key: string; enabled: boolean | null; required: boolean | null }[] = [],
): ModuleConfig {
  const company = new Map(companySettings.map((s) => [s.module_key, s]));
  const vehicle = new Map(vehicleSettings.map((s) => [s.module_key, s]));

  const config: ModuleConfig = new Map();
  for (const mod of MODULES) {
    const base = company.get(mod.key);
    const override = vehicle.get(mod.key);
    config.set(mod.key, {
      enabled: override?.enabled ?? base?.enabled ?? true,
      required: override?.required ?? base?.required ?? false,
    });
  }
  return config;
}

export function isEnabled(config: ModuleConfig, key: string): boolean {
  return config.get(key)?.enabled ?? true;
}

export function isRequired(config: ModuleConfig, key: string): boolean {
  return config.get(key)?.required ?? false;
}

/** Alle aktiven Module einer Gruppe. */
export function enabledModules(config: ModuleConfig, group?: ModuleGroup): ModuleDefinition[] {
  return MODULES.filter(
    (m) => (group ? m.group === group : true) && isEnabled(config, m.key),
  );
}
