"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireSession } from "@/lib/auth";
import type { Theme } from "@/lib/settings";
import type { TripType } from "@/lib/types";

import type { ActionState } from "@/lib/action-state";

const THEMES: Theme[] = ["light", "dark", "system"];
const TRIP_TYPES: TripType[] = ["dienstlich", "privat", "arbeitsweg"];

/** Persönliche Präferenzen speichern. */
export async function savePreferences(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireSession();
  const supabase = await createClient();

  const theme = String(formData.get("theme") ?? "light");
  const tripType = String(formData.get("default_trip_type") ?? "dienstlich");

  if (!THEMES.includes(theme as Theme)) {
    return { error: "Ungültige Darstellung.", success: false };
  }
  if (!TRIP_TYPES.includes(tripType as TripType)) {
    return { error: "Ungültige Fahrtart.", success: false };
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: profile.id,
      theme: theme as Theme,
      default_trip_type: tripType as TripType,
      email_reminders: formData.get("email_reminders") === "on",
      push_reminders: formData.get("push_reminders") === "on",
      compact_lists: formData.get("compact_lists") === "on",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: `Speichern fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath("/einstellungen");
  return { error: null, success: true };
}

/** Anzeigenamen des eigenen Profils ändern. */
export async function saveProfile(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireSession();
  const supabase = await createClient();

  const fullName = String(formData.get("full_name") ?? "").trim();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", profile.id);

  if (error) {
    return { error: `Speichern fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath("/einstellungen");
  revalidatePath("/profil");
  return { error: null, success: true };
}

/** Passwort ändern (Supabase prüft die aktive Sitzung). */
export async function changePassword(
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
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: `Passwort konnte nicht geändert werden: ${error.message}`, success: false };
  }

  return { error: null, success: true };
}

/** Firmendaten und Vorlaufzeit für Erinnerungen (nur Admin). */
export async function saveCompany(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const leadDays = Number.parseInt(String(formData.get("reminder_lead_days") ?? "30"), 10);

  if (!name) return { error: "Bitte einen Firmennamen angeben.", success: false };
  if (Number.isNaN(leadDays) || leadDays < 1 || leadDays > 365) {
    return { error: "Die Vorlaufzeit muss zwischen 1 und 365 Tagen liegen.", success: false };
  }

  const { error } = await supabase
    .from("companies")
    .update({
      name,
      reminder_lead_days: leadDays,
      contact_email: String(formData.get("contact_email") ?? "").trim() || null,
      contact_address: String(formData.get("contact_address") ?? "").trim() || null,
    })
    .eq("id", profile.company_id!);

  if (error) {
    return { error: `Speichern fehlgeschlagen: ${error.message}`, success: false };
  }

  revalidatePath("/einstellungen");
  revalidatePath("/rechtliches/impressum");
  return { error: null, success: true };
}

/** Rolle eines Teammitglieds ändern (z. B. Nachfolger als Admin ernennen). */
export async function setMemberRole(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const profileId = String(formData.get("profile_id") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!profileId) return { error: "Mitarbeiter fehlt.", success: false };

  const { error } = await supabase.rpc("set_member_role", {
    p_profile_id: profileId,
    p_role: role,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath("/admin/mitarbeiter");
  revalidatePath("/einstellungen");
  return { error: null, success: true };
}

export async function signOutEverywhere() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
