"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RegisterState = { error: string | null };

type Credentials =
  | { ok: false; error: string }
  | { ok: true; email: string; password: string; fullName: string };

function validate(formData: FormData): Credentials {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) {
    return { ok: false, error: "Bitte E-Mail und Passwort angeben." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }
  return { ok: true, email, password, fullName };
}

/** Firmenkonto gründen — der erste Nutzer wird Admin dieser Firma. */
export async function registerCompany(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = validate(formData);
  if (!parsed.ok) return { error: parsed.error };

  const companyName = String(formData.get("company_name") ?? "").trim();
  if (!companyName) return { error: "Bitte einen Firmennamen angeben." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      data: {
        full_name: parsed.fullName,
        company_name: companyName,
      },
    },
  });

  if (error) {
    return { error: `Registrierung fehlgeschlagen: ${error.message}` };
  }

  redirect("/");
}

/** Als Mitarbeiter einer bestehenden Firma per Firmen-Code beitreten. */
export async function registerEmployee(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = validate(formData);
  if (!parsed.ok) return { error: parsed.error };

  const joinCode = String(formData.get("join_code") ?? "").trim().toUpperCase();
  if (!joinCode) return { error: "Bitte den Firmen-Code eingeben." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      data: {
        full_name: parsed.fullName,
        join_code: joinCode,
      },
    },
  });

  if (error) {
    const message = /Unbekannter Firmen-Code|check_violation/i.test(error.message)
      ? "Dieser Firmen-Code ist unbekannt. Bitte beim Admin nachfragen."
      : `Registrierung fehlgeschlagen: ${error.message}`;
    return { error: message };
  }

  redirect("/");
}
