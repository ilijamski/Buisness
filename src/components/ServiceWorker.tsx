"use client";

import { useEffect } from "react";

/**
 * Registriert den Service Worker, damit die App installierbar ist und offline
 * eine Hinweisseite statt eines Browserfehlers zeigt.
 * Im Dev-Modus bewusst deaktiviert, damit Hot Reload nicht mit dem Cache kollidiert.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registrierung ist optional — die App funktioniert auch ohne.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
