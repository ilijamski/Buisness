"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

export async function setNewPassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen lang sein.", success: false };
  }
  if (password !== confirm) {
    return { error: "Die beiden Passwörter stimmen nicht überein.", success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ohne gültige Sitzung ist der Link abgelaufen oder wurde bereits benutzt.
  if (!user) {
    return {
      error: "Der Link ist abgelaufen. Bitte fordere einen neuen an.",
      success: false,
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: `Passwort konnte nicht gesetzt werden: ${error.message}`, success: false };
  }

  redirect("/");
}
