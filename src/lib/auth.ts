import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveModules, type ModuleConfig } from "@/lib/modules";
import { accessState } from "@/lib/billing";
import type { Company, Profile } from "@/lib/types";

export type Session = {
  profile: Profile;
  company: Company | null;
};

/**
 * Lädt Profil und Firma des angemeldeten Nutzers.
 * Ohne Anmeldung -> /login, ohne Firmenzugehörigkeit -> /registrieren,
 * damit ein Konto ohne Firmenbezug nicht in einer leeren App landet.
 */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Konto ohne Firmenzugehörigkeit (z. B. ohne Firmenangabe registriert):
  // Firma nachträglich anlegen oder beitreten.
  if (!profile || !profile.company_id) {
    redirect("/onboarding");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", profile.company_id)
    .maybeSingle();

  return { profile, company: company ?? null };
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.profile.role !== "admin") {
    redirect("/mitarbeiter");
  }
  return session;
}

/**
 * Wie requireSession, verlangt zusätzlich einen gültigen Zugang
 * (Probemonat, Testcode oder bezahltes Abo).
 *
 * Ist er abgelaufen, geht es zur Abo-Seite — dort bleibt der Datenexport
 * erreichbar, damit niemand von seinen eigenen Daten ausgesperrt wird.
 */
export async function requireActiveSession(): Promise<Session> {
  const session = await requireSession();

  if (!accessState(session.company).hasAccess) {
    redirect("/abo?abgelaufen=1");
  }

  return session;
}

export async function requireActiveAdmin(): Promise<Session> {
  const session = await requireActiveSession();
  if (session.profile.role !== "admin") {
    redirect("/mitarbeiter");
  }
  return session;
}

/** Firmenweite Modul-Grundeinstellung. */
export async function loadCompanyModules(companyId: string): Promise<ModuleConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_module_settings")
    .select("module_key, enabled, required")
    .eq("company_id", companyId);

  return resolveModules(data ?? []);
}

/** Modul-Konfiguration für ein Fahrzeug inkl. Fahrzeug-Overrides. */
export async function loadVehicleModules(
  companyId: string,
  vehicleId: string,
): Promise<ModuleConfig> {
  const supabase = await createClient();
  const [{ data: companySettings }, { data: vehicleSettings }] = await Promise.all([
    supabase
      .from("company_module_settings")
      .select("module_key, enabled, required")
      .eq("company_id", companyId),
    supabase
      .from("vehicle_module_settings")
      .select("module_key, enabled, required")
      .eq("vehicle_id", vehicleId),
  ]);

  return resolveModules(companySettings ?? [], vehicleSettings ?? []);
}
