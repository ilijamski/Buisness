"use client";

import { useActionState, useEffect, useRef } from "react";
import { createVehicle, type VehicleFormState } from "@/app/admin/actions";

const initialState: VehicleFormState = { error: null, success: false };

export function AddVehicleForm() {
  const [state, formAction, pending] = useActionState(createVehicle, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="text-sm font-semibold text-fg">Fahrzeug hinzufügen</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-xs font-medium text-muted">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Transporter 1"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="plate" className="block text-xs font-medium text-muted">
            Kennzeichen
          </label>
          <input
            id="plate"
            name="plate"
            required
            placeholder="B-AB 1234"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="type" className="block text-xs font-medium text-muted">
            Typ (optional)
          </label>
          <input
            id="type"
            name="type"
            placeholder="PKW, Transporter, LKW…"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tuv_date" className="block text-xs font-medium text-muted">
            TÜV-Datum (optional)
          </label>
          <input
            id="tuv_date"
            name="tuv_date"
            type="date"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Fahrzeug angelegt.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition hover:bg-accent-hover disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Speichern…" : "Fahrzeug speichern"}
      </button>
    </form>
  );
}
