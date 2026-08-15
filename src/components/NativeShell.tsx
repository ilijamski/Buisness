"use client";

import { useEffect } from "react";
import { savePushSubscription } from "@/app/einstellungen/push-actions";
import { isNative, registerNativePush, syncStatusBar } from "@/lib/native";

/**
 * Initialisiert die nativen Teile, wenn die App als iOS-/Android-App läuft:
 * Statusleiste ans Theme angleichen und Gerät für Push registrieren.
 * Im Browser passiert nichts.
 */
export function NativeShell() {
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!(await isNative()) || cancelled) return;

      const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      await syncStatusBar(theme);

      await registerNativePush(async (token, platform) => {
        // Gerätetoken wird wie ein Web-Push-Abo abgelegt; das Feld `endpoint`
        // trägt bei nativen Geräten den Token.
        await savePushSubscription({
          endpoint: token,
          p256dh: "",
          auth: "",
          platform,
          userAgent: `native-${platform}`,
        });
      });
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
