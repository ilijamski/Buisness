"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Notice } from "@/components/ui";

/**
 * Anmeldung über Google und Apple.
 *
 * Konten ohne Firmenzugehörigkeit landen nach dem Callback auf /onboarding
 * und wählen dort, ob sie eine Firma gründen oder per Code beitreten —
 * derselbe Ablauf wie bei der Registrierung mit E-Mail.
 *
 * Sign in with Apple ist auf iOS Pflicht, sobald ein anderer
 * Drittanbieter-Login angeboten wird (App-Store-Richtlinie 4.8).
 *
 * Angezeigt wird nur, was in Supabase tatsächlich eingerichtet ist —
 * gesteuert über NEXT_PUBLIC_OAUTH_PROVIDERS (z. B. "google" oder
 * "google,apple"). Ein Knopf für einen nicht eingerichteten Anbieter
 * scheitert mit „Unsupported provider: provider is not enabled", und das
 * erst nach dem Tippen. Wer sich anmelden will, hält das für einen Fehler
 * der App — nicht für eine fehlende Einstellung.
 */
const CONFIGURED = new Set(
  (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean),
);

export function OAuthButtons({ joinCode }: { joinCode?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);

  async function signIn(provider: "google" | "apple") {
    setBusy(provider);
    setError(null);

    const supabase = createClient();
    // Einladungscode über den Callback durchreichen, damit der Beitritt
    // auch beim OAuth-Weg vorausgefüllt ist.
    const next = joinCode ? `/onboarding?code=${encodeURIComponent(joinCode)}` : "/";

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (oauthError) {
      setError(`Anmeldung fehlgeschlagen: ${oauthError.message}`);
      setBusy(null);
    }
  }

  // Ist nichts eingerichtet, entfällt der ganze Block samt Trennlinie.
  if (CONFIGURED.size === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        oder
        <span className="h-px flex-1 bg-border" />
      </div>

      {CONFIGURED.has("google") && (
      <button
        type="button"
        onClick={() => signIn("google")}
        disabled={busy !== null}
        className="flex w-full items-center justify-center gap-2 rounded border border-border-strong bg-bg px-3 py-2.5 text-sm font-medium hover:bg-page disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.8c2.2-2 3.7-5 3.7-8.5z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 5.9-1.1 7.8-2.9l-3.7-2.8c-1 .7-2.3 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5l-3.8 3c1.9 3.8 5.9 6.5 10.5 6.5z"
          />
          <path
            fill="#FBBC05"
            d="M5.3 14.5c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2l-3.8-3C.6 8.7 0 10.3 0 12.3s.6 3.6 1.5 5.2l3.8-3z"
          />
          <path
            fill="#EA4335"
            d="M12 4.8c2.2 0 3.7.9 4.5 1.7l3.3-3.2C17.9 1.4 15.2 0 12 0 7.4 0 3.4 2.7 1.5 6.6l3.8 3c.9-2.9 3.6-4.8 6.7-4.8z"
          />
        </svg>
        {busy === "google" ? "Weiterleiten…" : "Weiter mit Google"}
      </button>
      )}

      {CONFIGURED.has("apple") && (
      <button
        type="button"
        onClick={() => signIn("apple")}
        disabled={busy !== null}
        className="flex w-full items-center justify-center gap-2 rounded border border-border-strong bg-bg px-3 py-2.5 text-sm font-medium hover:bg-page disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M17.05 12.5c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.7 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.3-.1 0-2.2-.8-2.2-3.3zM15 5.2c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z" />
        </svg>
        {busy === "apple" ? "Weiterleiten…" : "Weiter mit Apple"}
      </button>
      )}

      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}
