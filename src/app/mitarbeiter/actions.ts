"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EntryType } from "@/lib/types";

export type EntryFormState = { error: string | null; success: boolean };

const ENTRY_TYPES: EntryType[] = ["tanken", "wartung", "schaden"];

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

  const { error } = await supabase.from("entries").insert({
    vehicle_id: vehicleId,
    type: type as EntryType,
    cost,
    note: note || null,
    date,
    author_id: user.id,
  });

  if (error) {
    return { error: "Eintrag konnte nicht gespeichert werden.", success: false };
  }

  revalidatePath("/mitarbeiter");
  return { error: null, success: true };
}
