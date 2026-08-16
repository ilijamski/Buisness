"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   Formular zurücksetzen und Plattformerkennung laufen asynchron. Ein Effect mit setState ist dafür der vorgesehene Weg. */

import { useActionState, useEffect, useRef, useState } from "react";
import { createEntry } from "@/app/fahrzeuge/actions";
import { Button, Field, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";
import { compressFormFile } from "@/lib/image";
import { queueEntry, type PendingEntry } from "@/lib/offline-queue";
import { isNative, takePhoto, hapticSuccess } from "@/lib/native";
import { scanReceiptAction } from "@/app/fahrzeuge/scan-actions";
import { idleScanState, type ScanState } from "@/lib/scan-state";
import type { ScanResult } from "@/lib/receipt-scan";

/**
 * Trägt die erkannten Werte in die Formularfelder ein.
 *
 * Leere Felder werden übersprungen, damit eine unvollständige Erkennung
 * nichts überschreibt, was der Fahrer schon selbst eingetippt hat.
 */
function applyScan(form: HTMLFormElement | null, scan: ScanResult) {
  if (!form) return;

  const set = (name: string, value: string) => {
    if (!value) return;
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
      field.value = value;
    } else if (field instanceof HTMLTextAreaElement) {
      // Notizen ergänzen statt ersetzen — der Fahrer hat dort womöglich
      // schon etwas stehen, das der Beleg nicht weiß.
      field.value = field.value ? `${field.value} · ${value}` : value;
    }
  };

  set("cost", scan.cost);
  set("date", scan.date);
  set("type", scan.type);
  set("mileage", scan.mileage);
  set("note", scan.note);
}

export function EntryForm({
  vehicleId,
  showReceipt,
  showMileage,
  mileageRequired,
  receiptRequired,
  scanEnabled = false,
}: {
  vehicleId: string;
  showReceipt: boolean;
  showMileage: boolean;
  mileageRequired: boolean;
  receiptRequired: boolean;
  /** Belegerkennung anbieten (nur wenn serverseitig eingerichtet). */
  scanEnabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createEntry, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [queued, setQueued] = useState(false);
  const [nativePhoto, setNativePhoto] = useState<File | null>(null);
  const [hasNativeCamera, setHasNativeCamera] = useState(false);
  const [scan, setScan] = useState<ScanState>(idleScanState);
  const [scanning, setScanning] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  /**
   * Liest den ausgewählten Beleg aus und füllt die Felder vor.
   *
   * Die Werte werden gesetzt, nicht abgeschickt — der Fahrer sieht sie im
   * Formular und korrigiert, was das Modell falsch gelesen hat. Ein Beleg
   * ist ein Buchungsnachweis; ungeprüfte Zahlen wären hier schlimmer als
   * gar keine.
   */
  async function runScan() {
    const file = nativePhoto ?? receiptInputRef.current?.files?.[0] ?? null;
    if (!file) {
      setScan({ error: "Wähl zuerst ein Foto des Belegs aus.", result: null });
      return;
    }

    setScanning(true);
    setScan(idleScanState);

    try {
      const payload = new FormData();
      payload.set("beleg", file);
      // Dasselbe Verkleinern wie beim Hochladen: spart Zeit und Datenvolumen.
      await compressFormFile(payload, "beleg");

      const next = await scanReceiptAction(idleScanState, payload);
      setScan(next);

      if (next.result) {
        applyScan(formRef.current, next.result);
        await hapticSuccess();
      }
    } catch {
      setScan({
        error: "Der Beleg konnte gerade nicht ausgelesen werden. Trag die Werte bitte von Hand ein.",
        result: null,
      });
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setNativePhoto(null);
    }
  }, [state.success]);

  // In der nativen App die Systemkamera anbieten (bessere Qualität und
  // Bedienung als das Dateifeld im WebView).
  useEffect(() => {
    void isNative().then(setHasNativeCamera);
  }, []);

  // Beleg-Foto vor dem Absenden verkleinern — spart Zeit und Datenvolumen.
  // Ohne Verbindung wandert der Eintrag in die lokale Warteschlange.
  async function submit(formData: FormData) {
    // Ein per Systemkamera aufgenommenes Foto ersetzt das Dateifeld.
    if (nativePhoto) formData.set("receipt", nativePhoto);
    await compressFormFile(formData, "receipt");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const fields: Record<string, string> = {};
      let receipt: PendingEntry["receipt"];

      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          if (value.size > 0) {
            receipt = { name: value.name, type: value.type, blob: value };
          }
        } else {
          fields[key] = value;
        }
      }

      await queueEntry({
        createdAt: Date.now(),
        vehicleId,
        vehicleName: "",
        fields,
        receipt,
      });

      setQueued(true);
      formRef.current?.reset();
      return;
    }

    setQueued(false);
    formAction(formData);
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <input type="hidden" name="vehicle_id" value={vehicleId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Art" required>
          <select name="type" required defaultValue="tanken">
            <option value="tanken">Tanken</option>
            <option value="wartung">Wartung</option>
            <option value="schaden">Schaden</option>
            <option value="reifen">Reifen</option>
            <option value="bremsen">Bremsen</option>
            <option value="inspektion">Inspektion</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
        </Field>

        <Field label="Kosten (€)" required>
          <input name="cost" type="number" step="0.01" min="0" required placeholder="0,00" />
        </Field>

        <Field label="Datum" required>
          <input name="date" type="date" required defaultValue={today} />
        </Field>

        {showMileage && (
          <Field label="Kilometerstand" required={mileageRequired}>
            <input name="mileage" type="number" min="0" required={mileageRequired} />
          </Field>
        )}
      </div>

      <Field label="Notiz">
        <textarea name="note" rows={2} placeholder="z. B. Tankstelle, Schadenshergang…" />
      </Field>

      {showReceipt && (
        <Field
          label="Beleg-Foto"
          required={receiptRequired && !nativePhoto}
          hint={
            nativePhoto
              ? `Aufgenommen: ${nativePhoto.name}`
              : "Foto oder PDF, max. 10 MB."
          }
        >
          <input
            ref={receiptInputRef}
            name="receipt"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            required={receiptRequired && !nativePhoto}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {hasNativeCamera && (
              <button
                type="button"
                onClick={async () => {
                  const photo = await takePhoto();
                  if (photo) {
                    setNativePhoto(photo);
                    await hapticSuccess();
                  }
                }}
                className="rounded border border-border-strong bg-bg px-3 py-1.5 text-sm font-medium hover:bg-page"
              >
                📷 Mit Kamera aufnehmen
              </button>
            )}

            {scanEnabled && (
              <button
                type="button"
                onClick={runScan}
                disabled={scanning}
                className="rounded border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
              >
                {scanning ? "Wird gelesen…" : "Beleg auslesen"}
              </button>
            )}
          </div>

          {scanEnabled && (
            <p className="mt-1.5 text-xs text-muted">
              Foto aufnehmen, auslesen lassen, Werte prüfen — Betrag, Datum und
              Menge werden automatisch eingetragen.
            </p>
          )}
        </Field>
      )}

      {scan.error && <Notice kind="error">{scan.error}</Notice>}

      {scan.result && !scan.error && (
        <Notice kind={scan.result.confidence === "hoch" ? "success" : "info"}>
          {scan.result.problem ? (
            scan.result.problem
          ) : scan.result.confidence === "hoch" ? (
            <>Beleg gelesen. Wirf trotzdem einen Blick auf den Betrag, bevor du speicherst.</>
          ) : (
            <>
              Beleg gelesen, aber die Aufnahme war schwer lesbar
              {scan.result.confidence === "niedrig" ? " (geringe Sicherheit)" : ""}. Prüf die
              Werte bitte genau.
            </>
          )}
        </Notice>
      )}

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Eintrag gespeichert.</Notice>}
      {queued && (
        <Notice kind="info">
          Kein Netz — der Eintrag ist lokal gespeichert und wird automatisch
          übertragen, sobald du wieder online bist.
        </Notice>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Eintrag speichern"}
      </Button>
    </form>
  );
}
