"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   QR-Erzeugung ist asynchron und läuft außerhalb von React. Ein Effect mit setState ist dafür der vorgesehene Weg. */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button, Notice } from "@/components/ui";

/**
 * Einladung für Mitarbeiter: Link mit vorausgefülltem Firmen-Code,
 * QR-Code zum Abfotografieren und Teilen über das System-Menü.
 */
export function InviteCard({ joinCode }: { joinCode: string }) {
  const [inviteUrl, setInviteUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/registrieren?code=${encodeURIComponent(joinCode)}`;
    setInviteUrl(url);

    QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [joinCode]);

  async function share() {
    const text = `Tritt unserem Fuhrpark-Manager bei: ${inviteUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Fuhrpark-Manager", text, url: inviteUrl });
        return;
      } catch {
        // Abgebrochen — dann eben kopieren.
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Mitarbeiter scannen den Code oder öffnen den Link — der Firmen-Code ist
        dann schon ausgefüllt.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- data:-URL, kein Optimierer nötig
          <img
            src={qrDataUrl}
            alt={`QR-Code für den Beitritt mit Code ${joinCode}`}
            className="h-40 w-40 rounded border border-border bg-white p-1"
          />
        )}

        <div className="space-y-2">
          <div>
            <p className="text-xs text-muted">Firmen-Code</p>
            <p className="font-mono text-lg tracking-widest">{joinCode}</p>
          </div>
          <Button type="button" onClick={share}>
            Einladung teilen
          </Button>
        </div>
      </div>

      {inviteUrl && (
        <p className="rounded border border-border bg-page px-2 py-1.5 font-mono text-xs break-all text-muted">
          {inviteUrl}
        </p>
      )}

      {copied && <Notice kind="success">Link kopiert.</Notice>}
    </div>
  );
}
