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

export function EntryForm({
  vehicleId,
  showReceipt,
  showMileage,
  mileageRequired,
  receiptRequired,
}: {
  vehicleId: string;
  showReceipt: boolean;
  showMileage: boolean;
  mileageRequired: boolean;
  receiptRequired: boolean;
}) {
  const [state, formAction, pending] = useActionState(createEntry, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [queued, setQueued] = useState(false);
  const [nativePhoto, setNativePhoto] = useState<File | null>(null);
  const [hasNativeCamera, setHasNativeCamera] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

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
              className="mt-2 rounded border border-border-strong bg-bg px-3 py-1.5 text-sm font-medium hover:bg-page"
            >
              📷 Mit Kamera aufnehmen
            </button>
          )}
        </Field>
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
