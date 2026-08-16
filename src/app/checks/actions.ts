"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFECTS_BUCKET } from "@/lib/receipts";
import { outcomeFor, severityFor } from "@/lib/checks";
import type { ActionState } from "@/lib/action-state";
import type {
  CheckItem,
  CheckResultStatus,
  DefectSeverity,
  DefectStatus,
  JobStatus,
} from "@/lib/types";

const RESULT_STATUS: CheckResultStatus[] = ["ok", "mangel", "entfaellt"];
const SEVERITIES: DefectSeverity[] = ["gering", "mittel", "kritisch"];
const DEFECT_STATUS: DefectStatus[] = ["offen", "in_arbeit", "erledigt", "verworfen"];
const JOB_STATUS: JobStatus[] = ["geplant", "unterwegs", "erledigt", "abgebrochen"];

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/**
 * Foto zu einem Mangel.
 *
 * Der Pfad beginnt mit der Fahrzeug-ID, weil die Storage-Policy genau daran
 * den Zugriff prüft (siehe Migration 0017). Ein Foto unter einem fremden
 * Fahrzeug abzulegen scheitert deshalb schon in der Datenbank.
 */
async function uploadPhoto(
  vehicleId: string,
  file: FormDataEntryValue | null,
): Promise<{ path: string | null; error: string | null }> {
  if (!(file instanceof File) || file.size === 0) {
    return { path: null, error: null };
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return { path: null, error: "Das Foto ist zu groß (max. 10 MB)." };
  }
  if (file.type && !ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { path: null, error: "Nur Bilder (JPEG/PNG/WEBP/HEIC) sind erlaubt." };
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${vehicleId}/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(DEFECTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });

  if (error) return { path: null, error: "Foto konnte nicht hochgeladen werden." };
  return { path, error: null };
}

/**
 * Abfahrtskontrolle einreichen.
 *
 * Der Check wird als Ganzes gespeichert: erst der Kopf, dann die Antworten,
 * dann für jeden Mangel ein eigener Vorgang. Scheitert etwas dazwischen,
 * wird der halbfertige Check wieder entfernt — ein Nachweis, bei dem die
 * Hälfte der Antworten fehlt, ist schlimmer als gar keiner, weil er
 * vollständig aussieht.
 */
export async function submitCheck(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet.", success: false };

  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const templateId = String(formData.get("template_id") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim();
  const mileageRaw = String(formData.get("mileage") ?? "").trim();

  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };

  let items: CheckItem[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]")) as CheckItem[];
  } catch {
    return { error: "Die Checkliste konnte nicht gelesen werden.", success: false };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Die Checkliste ist leer.", success: false };
  }

  // Antworten einsammeln und prüfen, dass wirklich jeder Punkt beantwortet
  // wurde. Ein Check mit Lücken ist kein Nachweis.
  const answers: Record<string, CheckResultStatus> = {};
  for (const item of items) {
    const value = String(formData.get(`status_${item.key}`) ?? "");
    if (!RESULT_STATUS.includes(value as CheckResultStatus)) {
      return { error: `Punkt „${item.label}" ist noch offen.`, success: false };
    }
    answers[item.key] = value as CheckResultStatus;
  }

  const mileage = mileageRaw ? Number.parseInt(mileageRaw, 10) : null;
  if (mileage !== null && (Number.isNaN(mileage) || mileage < 0)) {
    return { error: "Bitte einen gültigen Kilometerstand angeben.", success: false };
  }

  const { data: check, error: checkError } = await supabase
    .from("vehicle_checks")
    .insert({
      vehicle_id: vehicleId,
      driver_id: user.id,
      template_id: templateId,
      mileage,
      result: outcomeFor(items, answers),
      note: note || null,
    })
    .select("id")
    .single();

  if (checkError || !check) {
    return {
      error: `Check konnte nicht gespeichert werden: ${checkError?.message ?? "unbekannter Fehler"}`,
      success: false,
    };
  }

  const defectItems = items.filter((item) => answers[item.key] === "mangel");

  // Fotos vor dem Schreiben hochladen: schlägt ein Upload fehl, ist noch
  // nichts halb angelegt.
  const photos = new Map<string, string>();
  for (const item of defectItems) {
    const upload = await uploadPhoto(vehicleId, formData.get(`photo_${item.key}`));
    if (upload.error) {
      await supabase.from("vehicle_checks").delete().eq("id", check.id);
      return { error: upload.error, success: false };
    }
    if (upload.path) photos.set(item.key, upload.path);
  }

  const { error: resultsError } = await supabase.from("check_results").insert(
    items.map((item) => ({
      check_id: check.id,
      item_key: item.key,
      label: item.label,
      status: answers[item.key],
      note: String(formData.get(`note_${item.key}`) ?? "").trim() || null,
      photo_path: photos.get(item.key) ?? null,
    })),
  );

  if (resultsError) {
    await supabase.from("vehicle_checks").delete().eq("id", check.id);
    return {
      error: `Antworten konnten nicht gespeichert werden: ${resultsError.message}`,
      success: false,
    };
  }

  if (defectItems.length > 0) {
    // Aus jedem Mangel wird ein eigener Vorgang mit Status. Ohne das bliebe
    // er in einer Liste alter Checks liegen und niemand würde ihn abarbeiten.
    const { error: defectsError } = await supabase.from("defects").insert(
      defectItems.map((item) => ({
        vehicle_id: vehicleId,
        reported_by: user.id,
        check_id: check.id,
        title: item.label,
        description: String(formData.get(`note_${item.key}`) ?? "").trim() || null,
        severity: severityFor(item),
        status: "offen" as DefectStatus,
        photo_path: photos.get(item.key) ?? null,
      })),
    );
    if (defectsError) {
      return {
        error: `Der Check wurde gespeichert, die Mängel aber nicht: ${defectsError.message}`,
        success: false,
      };
    }
  }

  if (mileage !== null) {
    await supabase
      .from("vehicles")
      .update({ current_mileage: mileage, mileage_updated_at: new Date().toISOString() })
      .eq("id", vehicleId);
  }

  revalidatePath("/mitarbeiter");
  revalidatePath("/admin");
  revalidatePath("/admin/checks");
  revalidatePath("/admin/maengel");
  revalidatePath(`/fahrzeuge/${vehicleId}`);
  return { error: null, success: true };
}

/** Einzelnen Mangel melden, ohne vorher eine ganze Checkliste durchzugehen. */
export async function reportDefect(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet.", success: false };

  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const severity = String(formData.get("severity") ?? "mittel");

  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };
  if (!title) return { error: "Bitte kurz beschreiben, was defekt ist.", success: false };
  if (!SEVERITIES.includes(severity as DefectSeverity)) {
    return { error: "Ungültiger Schweregrad.", success: false };
  }

  const upload = await uploadPhoto(vehicleId, formData.get("photo"));
  if (upload.error) return { error: upload.error, success: false };

  const { error } = await supabase.from("defects").insert({
    vehicle_id: vehicleId,
    reported_by: user.id,
    check_id: null,
    title,
    description: description || null,
    severity: severity as DefectSeverity,
    status: "offen",
    photo_path: upload.path,
  });

  if (error) {
    if (upload.path) {
      await supabase.storage.from(DEFECTS_BUCKET).remove([upload.path]);
    }
    return { error: `Mangel konnte nicht gemeldet werden: ${error.message}`, success: false };
  }

  revalidatePath("/mitarbeiter");
  revalidatePath("/admin");
  revalidatePath("/admin/maengel");
  revalidatePath(`/fahrzeuge/${vehicleId}`);
  return { error: null, success: true };
}

/**
 * Mangel bearbeiten — nur für Admins.
 *
 * Geprüft wird das nicht hier, sondern von der RLS-Policy: nur sie kennt die
 * Wahrheit, und zwei Stellen mit derselben Regel laufen irgendwann
 * auseinander.
 */
export async function updateDefect(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const costRaw = String(formData.get("cost") ?? "").trim();

  if (!id) return { error: "Mangel fehlt.", success: false };
  if (!DEFECT_STATUS.includes(status as DefectStatus)) {
    return { error: "Ungültiger Status.", success: false };
  }

  const cost = costRaw ? Number(costRaw.replace(",", ".")) : null;
  if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
    return { error: "Bitte einen gültigen Betrag angeben.", success: false };
  }

  const done = status === "erledigt" || status === "verworfen";

  const { error } = await supabase
    .from("defects")
    .update({
      status: status as DefectStatus,
      resolution: resolution || null,
      due_date: dueDate || null,
      cost,
      resolved_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    return { error: `Mangel konnte nicht geändert werden: ${error.message}`, success: false };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/maengel");
  return { error: null, success: true };
}

/** Auftrag anlegen — nur für Admins (durch RLS erzwungen). */
export async function createJob(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet.", success: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "Keine Firma zugeordnet.", success: false };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const scheduledFor = String(formData.get("scheduled_for") ?? "").trim();
  const vehicleId = String(formData.get("vehicle_id") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? "").trim();

  if (!title) return { error: "Bitte einen Titel angeben.", success: false };

  const { error } = await supabase.from("jobs").insert({
    company_id: profile.company_id,
    vehicle_id: vehicleId || null,
    assigned_to: assignedTo || null,
    title,
    description: description || null,
    address: address || null,
    scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    status: "geplant",
    completed_at: null,
    driver_note: null,
    created_by: user.id,
  });

  if (error) {
    return { error: `Auftrag konnte nicht angelegt werden: ${error.message}`, success: false };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/auftraege");
  revalidatePath("/mitarbeiter");
  return { error: null, success: true };
}

/**
 * Auftrag weiterschalten.
 *
 * Fahrer und Admin nutzen dieselbe Aktion. Dass ein Fahrer dabei nur Status
 * und Notiz ändern kann, erzwingt der Trigger guard_job_driver_fields — hier
 * werden ohnehin nur diese beiden Felder geschrieben.
 */
export async function updateJobStatus(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const driverNote = String(formData.get("driver_note") ?? "").trim();

  if (!id) return { error: "Auftrag fehlt.", success: false };
  if (!JOB_STATUS.includes(status as JobStatus)) {
    return { error: "Ungültiger Status.", success: false };
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      status: status as JobStatus,
      driver_note: driverNote || null,
      completed_at:
        status === "erledigt" || status === "abgebrochen"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", id);

  if (error) {
    return { error: `Auftrag konnte nicht geändert werden: ${error.message}`, success: false };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/auftraege");
  revalidatePath("/mitarbeiter");
  revalidatePath("/auftraege");
  return { error: null, success: true };
}

/** Auftrag löschen — nur Admin (RLS). */
export async function deleteJob(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Auftrag fehlt.", success: false };

  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) {
    return { error: `Auftrag konnte nicht gelöscht werden: ${error.message}`, success: false };
  }

  revalidatePath("/admin/auftraege");
  return { error: null, success: true };
}
