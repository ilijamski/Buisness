"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EntryType } from "@/lib/types";

export type EntryFormState = { error: string | null; success: boolean };

const ENTRY_TYPES: EntryType[] = ["tanken", "wartung", "schaden"];
const RECEIPTS_BUCKET = "receipts";
const MAX_RECEIPT_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export async function createEntry(
  _prevState: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Nicht angemeldet.", success: false };
  }

  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const type = String(formData.get("type") ?? "");
  const costRaw = String(formData.get("cost") ?? "0").replace(",", ".");
  const note = String(formData.get("note") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const receiptFile = formData.get("receipt");

  if (!vehicleId) {
    return { error: "Bitte ein Fahrzeug auswählen.", success: false };
  }
  if (!ENTRY_TYPES.includes(type as EntryType)) {
    return { error: "Ungültiger Eintragstyp.", success: false };
  }
  const cost = Number(costRaw);
  if (Number.isNaN(cost) || cost < 0) {
    return { error: "Bitte einen gültigen Betrag angeben.", success: false };
  }
  if (!date) {
    return { error: "Bitte ein Datum angeben.", success: false };
  }

  let receiptPath: string | null = null;

  if (receiptFile instanceof File && receiptFile.size > 0) {
    if (receiptFile.size > MAX_RECEIPT_SIZE) {
      return { error: "Beleg-Foto ist zu groß (max. 8 MB).", success: false };
    }
    if (receiptFile.type && !ALLOWED_RECEIPT_TYPES.includes(receiptFile.type)) {
      return { error: "Nur Fotos (JPEG/PNG/WEBP/HEIC) oder PDF sind als Beleg erlaubt.", success: false };
    }

    const ext = receiptFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, receiptFile, {
        contentType: receiptFile.type || undefined,
      });

    if (uploadError) {
      return { error: "Beleg-Foto konnte nicht hochgeladen werden.", success: false };
    }

    receiptPath = path;
  }

  const { error } = await supabase.from("entries").insert({
    vehicle_id: vehicleId,
    type: type as EntryType,
    cost,
    note: note || null,
    date,
    author_id: user.id,
    receipt_path: receiptPath,
  });

  if (error) {
    if (receiptPath) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([receiptPath]);
    }
    return { error: "Eintrag konnte nicht gespeichert werden.", success: false };
  }

  revalidatePath("/mitarbeiter");
  revalidatePath("/admin");
  return { error: null, success: true };
}
