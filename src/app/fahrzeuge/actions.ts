"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RECEIPTS_BUCKET, DOCUMENTS_BUCKET } from "@/lib/receipts";
import type { DocumentKind, EntryType, TripType } from "@/lib/types";

import type { ActionState } from "@/lib/action-state";

const ENTRY_TYPES: EntryType[] = [
  "tanken",
  "wartung",
  "schaden",
  "reifen",
  "bremsen",
  "inspektion",
  "sonstiges",
];
const TRIP_TYPES: TripType[] = ["dienstlich", "privat", "arbeitsweg"];
const DOCUMENT_KINDS: DocumentKind[] = [
  "fahrzeugschein",
  "fahrzeugbrief",
  "versicherung",
  "leasingvertrag",
  "nachweis",
  "sonstiges",
];

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

type UploadResult = { path: string | null; error: string | null };

async function uploadFile(
  bucket: string,
  prefix: string,
  file: FormDataEntryValue | null,
): Promise<UploadResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { path: null, error: null };
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return { path: null, error: "Die Datei ist zu groß (max. 10 MB)." };
  }
  if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return { path: null, error: "Nur Bilder (JPEG/PNG/WEBP/HEIC) oder PDF sind erlaubt." };
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${prefix}/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type || undefined });

  if (error) {
    return { path: null, error: "Datei konnte nicht hochgeladen werden." };
  }
  return { path, error: null };
}

/** Eintrag (Tanken, Wartung, Schaden, …) inkl. optionalem Beleg. */
export async function createEntry(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet.", success: false };

  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const type = String(formData.get("type") ?? "");
  const cost = Number(String(formData.get("cost") ?? "0").replace(",", "."));
  const note = String(formData.get("note") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const mileageRaw = String(formData.get("mileage") ?? "").trim();
  const litersRaw = String(formData.get("liters") ?? "").trim();
  const fuelType = String(formData.get("fuel_type") ?? "").trim();

  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };
  if (!ENTRY_TYPES.includes(type as EntryType)) {
    return { error: "Ungültiger Eintragstyp.", success: false };
  }
  if (Number.isNaN(cost) || cost < 0) {
    return { error: "Bitte einen gültigen Betrag angeben.", success: false };
  }
  if (!date) return { error: "Bitte ein Datum angeben.", success: false };

  // Liter und Zählerstand werden mitgeschrieben, nicht nur in die Notiz
  // gepackt: nur als Zahl lassen sich daraus Verbrauch und CO2 rechnen.
  const liters = litersRaw ? Number(litersRaw.replace(",", ".")) : null;
  if (liters !== null && (Number.isNaN(liters) || liters <= 0)) {
    return { error: "Bitte eine gültige Literzahl angeben.", success: false };
  }

  const mileage = mileageRaw ? Number.parseInt(mileageRaw, 10) : null;
  if (mileage !== null && (Number.isNaN(mileage) || mileage < 0)) {
    return { error: "Bitte einen gültigen Kilometerstand angeben.", success: false };
  }

  const upload = await uploadFile(RECEIPTS_BUCKET, user.id, formData.get("receipt"));
  if (upload.error) return { error: upload.error, success: false };

  const { error } = await supabase.from("entries").insert({
    vehicle_id: vehicleId,
    type: type as EntryType,
    cost,
    note: note || null,
    date,
    author_id: user.id,
    receipt_path: upload.path,
    liters,
    fuel_type: fuelType || null,
    mileage,
  });

  if (error) {
    if (upload.path) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([upload.path]);
    }
    return { error: `Eintrag konnte nicht gespeichert werden: ${error.message}`, success: false };
  }

  // Kilometerstand am Fahrzeug mitpflegen, wenn er erfasst wurde.
  if (mileage !== null) {
    await supabase
      .from("vehicles")
      .update({ current_mileage: mileage, mileage_updated_at: new Date().toISOString() })
      .eq("id", vehicleId);
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  revalidatePath("/mitarbeiter");
  revalidatePath("/admin");
  return { error: null, success: true };
}

/**
 * Eigenen Eintrag korrigieren oder löschen.
 * Ob das erlaubt ist, entscheidet die RLS-Policy (eigener Eintrag, max. 24 h alt)
 * — hier wird nichts zusätzlich geprüft, damit es nur eine Wahrheit gibt.
 */
export async function updateEntry(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const entryId = String(formData.get("entry_id") ?? "");
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const cost = Number(String(formData.get("cost") ?? "0").replace(",", "."));
  const note = String(formData.get("note") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const type = String(formData.get("type") ?? "");

  if (!entryId) return { error: "Eintrag fehlt.", success: false };
  if (!ENTRY_TYPES.includes(type as EntryType)) {
    return { error: "Ungültiger Eintragstyp.", success: false };
  }
  if (Number.isNaN(cost) || cost < 0) {
    return { error: "Bitte einen gültigen Betrag angeben.", success: false };
  }

  const { data, error } = await supabase
    .from("entries")
    .update({ type: type as EntryType, cost, note: note || null, date })
    .eq("id", entryId)
    .select("id");

  if (error) {
    return { error: `Änderung fehlgeschlagen: ${error.message}`, success: false };
  }
  // Leeres Ergebnis heißt: die Policy hat die Zeile ausgefiltert.
  if (!data || data.length === 0) {
    return {
      error: "Dieser Eintrag kann nicht mehr geändert werden. Bitte wende dich an einen Admin.",
      success: false,
    };
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  return { error: null, success: true };
}

export async function deleteEntry(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const entryId = String(formData.get("entry_id") ?? "");
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  if (!entryId) return { error: "Eintrag fehlt.", success: false };

  const { data, error } = await supabase
    .from("entries")
    .delete()
    .eq("id", entryId)
    .select("id");

  if (error) {
    return { error: `Löschen fehlgeschlagen: ${error.message}`, success: false };
  }
  if (!data || data.length === 0) {
    return {
      error: "Dieser Eintrag kann nicht mehr gelöscht werden. Bitte wende dich an einen Admin.",
      success: false,
    };
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  revalidatePath("/admin");
  return { error: null, success: true };
}

export async function deleteLogbookEntry(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const tripId = String(formData.get("trip_id") ?? "");
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  if (!tripId) return { error: "Fahrt fehlt.", success: false };

  const { data, error } = await supabase
    .from("logbook_entries")
    .delete()
    .eq("id", tripId)
    .select("id");

  if (error) {
    return { error: `Löschen fehlgeschlagen: ${error.message}`, success: false };
  }
  if (!data || data.length === 0) {
    return {
      error: "Diese Fahrt kann nicht mehr gelöscht werden. Bitte wende dich an einen Admin.",
      success: false,
    };
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  return { error: null, success: true };
}

/** Fahrtenbucheintrag (dienstlich / privat / Arbeitsweg). */
export async function createLogbookEntry(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet.", success: false };

  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const startMileage = Number.parseInt(String(formData.get("start_mileage") ?? ""), 10);
  const endMileage = Number.parseInt(String(formData.get("end_mileage") ?? ""), 10);
  const tripType = String(formData.get("trip_type") ?? "dienstlich");

  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };
  if (!date) return { error: "Bitte ein Datum angeben.", success: false };
  if (Number.isNaN(startMileage) || Number.isNaN(endMileage)) {
    return { error: "Bitte Start- und End-Kilometerstand angeben.", success: false };
  }
  if (endMileage < startMileage) {
    return { error: "Der End-Kilometerstand darf nicht kleiner als der Start sein.", success: false };
  }
  if (!TRIP_TYPES.includes(tripType as TripType)) {
    return { error: "Ungültige Fahrtart.", success: false };
  }

  const { error } = await supabase.from("logbook_entries").insert({
    vehicle_id: vehicleId,
    driver_id: user.id,
    date,
    start_mileage: startMileage,
    end_mileage: endMileage,
    trip_type: tripType as TripType,
    start_location: String(formData.get("start_location") ?? "").trim() || null,
    end_location: String(formData.get("end_location") ?? "").trim() || null,
    purpose: String(formData.get("purpose") ?? "").trim() || null,
  });

  if (error) {
    return { error: `Fahrt konnte nicht gespeichert werden: ${error.message}`, success: false };
  }

  // Der End-Kilometerstand ist zugleich der aktuelle Stand des Fahrzeugs.
  await supabase
    .from("vehicles")
    .update({ current_mileage: endMileage, mileage_updated_at: new Date().toISOString() })
    .eq("id", vehicleId);

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  return { error: null, success: true };
}

/** Werkstatt-/Reparatureintrag (nur Admin, per RLS erzwungen). */
export async function createWorkshopRecord(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet.", success: false };

  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const cost = Number(String(formData.get("cost") ?? "0").replace(",", "."));
  const mileageRaw = String(formData.get("mileage") ?? "").trim();

  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };
  if (!description) return { error: "Bitte beschreiben, was gemacht wurde.", success: false };
  if (Number.isNaN(cost) || cost < 0) {
    return { error: "Bitte einen gültigen Betrag angeben.", success: false };
  }

  const { error } = await supabase.from("workshop_records").insert({
    vehicle_id: vehicleId,
    date: date || new Date().toISOString().slice(0, 10),
    workshop: String(formData.get("workshop") ?? "").trim() || null,
    description,
    mileage: mileageRaw ? Number.parseInt(mileageRaw, 10) : null,
    cost,
    invoice_path: null,
    created_by: user.id,
  });

  if (error) {
    return { error: `Speichern fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  return { error: null, success: true };
}

/** Fahrzeugdokument hochladen (Fahrzeugschein, Nachweise, …). */
export async function uploadDocument(
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
  const kind = String(formData.get("kind") ?? "sonstiges");
  const validUntil = String(formData.get("valid_until") ?? "").trim();

  if (!vehicleId) return { error: "Fahrzeug fehlt.", success: false };
  if (!title) return { error: "Bitte einen Titel angeben.", success: false };
  if (!DOCUMENT_KINDS.includes(kind as DocumentKind)) {
    return { error: "Ungültige Dokumentart.", success: false };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte eine Datei auswählen.", success: false };
  }

  // Pfad beginnt mit der Fahrzeug-ID — die Storage-Policy leitet daraus den
  // Zugriff ab (Admin oder zugewiesener Fahrer).
  const upload = await uploadFile(DOCUMENTS_BUCKET, vehicleId, file);
  if (upload.error) return { error: upload.error, success: false };

  const { error } = await supabase.from("documents").insert({
    vehicle_id: vehicleId,
    kind: kind as DocumentKind,
    title,
    file_path: upload.path!,
    valid_until: validUntil || null,
    uploaded_by: user.id,
  });

  if (error) {
    if (upload.path) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([upload.path]);
    }
    return { error: `Dokument konnte nicht gespeichert werden: ${error.message}`, success: false };
  }

  revalidatePath(`/fahrzeuge/${vehicleId}`);
  return { error: null, success: true };
}
