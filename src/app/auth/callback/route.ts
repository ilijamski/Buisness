import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landepunkt für alle Links aus Supabase-Mails (Passwort-Reset,
 * E-Mail-Bestätigung, Einladung).
 *
 * Supabase hängt entweder `code` (PKCE) oder `token_hash` + `type` an. Beide
 * werden hier gegen eine Sitzung eingetauscht; danach geht es an das Ziel aus
 * `next` — bei einem Reset also zum Formular für das neue Passwort.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  // Nur app-interne Ziele zulassen, damit der Link nicht zum Weiterleiten
  // auf fremde Seiten missbraucht werden kann.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${target}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "email" | "invite" | "magiclink" | "signup",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?fehler=link-ungueltig`);
}
