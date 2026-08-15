"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

/**
 * Testcode erzeugen. Die Berechtigungsprüfung liegt in der SQL-Funktion
 * `create_promo_code` — sie wirft, wenn der Aufrufer kein Plattform-Admin ist.
 */
export async function generatePromoCode(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const days = Number.parseInt(String(formData.get("grants_days") ?? "30"), 10);
  const maxUses = Number.parseInt(String(formData.get("max_uses") ?? "1"), 10);
  const note = String(formData.get("note") ?? "").trim();

  if (Number.isNaN(days) || days < 1 || days > 3650) {
    return { error: "Die Gültigkeit muss zwischen 1 und 3650 Tagen liegen.", success: false };
  }
  if (Number.isNaN(maxUses) || maxUses < 1) {
    return { error: "Die Anzahl der Einlösungen muss mindestens 1 sein.", success: false };
  }

  const { error } = await supabase.rpc("create_promo_code", {
    p_grants_days: days,
    p_max_uses: maxUses,
    p_note: note || null,
    p_expires_at: null,
  });

  if (error) {
    return { error: `Code konnte nicht erzeugt werden: ${error.message}`, success: false };
  }

  revalidatePath("/plattform");
  return { error: null, success: true };
}
