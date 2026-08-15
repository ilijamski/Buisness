"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error: string | null };

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const mode = String(formData.get("mode") ?? "company");
  const companyName = String(formData.get("company_name") ?? "").trim();
  const joinCode = String(formData.get("join_code") ?? "").trim().toUpperCase();
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (mode === "company" && !companyName) {
    return { error: "Bitte einen Firmennamen angeben." };
  }
  if (mode === "employee" && !joinCode) {
    return { error: "Bitte den Firmen-Code eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_or_create_company", {
    p_company_name: mode === "company" ? companyName : null,
    p_join_code: mode === "employee" ? joinCode : null,
    p_full_name: fullName || null,
  });

  if (error) {
    const message = /Unbekannter Firmen-Code/i.test(error.message)
      ? "Dieser Firmen-Code ist unbekannt. Bitte beim Admin nachfragen."
      : `Es hat nicht geklappt: ${error.message}`;
    return { error: message };
  }

  redirect("/");
}
