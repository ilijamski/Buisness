import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: owner(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("active"),
    color: integer("color").notNull().default(1),
    dueDate: date("due_date", { mode: "string" }),
    createdAt: createdAt(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: owner(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("todo"),
    dueDate: date("due_date", { mode: "string" }),
    completedOn: date("completed_on", { mode: "string" }),
    /** none | daily | weekly | monthly – beim Erledigen entsteht die nächste Aufgabe */
    repeat: text("repeat").notNull().default("none"),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_user_idx").on(t.userId), index("tasks_project_idx").on(t.projectId)],
);

export const events = pgTable(
  "events",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    location: text("location").notNull().default(""),
    date: date("date", { mode: "string" }).notNull(),
    /** letzter Tag eines mehrtägigen Termins; null = eintägig */
    endDate: date("end_date", { mode: "string" }),
    /** none | daily | weekly | monthly | yearly */
    repeat: text("repeat").notNull().default("none"),
    repeatUntil: date("repeat_until", { mode: "string" }),
    startTime: text("start_time"),
    endTime: text("end_time"),
    color: integer("color").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index("events_user_date_idx").on(t.userId, t.date)],
);

export const goals = pgTable(
  "goals",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("personal"),
    current: doublePrecision("current").notNull().default(0),
    target: doublePrecision("target").notNull().default(100),
    unit: text("unit").notNull().default("%"),
    deadline: date("deadline", { mode: "string" }),
    completedOn: date("completed_on", { mode: "string" }),
    createdAt: createdAt(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

export const habits = pgTable(
  "habits",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    color: integer("color").notNull().default(1),
    targetPerWeek: integer("target_per_week").notNull().default(7),
    createdAt: createdAt(),
  },
  (t) => [index("habits_user_idx").on(t.userId)],
);

export const habitLogs = pgTable(
  "habit_logs",
  {
    id: id(),
    userId: owner(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
  },
  (t) => [
    uniqueIndex("habit_logs_unique").on(t.habitId, t.date),
    index("habit_logs_user_date_idx").on(t.userId, t.date),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    pinned: boolean("pinned").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("notes_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    /** checking | savings | cash | credit */
    kind: text("kind").notNull().default("checking"),
    /** Kontostand vor der ersten erfassten Buchung */
    openingCents: integer("opening_cents").notNull().default(0),
    color: integer("color").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    userId: owner(),
    type: text("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    /** Zahlungsempfänger bzw. Auftraggeber */
    counterparty: text("counterparty").notNull().default(""),
    date: date("date", { mode: "string" }).notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    /** Kennung aus Import oder Bankabruf; verhindert doppelte Buchungen */
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.date),
    uniqueIndex("transactions_external").on(t.userId, t.externalId),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    userId: owner(),
    category: text("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [uniqueIndex("budgets_user_category").on(t.userId, t.category)],
);

export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type CalendarEvent = typeof events.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
