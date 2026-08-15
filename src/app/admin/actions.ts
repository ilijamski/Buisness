"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { MODULES } from "@/lib/modules";
import type { Vehicle } from "@/lib/types";

import type { ActionState } from "@/lib/action-state";

/** Wandelt einen Formularwert je Feldtyp in einen DB-tauglichen Wert. */
function parseFieldValue(
  raw: FormDataEntryValue | null,
  type: "date" | "number" | "text" | "decimal",
): string | number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (type === "number") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (type === "decimal") {
    const parsed = Number(value.replace(",", "."));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return value;
}

/** Sammelt alle Modulfelder aus dem Formular in ein Vehicle-Update. */
function collectModuleFields(formData: FormData): Partial<Vehicle> {
  const update: Record<string, string | number | null> = {};

  for (const mod of MODULES) {
    for (const field of mod.fields) {
      // Nur Felder übernehmen, die das Formular tatsächlich gesendet hat —
      // deaktivierte Module dürfen bestehende Werte nicht überschreiben.
      if (!formData.has(field.key)) continue;
      update[field.key] = parseFieldValue(formData.get(field.key), field.type);
    }
  }

  return update as Partial<Vehicle>;
}

export async function createVehicle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const plate = String(formData.get("plate") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();

  if (!name || !plate) {
    return { error: "Name und Kennzeichen sind erforderlich.", success: false };
  }

  const { error } = await supabase.from("vehicles").insert({
    company_id: profile.company_id,
    name,
    plate,
    type: type || null,
    ...collectModuleFields(formData),
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ein Fahrzeug mit diesem Kennzeichen existiert bereits."
          : `Fahrzeug konnte nicht angelegt werden: ${error.message}`,
      success: false,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/fahrzeuge");
  return { error: null, success: true };
}

export async function updateVehicle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };

  const name = String(formData.get("name") ?? "").trim();
  const plate = String(formData.get("plate") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const update: Partial<Vehicle> = collectModuleFields(formData);
  if (name) update.name = name;
  if (plate) update.plate = plate;
  if (formData.has("type")) update.type = type || null;
  if (formData.has("notes")) update.notes = notes || null;

  // Kilometerstand-Änderung mit Zeitstempel versehen.
  if (formData.has("current_mileage") && update.current_mileage != null) {
    update.mileage_updated_at = new Date().toISOString();
  }

  const { error } = await supabase.from("vehicles").update(update).eq("id", vehicleId);

  if (error) {
    return { error: `Speichern fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  revalidatePath("/admin");
  revalidatePath("/mitarbeiter");
  return { error: null, success: true };
}

/** Firmenweite Modul-Grundeinstellungen speichern. */
export async function saveCompanyModules(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const rows = MODULES.map((module) => ({
    company_id: profile.company_id!,
    module_key: module.key,
    enabled: formData.get(`enabled:${module.key}`) === "on",
    required: formData.get(`required:${module.key}`) === "on",
  }));

  const { error } = await supabase
    .from("company_module_settings")
    .upsert(rows, { onConflict: "company_id,module_key" });

  if (error) {
    return { error: `Speichern fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath("/admin/module");
  revalidatePath("/admin");
  revalidatePath("/mitarbeiter");
  return { error: null, success: true };
}

/**
 * Fahrzeug-spezifische Overrides speichern.
 * "erben" schreibt NULL, sodass die Firmeneinstellung wieder greift.
 */
export async function saveVehicleModules(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const vehicleId = String(formData.get("vehicle_id") ?? "");
  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };

  const rows = MODULES.map((module) => {
    const enabled = String(formData.get(`enabled:${module.key}`) ?? "inherit");
    const required = String(formData.get(`required:${module.key}`) ?? "inherit");
    return {
      vehicle_id: vehicleId,
      module_key: module.key,
      enabled: enabled === "inherit" ? null : enabled === "on",
      required: required === "inherit" ? null : required === "on",
    };
  });

  const { error } = await supabase
    .from("vehicle_module_settings")
    .upsert(rows, { onConflict: "vehicle_id,module_key" });

  if (error) {
    return { error: `Speichern fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  return { error: null, success: true };
}

/** Fahrer einem Fahrzeug zuweisen (bestehende Zuordnung wird beendet). */
export async function assignDriver(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const employeeNumberRaw = String(formData.get("employee_number") ?? "").trim();

  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };
  if (!employeeNumberRaw) {
    return { error: "Bitte eine Mitarbeiter-Nummer angeben.", success: false };
  }

  const employeeNumber = Number.parseInt(employeeNumberRaw, 10);
  if (Number.isNaN(employeeNumber)) {
    return { error: "Die Mitarbeiter-Nummer muss eine Zahl sein.", success: false };
  }

  const { data: driver } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", profile.company_id!)
    .eq("employee_number", employeeNumber)
    .maybeSingle();

  if (!driver) {
    return {
      error: `Kein Mitarbeiter mit der Nummer ${employeeNumber} gefunden.`,
      success: false,
    };
  }

  // Aktive Zuordnung dieses Fahrzeugs beenden (max. eine aktive je Fahrzeug).
  await supabase
    .from("vehicle_assignments")
    .update({ ended_on: new Date().toISOString().slice(0, 10) })
    .eq("vehicle_id", vehicleId)
    .is("ended_on", null);

  const { error } = await supabase.from("vehicle_assignments").insert({
    vehicle_id: vehicleId,
    driver_id: driver.id,
  });

  if (error) {
    return { error: `Zuordnung fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  revalidatePath("/admin/mitarbeiter");
  revalidatePath("/admin/fahrzeuge");
  return { error: null, success: true };
}

export async function unassignDriver(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const vehicleId = String(formData.get("vehicle_id") ?? "");
  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };

  const { error } = await supabase
    .from("vehicle_assignments")
    .update({ ended_on: new Date().toISOString().slice(0, 10) })
    .eq("vehicle_id", vehicleId)
    .is("ended_on", null);

  if (error) {
    return { error: `Aufheben fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  revalidatePath("/admin/mitarbeiter");
  return { error: null, success: true };
}

/** Führerscheindaten eines Mitarbeiters pflegen (Admin oder man selbst). */
export async function saveLicense(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Profil fehlt.", success: false };

  const classes = String(formData.get("license_classes") ?? "").trim();
  const expires = String(formData.get("license_expires_on") ?? "").trim();

  const { error } = await supabase
    .from("profiles")
    .update({
      license_classes: classes || null,
      license_expires_on: expires || null,
    })
    .eq("id", profileId);

  if (error) {
    return { error: `Speichern fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath("/admin/mitarbeiter");
  revalidatePath("/profil");
  return { error: null, success: true };
}
