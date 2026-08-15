"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   Abo-Status kommt asynchron vom Service Worker. Ein Effect mit setState ist dafür der vorgesehene Weg. */

import { useCallback, useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "@/app/einstellungen/push-actions";
import { Button, Notice } from "@/components/ui";

/** Base64-URL des VAPID-Schlüssels in das von der Push-API erwartete Format. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);

  // Eigenen ArrayBuffer anlegen: die Push-API akzeptiert keinen
  // SharedArrayBuffer, den Uint8Array.from im Typ zulassen würde.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function toBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  return window.btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);

  const check = useCallback(async () => {
    const canPush = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(canPush);

    // iOS erlaubt Web Push nur, wenn die App zum Home-Bildschirm
    // hinzugefügt wurde.
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(!iOS || standalone);

    if (!canPush) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const existing = await registration?.pushManager.getSubscription();
    setSubscribed(!!existing);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  async function subscribe() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Benachrichtigungen wurden im Browser abgelehnt.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const result = await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: toBase64(subscription.getKey("p256dh")),
        auth: toBase64(subscription.getKey("auth")),
        userAgent: navigator.userAgent,
      });

      if (result.error) {
        setMessage(result.error);
        return;
      }
      setSubscribed(true);
      setMessage("Push-Benachrichtigungen sind aktiv.");
    } catch {
      setMessage("Push konnte nicht aktiviert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage("Push-Benachrichtigungen deaktiviert.");
    } finally {
      setBusy(false);
    }
  }

  if (!vapidPublicKey) {
    return (
      <Notice kind="info">
        Push ist auf diesem Server nicht eingerichtet (VAPID-Schlüssel fehlt).
      </Notice>
    );
  }

  if (!supported) {
    return <Notice kind="info">Dieser Browser unterstützt keine Push-Benachrichtigungen.</Notice>;
  }

  if (!isStandalone) {
    return (
      <Notice kind="info">
        Auf dem iPhone funktioniert Push erst, wenn die App über{" "}
        <strong>Teilen → Zum Home-Bildschirm</strong> installiert wurde.
      </Notice>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Meldung aufs Gerät, wenn eine Frist fällig wird — zusätzlich oder statt
        der E-Mail.
      </p>

      {message && <Notice kind={subscribed ? "success" : "info"}>{message}</Notice>}

      <Button
        type="button"
        variant={subscribed ? "secondary" : "primary"}
        disabled={busy}
        onClick={subscribed ? unsubscribe : subscribe}
      >
        {busy
          ? "Moment…"
          : subscribed
            ? "Push auf diesem Gerät deaktivieren"
            : "Push auf diesem Gerät aktivieren"}
      </Button>
    </div>
  );
}
