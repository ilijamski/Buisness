"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Läuft die App bereits im eigenen Fenster statt im Browser-Tab? */
function subscribeDisplayMode(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    query.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function getInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS meldet den Standalone-Modus über eine eigene Eigenschaft.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const noSubscribe = () => () => {};
const getIsIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
/** Auf dem Server ist beides unbekannt — dort gilt „nicht installiert". */
const serverFalse = () => false;

/**
 * Bietet die Installation als App an. Chrome/Edge/Android liefern dafür ein
 * eigenes Event; iOS kennt das nicht, dort steht die manuelle Anleitung.
 */
export function InstallHint() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const installed = useSyncExternalStore(subscribeDisplayMode, getInstalled, serverFalse);
  const isIos = useSyncExternalStore(noSubscribe, getIsIos, serverFalse);

  useEffect(() => {
    // Chrome/Edge liefern das Installations-Event; wir halten es fest, um es
    // erst beim Klick auf den Button auszulösen.
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) {
    return <p className="text-sm text-muted">Die App ist auf diesem Gerät installiert.</p>;
  }

  if (promptEvent) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Installiere den Fuhrpark-Manager als App — dann startet er im eigenen Fenster
          ohne Browserleiste.
        </p>
        <Button
          type="button"
          onClick={async () => {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
          }}
        >
          Als App installieren
        </Button>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted">
      {isIos ? (
        <>
          In Safari auf <strong>Teilen</strong> tippen und{" "}
          <strong>Zum Home-Bildschirm</strong> wählen — danach startet der
          Fuhrpark-Manager wie eine normale App.
        </>
      ) : (
        <>
          Über das Browsermenü lässt sich der Fuhrpark-Manager als App
          installieren („Installieren“ bzw. „Zum Startbildschirm hinzufügen“).
        </>
      )}
    </p>
  );
}
