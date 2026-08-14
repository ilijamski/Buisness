"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VehicleFormState = { error: string | null; success: boolean };

export async function createVehicle(
  _prevState: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const plate = String(formData.get("plate") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const tuvDate = String(formData.get("tuv_date") ?? "").trim();

  if (!name || !plate) {
    return { error: "Name und Kennzeichen sind erforderlich.", success: false };
  }

  const { error } = await supabase.from("vehicles").insert({
    name,
    plate,
    type: type || null,
    tuv_date: tuvDate || null,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Ein Fahrzeug mit diesem Kennzeichen existiert bereits."
      : "Fahrzeug konnte nicht angelegt werden.";
    return { error: message, success: false };
  }

  revalidatePath("/admin");
  return { error: null, success: true };
}
