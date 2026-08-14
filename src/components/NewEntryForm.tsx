"use client";

import { useActionState, useEffect, useRef } from "react";
import { createEntry, type EntryFormState } from "@/app/mitarbeiter/actions";
import type { Vehicle } from "@/lib/types";

const initialState: EntryFormState = { error: null, success: false };
const RECEIPT_PLACEHOLDER = "Foto aufnehmen oder Datei wählen…";

export function NewEntryForm({ vehicles }: { vehicles: Vehicle[] }) {
  const [state, formAction, pending] = useActionState(createEntry, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const receiptNameRef = useRef<HTMLSpanElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      if (receiptNameRef.current) {
        receiptNameRef.current.textContent = RECEIPT_PLACEHOLDER;
      }
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="text-sm font-semibold text-fg">Neuer Eintrag</h2>

      <div className="space-y-1.5">
        <label htmlFor="vehicle_id" className="block text-xs font-medium text-muted">
          Fahrzeug
        </label>
        <select
          id="vehicle_id"
          name="vehicle_id"
          required
          defaultValue=""
          className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="" disabled>
            Fahrzeug wählen…
          </option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.plate})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="type" className="block text-xs font-medium text-muted">
            Typ
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue="tanken"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="tanken">Tanken</option>
            <option value="wartung">Wartung</option>
            <option value="schaden">Schaden</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cost" className="block text-xs font-medium text-muted">
            Kosten (€)
          </label>
          <input
            id="cost"
            name="cost"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0,00"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="date" className="block text-xs font-medium text-muted">
          Datum
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={today}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="note" className="block text-xs font-medium text-muted">
          Notiz (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          placeholder="z. B. Ölwechsel, Tankstelle, Schadenshergang…"
          className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="receipt" className="block text-xs font-medium text-muted">
          Beleg-Foto (optional)
        </label>
        <label
          htmlFor="receipt"
          className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-bg px-3 py-2.5 text-sm text-muted transition hover:border-accent"
        >
          <span ref={receiptNameRef} className="truncate">
            {RECEIPT_PLACEHOLDER}
          </span>
          <span className="shrink-0 rounded-md bg-surface-2 px-2 py-1 text-xs text-fg">
            Auswählen
          </span>
        </label>
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            if (receiptNameRef.current) {
              receiptNameRef.current.textContent =
                e.target.files?.[0]?.name ?? RECEIPT_PLACEHOLDER;
            }
          }}
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Eintrag gespeichert.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || vehicles.length === 0}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Speichern…" : "Eintrag speichern"}
      </button>
      {vehicles.length === 0 && (
        <p className="text-xs text-muted">Noch keine Fahrzeuge vorhanden.</p>
      )}
    </form>
  );
}
