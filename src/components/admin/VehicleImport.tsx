"use client";

import { useActionState } from "react";
import { importVehicles } from "@/app/admin/actions";
import { Button, Notice } from "@/components/ui";
import { idleImportState } from "@/lib/import-state";

/**
 * CSV-Import für Fahrzeuge.
 *
 * Der Bericht danach ist ausführlicher als üblich — bei einem Massenimport
 * muss nachvollziehbar sein, was übernommen wurde und was nicht. Eine
 * Erfolgsmeldung allein ließe den Betrieb im Unklaren darüber, ob wirklich
 * alle zwanzig Fahrzeuge angekommen sind.
 */
export function VehicleImport() {
  const [state, formAction, pending] = useActionState(importVehicles, idleImportState);

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm text-muted">
        <p>
          Erste Zeile sind die Spaltenüberschriften. <strong>Bezeichnung</strong> und{" "}
          <strong>Kennzeichen</strong> müssen dabei sein, alles Weitere ist optional.
          Erkannt werden zusätzlich die Beschriftungen aller aktiven Module — etwa
          „HU fällig am&ldquo; oder „Kilometerstand&ldquo;.
        </p>
        <p>
          Trennzeichen Semikolon oder Komma, Datum als <code>31.12.2026</code> oder{" "}
          <code>2026-12-31</code>. Fahrzeuge mit bereits vorhandenem Kennzeichen
          werden übersprungen, nicht überschrieben.
        </p>
      </div>

      {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
          Download braucht echte Navigation; <Link> würde clientseitig routen. */}
      <a
        href="/export/vorlage"
        className="inline-flex items-center rounded border border-border-strong bg-bg px-3 py-1.5 text-sm font-medium hover:bg-page"
      >
        Beispieldatei herunterladen
      </a>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-medium">CSV-Datei</span>
          <input
            type="file"
            name="datei"
            accept=".csv,text/csv"
            required
            className="w-full rounded border border-border-strong bg-bg px-2.5 py-1.5 text-sm"
          />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Wird eingelesen…" : "Importieren"}
        </Button>
      </form>

      {state.error && <Notice kind="error">{state.error}</Notice>}

      {state.done && (
        <div className="space-y-2">
          <Notice kind={state.imported > 0 ? "success" : "info"}>
            {state.imported === 0
              ? "Kein neues Fahrzeug angelegt."
              : `${state.imported} ${state.imported === 1 ? "Fahrzeug" : "Fahrzeuge"} angelegt.`}
            {state.skipped > 0 &&
              ` ${state.skipped} übersprungen (Kennzeichen bereits vorhanden).`}
          </Notice>

          {state.ignoredColumns.length > 0 && (
            <p className="text-xs text-muted">
              Nicht zugeordnete Spalten: {state.ignoredColumns.join(", ")}. Ihre Werte
              wurden nicht übernommen.
            </p>
          )}
        </div>
      )}

      {state.problems.length > 0 && (
        <div className="rounded border border-border bg-page p-3">
          <p className="text-sm font-medium">Übersprungene Zeilen</p>
          <ul className="mt-1.5 space-y-1 text-xs text-muted">
            {state.problems.map((problem, index) => (
              <li key={`${problem.line}-${index}`}>
                <span className="tabular-nums">Zeile {problem.line}:</span> {problem.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
