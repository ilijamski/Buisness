import type { TripType } from "@/lib/types";

export type Theme = "light" | "dark" | "system";

export type UserSettings = {
  user_id: string;
  theme: Theme;
  email_reminders: boolean;
  push_reminders: boolean;
  default_trip_type: TripType;
  compact_lists: boolean;
  updated_at: string;
};

/** Gilt, solange der Nutzer nichts abweichend gespeichert hat. */
export const DEFAULT_USER_SETTINGS: Omit<UserSettings, "user_id" | "updated_at"> = {
  theme: "light",
  email_reminders: true,
  push_reminders: true,
  default_trip_type: "dienstlich",
  compact_lists: false,
};

/** Muss zum Schlüssel im Inline-Skript in layout.tsx passen. */
export const THEME_STORAGE_KEY = "fuhrpark-theme";

export const THEME_LABELS: Record<Theme, string> = {
  light: "Hell",
  dark: "Dunkel",
  system: "Wie das Gerät",
};

export const APP_VERSION = "1.0.0";
