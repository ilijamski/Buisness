import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Rechtstexte und die Passwort-Wiederherstellung müssen auch ohne
  // Anmeldung erreichbar sein.
  //
  // `/passwort-neu` gehört ausdrücklich dazu: Wer aus der Reset-Mail kommt,
  // hat noch keine Sitzung — die entsteht erst auf dieser Seite aus dem
  // Token im Link. Fehlte der Pfad hier, würde genau der Nutzer, der sein
  // Passwort zurücksetzen will, zum Login geschickt, wo er sich mangels
  // Passwort nicht anmelden kann. Der Link führte damit im Kreis.
  const isPublic =
    path === "/login" ||
    path === "/registrieren" ||
    path === "/passwort-vergessen" ||
    path === "/passwort-neu" ||
    path.startsWith("/auth") ||
    path.startsWith("/rechtliches");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/registrieren")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
