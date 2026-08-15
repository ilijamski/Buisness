import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // PWA-Dateien müssen ohne Anmeldung ausgeliefert werden: Browser holen
    // Manifest und Service Worker ohne Session-Cookie — eine Weiterleitung
    // zum Login würde die Installation verhindern.
    // Der Stripe-Webhook kommt ohne Session und authentifiziert sich über
    // seine Signatur — eine Login-Weiterleitung würde ihn blockieren.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|api/stripe|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
