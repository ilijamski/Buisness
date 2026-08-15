"use client";

import { useActionState, useState } from "react";
import { savePreferences } from "@/app/einstellungen/actions";
import { Button, Field, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";
import {
  THEME_LABELS,
  THEME_STORAGE_KEY,
  type Theme,
  type UserSettings,
} from "@/lib/settings";

/** Wendet das Theme sofort an, damit die Auswahl direkt sichtbar wird. */
function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Privater Modus o. Ä. — Auswahl gilt dann nur für diese Sitzung.
  }
}

/** Muss zum Schlüssel im Init-Skript in layout.tsx passen. */
const COMPACT_STORAGE_KEY = "fuhrpark-compact";

function applyCompact(compact: boolean) {
  document.documentElement.dataset.compact = compact ? "true" : "false";
  try {
    localStorage.setItem(COMPACT_STORAGE_KEY, String(compact));
  } catch {
    // Ohne lokalen Speicher gilt die Auswahl nur für diese Sitzung.
  }
}

export function PreferencesForm({
  settings,
}: {
  settings: Omit<UserSettings, "user_id" | "updated_at">;
}) {
  const [state, formAction, pending] = useActionState(savePreferences, idleState);
  const [theme, setTheme] = useState<Theme>(settings.theme);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Darstellung">
        <select
          name="theme"
          value={theme}
          onChange={(e) => {
            const next = e.target.value as Theme;
            setTheme(next);
            applyTheme(next);
          }}
        >
          {(Object.keys(THEME_LABELS) as Theme[]).map((key) => (
            <option key={key} value={key}>
              {THEME_LABELS[key]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Standard-Fahrtart"
        hint="Vorauswahl beim Eintragen einer Fahrt im Fahrtenbuch."
      >
        <select name="default_trip_type" defaultValue={settings.default_trip_type}>
          <option value="dienstlich">Dienstlich</option>
          <option value="arbeitsweg">Arbeitsweg</option>
          <option value="privat">Privat</option>
        </select>
      </Field>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name="email_reminders"
          defaultChecked={settings.email_reminders}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">E-Mail-Erinnerungen</span>
          <span className="block text-xs text-muted">
            Benachrichtigung, wenn Fristen fällig werden.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name="compact_lists"
          defaultChecked={settings.compact_lists}
          onChange={(e) => applyCompact(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">Kompakte Listen</span>
          <span className="block text-xs text-muted">
            Weniger Abstand, mehr Einträge pro Bildschirm.
          </span>
        </span>
      </label>

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Einstellungen gespeichert.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Speichern"}
      </Button>
    </form>
  );
}
