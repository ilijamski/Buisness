"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

/**
 * Schickt den Zurücksetzen-Link. Die Antwort ist bewusst immer gleich —
 * sonst ließe sich über das Formular herausfinden, welche E-Mail-Adressen
 * registriert sind.
 */
export async function requestPasswordReset(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Bitte deine E-Mail-Adresse eingeben.", success: false };
  }

  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${headerList.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/passwort-neu`,
  });

  // Nur echte Zustellprobleme melden, nicht "Adresse unbekannt".
  if (error && error.status && error.status >= 500) {
    return {
      error: "Die E-Mail konnte gerade nicht verschickt werden. Bitte später erneut versuchen.",
      success: false,
    };
  }

  return { error: null, success: true };
}
