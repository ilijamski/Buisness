"use client";

import { useActionState } from "react";
import { applyModulePreset } from "@/app/admin/actions";
import { Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";
import { MODULE_KEYS } from "@/lib/modules";
import { PRESETS, presetModules } from "@/lib/presets";

/**
 * Branchen-Profile als Einstiegspunkt in die Modulauswahl.
 *
 * Bewusst als eigene Karte über den Einzelschaltern: Wer neu ist, wählt hier
 * einmal und ist fertig; wer es genau wissen will, stellt darunter nach.
 */
export function PresetPicker({ configuredCount }: { configuredCount: number }) {
  const [state, formAction, pending] = useActionState(applyModulePreset, idleState);

  return (
    <form action={formAction} className="space-y-3">
      {configuredCount === 0 && (
        <Notice kind="info">
          Ihr arbeitet noch mit der Grundaufstellung „Handwerk &amp; Bau&ldquo;. Wähl das
          Profil, das zu eurem Fuhrpark passt — das entscheidet, welche Felder
          beim Anlegen eines Fahrzeugs überhaupt erscheinen.
        </Notice>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="submit"
            name="preset"
            value={preset.key}
            disabled={pending}
            className="flex flex-col gap-1 rounded border border-border-strong bg-bg p-3 text-left hover:border-accent-bg hover:bg-page disabled:opacity-50"
          >
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{preset.label}</span>
              <span className="text-xs text-muted tabular-nums">
                {presetModules(preset, MODULE_KEYS).length} Module
              </span>
            </span>
            <span className="text-xs font-medium text-muted">{preset.audience}</span>
            <span className="text-xs text-muted">{preset.description}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted">
        Ein Profil überschreibt nur, welche Module aktiv sind. Deine
        Pflicht-Markierungen und die Abweichungen einzelner Fahrzeuge bleiben
        erhalten. Erfasste Daten gehen nie verloren — ein abgeschaltetes Modul
        wird ausgeblendet, nicht gelöscht.
      </p>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Profil angewendet.</Notice>}
    </form>
  );
}
