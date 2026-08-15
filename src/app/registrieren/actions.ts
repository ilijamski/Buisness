"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * `sentTo` ist gesetzt, wenn die Registrierung eine Bestätigungsmail ausgelöst
 * hat. Dann besteht noch keine Sitzung — das Formular zeigt stattdessen den
 * Hinweis auf das Postfach.
 */
export type RegisterState = { error: string | null; sentTo?: string | null };

/**
 * Ziel des Links in der Bestätigungsmail.
 *
 * `/auth/callback` tauscht das Einmal-Token gegen eine Sitzung und leitet
 * danach weiter — wer auf den Link klickt, ist also direkt angemeldet. Ohne
 * diese Angabe schickt Supabase an die Site-URL, wo niemand das Token
 * einlöst und der Klick wirkungslos verpufft.
 */
async function confirmationTarget(): Promise<string> {
  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${headerList.get("host") ?? "localhost:3000"}`;

  return `${origin}/auth/callback`;
}

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
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      emailRedirectTo: await confirmationTarget(),
      data: {
        full_name: parsed.fullName,
        company_name: companyName,
      },
    },
  });

  if (error) {
    return { error: `Registrierung fehlgeschlagen: ${error.message}` };
  }

  // Ist die E-Mail-Bestätigung aktiv, liefert signUp keine Sitzung: erst der
  // Klick im Postfach meldet an.
  if (!data.session) {
    return { error: null, sentTo: parsed.email };
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
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      emailRedirectTo: await confirmationTarget(),
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

  if (!data.session) {
    return { error: null, sentTo: parsed.email };
  }

  redirect("/");
}
