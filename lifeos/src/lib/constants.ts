export const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Dringend",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};
export const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
};

export const TASK_REPEATS = ["none", "daily", "weekly", "monthly"] as const;
export type TaskRepeat = (typeof TASK_REPEATS)[number];
export const EVENT_REPEATS = ["none", "daily", "weekly", "monthly", "yearly"] as const;
export type EventRepeat = (typeof EVENT_REPEATS)[number];
export const REPEAT_LABEL: Record<EventRepeat, string> = {
  none: "Nie",
  daily: "Täglich",
  weekly: "Wöchentlich",
  monthly: "Monatlich",
  yearly: "Jährlich",
};

export const PROJECT_STATUSES = ["active", "paused", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Aktiv",
  paused: "Pausiert",
  done: "Abgeschlossen",
};

export const GOAL_CATEGORIES = ["career", "health", "finance", "learning", "personal"] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];
export const GOAL_CATEGORY_LABEL: Record<GoalCategory, string> = {
  career: "Karriere",
  health: "Gesundheit",
  finance: "Finanzen",
  learning: "Lernen",
  personal: "Persönlich",
};

/** Farbslots 1–8 der Diagrammpalette; Reihenfolge ist fest (Farbe folgt der Kategorie). */
export const EXPENSE_CATEGORIES = [
  { key: "housing", label: "Wohnen", color: 1 },
  { key: "food", label: "Lebensmittel", color: 2 },
  { key: "mobility", label: "Mobilität", color: 3 },
  { key: "leisure", label: "Freizeit", color: 4 },
  { key: "health", label: "Gesundheit", color: 5 },
  { key: "subscriptions", label: "Abos", color: 6 },
  { key: "shopping", label: "Shopping", color: 7 },
  { key: "other", label: "Sonstiges", color: 0 },
] as const;
export const INCOME_CATEGORIES = [
  { key: "salary", label: "Gehalt", color: 1 },
  { key: "freelance", label: "Freiberuflich", color: 3 },
  { key: "investment", label: "Kapitalerträge", color: 7 },
  { key: "other_income", label: "Sonstiges", color: 0 },
] as const;
export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
export const categoryMeta = (key: string) =>
  ALL_CATEGORIES.find((c) => c.key === key) ?? { key, label: "Sonstiges", color: 0 };

export const ACCOUNT_KINDS = ["checking", "savings", "cash", "credit"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  checking: "Girokonto",
  savings: "Sparkonto",
  cash: "Bargeld",
  credit: "Kreditkarte",
};

export const COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const COLOR_NAME: Record<number, string> = {
  1: "Blau", 2: "Orange", 3: "Türkis", 4: "Gelb", 5: "Magenta", 6: "Grün", 7: "Violett", 8: "Rot",
};
/** CSS-Variable eines Farbslots (0 = neutral) */
export const slotVar = (slot: number) => (slot >= 1 && slot <= 8 ? `var(--color-s${slot})` : "var(--color-s0)");
