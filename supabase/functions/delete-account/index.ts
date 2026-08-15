// Fuhrpark-Manager: Konto endgültig löschen (DSGVO Art. 17).
//
// Der Aufrufer weist sich mit seinem eigenen JWT aus; gelöscht wird immer nur
// das eigene Konto — die User-ID kommt aus dem verifizierten Token, nie aus
// dem Request-Body.
//
// Ablauf:
//   1. Token prüfen und Nutzer bestimmen
//   2. can_delete_own_account() fragen (blockt den letzten Admin einer Firma
//      mit weiteren Mitgliedern)
//   3. Hochgeladene Belege des Nutzers aus dem Storage entfernen
//   4. Ist es das letzte Firmenmitglied, die Firma löschen (Fahrzeuge,
//      Einträge, Dokumente hängen per ON DELETE CASCADE daran)
//   5. Auth-Nutzer löschen; das Profil verschwindet per Cascade

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Löscht rekursiv alle Dateien unter einem Storage-Präfix. */
async function removeFolder(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
) {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data || data.length === 0) return;

  const paths = data.filter((item) => item.id !== null).map((item) => `${prefix}/${item.name}`);
  if (paths.length > 0) {
    await supabase.storage.from(bucket).remove(paths);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Supabase-Umgebungsvariablen fehlen.");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "Nicht angemeldet." }, 401);
    }

    // Identität aus dem Token bestimmen — nicht aus dem Body.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Ungültige Sitzung." }, 401);
    }

    // Vorabprüfung mit den Rechten des Aufrufers.
    const { data: check, error: checkError } = await userClient.rpc("can_delete_own_account");
    if (checkError) {
      return json({ error: `Prüfung fehlgeschlagen: ${checkError.message}` }, 500);
    }

    const verdict = check as { allowed: boolean; reason?: string; deletes_company?: boolean };
    if (!verdict?.allowed) {
      return json({ error: verdict?.reason ?? "Konto kann nicht gelöscht werden." }, 409);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Firmenzugehörigkeit vor dem Löschen merken.
    const { data: profile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    // Belege des Nutzers entfernen (Ordner ist nach der User-ID benannt).
    await removeFolder(admin, "receipts", user.id);

    // Letztes Mitglied: Firma und alle daran hängenden Daten löschen.
    if (verdict.deletes_company && profile?.company_id) {
      const { data: vehicles } = await admin
        .from("vehicles")
        .select("id")
        .eq("company_id", profile.company_id);

      for (const vehicle of vehicles ?? []) {
        await removeFolder(admin, "documents", vehicle.id as string);
      }

      const { error: companyError } = await admin
        .from("companies")
        .delete()
        .eq("id", profile.company_id);

      if (companyError) {
        return json({ error: `Firma konnte nicht gelöscht werden: ${companyError.message}` }, 500);
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return json({ error: `Konto konnte nicht gelöscht werden: ${deleteError.message}` }, 500);
    }

    return json({ deleted: true, company_deleted: verdict.deletes_company === true }, 200);
  } catch (error) {
    console.error(error);
    return json({ error: String(error) }, 500);
  }
});
