import "server-only";
import type { Db } from "@/db/client";
import { schema } from "@/db/client";
import { addDays, addMonths, monthOf, startOfWeek, weekdayIndex } from "@/lib/dates";

/** Deterministischer Zufall, damit die Beispieldaten reproduzierbar sind. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Legt realistische Beispieldaten der letzten Wochen an, damit alle Bereiche Inhalt zeigen. */
export async function seedDemoData(db: Db, userId: string, today: string) {
  const rand = rng(42);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const past = (days: number) => new Date(Date.now() - days * 86_400_000);

  const [web, move, course] = await db
    .insert(schema.projects)
    .values([
      { userId, name: "Website-Relaunch", description: "Neues Portfolio mit Blog und Kontaktformular.", color: 1, dueDate: addDays(today, 24), createdAt: past(40) },
      { userId, name: "Umzug nach Hamburg", description: "Wohnung, Umzugsfirma, Ummeldung.", color: 2, dueDate: addDays(today, 45), createdAt: past(30) },
      { userId, name: "Spanisch B1", description: "Zertifikat bis zum Sommer.", color: 3, status: "paused", createdAt: past(60) },
    ])
    .returning({ id: schema.projects.id });

  type TaskSeed = [title: string, priority: string, status: string, due: number | null, project: string | null, doneAgo?: number, repeat?: string];
  const taskSeeds: TaskSeed[] = [
    ["Steuererklärung abgeben", "urgent", "todo", 0, null],
    ["Angebot für Kundin Weber schreiben", "high", "in_progress", 0, null],
    ["Zahnarzttermin vereinbaren", "medium", "todo", 1, null],
    ["Geschenk für Mama besorgen", "medium", "todo", 3, null],
    ["Fahrrad zur Inspektion bringen", "low", "todo", 6, null],
    ["Versicherungen vergleichen", "low", "todo", null, null],
    ["Wohnung putzen", "medium", "todo", 2, null, undefined, "weekly"],
    ["Haushaltsbuch prüfen", "low", "todo", 12, null, undefined, "monthly"],
    ["Stromzähler ablesen", "high", "todo", -2, null],
    ["Wireframes für Startseite", "high", "done", -6, web.id, 5],
    ["Farbpalette und Typografie festlegen", "medium", "done", -4, web.id, 4],
    ["Startseite umsetzen", "high", "in_progress", 2, web.id],
    ["Blog-Layout bauen", "medium", "todo", 8, web.id],
    ["Kontaktformular anbinden", "medium", "todo", 12, web.id],
    ["Texte Korrektur lesen lassen", "low", "todo", 16, web.id],
    ["Domain umziehen", "urgent", "todo", 20, web.id],
    ["Wohnungen besichtigen", "high", "done", -9, move.id, 8],
    ["Mietvertrag unterschreiben", "urgent", "in_progress", 4, move.id],
    ["Umzugsfirma beauftragen", "high", "todo", 10, move.id],
    ["Nachsendeauftrag stellen", "medium", "todo", 30, move.id],
    ["Kartons besorgen", "low", "todo", 21, move.id],
    ["Lektion 12 abschließen", "medium", "done", -12, course.id, 11],
    ["Vokabeln Kapitel 5 wiederholen", "low", "todo", null, course.id],
  ];
  const doneTitles = [
    "Wocheneinkauf erledigen", "Rechnung an Studio Nord", "Sport-Tasche packen", "Backup der Fotos", "E-Mails aufräumen",
    "Präsentation vorbereiten", "Blumen gießen", "Bücher zurückgeben", "Newsletter schreiben", "Küche putzen",
    "Meeting-Notizen teilen", "Laufschuhe bestellen", "Kündigung Fitnessstudio", "Zugticket buchen", "Auto waschen",
  ];
  const doneTasks: TaskSeed[] = [];
  for (let d = 0; d < 84; d++) {
    const n = Math.floor(rand() * 3.4) + (weekdayIndex(addDays(today, -d)) < 5 ? 1 : 0) - (d > 50 ? 1 : 0);
    for (let i = 0; i < n; i++) doneTasks.push([pick(doneTitles), pick(["low", "medium", "medium", "high"]), "done", -d, null, d]);
  }
  await db.insert(schema.tasks).values(
    [...taskSeeds, ...doneTasks].map(([title, priority, status, due, projectId, doneAgo, repeat], i) => ({
      userId,
      title,
      priority,
      status,
      dueDate: due === null ? null : addDays(today, due),
      projectId,
      repeat: repeat ?? "none",
      completedOn: status === "done" ? addDays(today, -(doneAgo ?? 0)) : null,
      createdAt: past(90 - Math.min(i, 89)),
    })),
  );

  const week = startOfWeek(today);
  await db.insert(schema.events).values([
    // Serien beginnen in der Vergangenheit, damit auch Rückblicke gefüllt sind.
    { userId, title: "Team-Weekly", date: addDays(week, -55), startTime: "09:30", endTime: "10:15", location: "Videocall", color: 1, repeat: "weekly" },
    { userId, title: "Sprachkurs", date: addDays(week, -55), startTime: "19:00", endTime: "20:30", color: 3, repeat: "weekly", repeatUntil: addDays(week, 85) },
    { userId, title: "Miete überweisen", date: `${addMonths(monthOf(today), -3)}-01`, color: 4, repeat: "monthly" },
    { userId, title: "Geburtstag Mama", date: addDays(today, 5 - 365 * 3), color: 5, repeat: "yearly" },
    { userId, title: "Mittagessen mit Jonas", date: today, startTime: "12:30", endTime: "13:30", location: "Café Luise", color: 3 },
    { userId, title: "Yoga", date: today, startTime: "18:30", endTime: "19:45", color: 5 },
    { userId, title: "Zahnarzt", date: addDays(today, 2), startTime: "08:00", endTime: "08:45", color: 8 },
    { userId, title: "Kundentermin Weber", date: addDays(today, 3), startTime: "14:00", endTime: "15:30", location: "Büro Mitte", color: 1 },
    { userId, title: "Kurzurlaub an der Ostsee", date: addDays(today, 16), endDate: addDays(today, 19), location: "Rügen", color: 6 },
    { userId, title: "Wohnungsübergabe", date: addDays(today, 9), startTime: "11:00", endTime: "12:00", location: "Hamburg", color: 2 },
    { userId, title: "Konzert", date: addDays(today, 12), startTime: "20:00", endTime: "23:00", color: 7 },
    { userId, title: "Laufgruppe", date: addDays(week, -2), startTime: "10:00", endTime: "11:00", color: 6 },
    { userId, title: "Steuerberater", date: addDays(today, -4), startTime: "16:00", endTime: "17:00", color: 8 },
  ]);

  await db.insert(schema.goals).values([
    { userId, title: "Halbmarathon laufen", description: "Längster Trainingslauf in Kilometern.", category: "health", current: 14, target: 21, unit: "km", deadline: addDays(today, 70), createdAt: past(60) },
    { userId, title: "Notgroschen aufbauen", description: "Drei Monatsausgaben auf dem Tagesgeldkonto.", category: "finance", current: 4200, target: 7500, unit: "€", deadline: addDays(today, 150), createdAt: past(80) },
    { userId, title: "24 Bücher lesen", category: "learning", current: 17, target: 24, unit: "Bücher", deadline: `${today.slice(0, 4)}-12-31`, createdAt: past(85) },
    { userId, title: "Spanisch-Zertifikat B1", category: "learning", current: 35, target: 100, unit: "%", deadline: addDays(today, 200), createdAt: past(55) },
    { userId, title: "Portfolio veröffentlichen", category: "career", current: 100, target: 100, unit: "%", completedOn: addDays(today, -10), createdAt: past(70) },
  ]);

  const habitSeeds = [
    { name: "Meditieren", color: 7, targetPerWeek: 7, p: 0.82 },
    { name: "Sport", color: 2, targetPerWeek: 4, p: 0.55 },
    { name: "30 Minuten lesen", color: 1, targetPerWeek: 7, p: 0.7 },
    { name: "2 Liter Wasser", color: 3, targetPerWeek: 7, p: 0.88 },
    { name: "Spanisch üben", color: 4, targetPerWeek: 5, p: 0.5 },
  ];
  const habitRows = await db
    .insert(schema.habits)
    .values(habitSeeds.map(({ name, color, targetPerWeek }) => ({ userId, name, color, targetPerWeek, createdAt: past(100) })))
    .returning({ id: schema.habits.id });
  const logs: { userId: string; habitId: string; date: string }[] = [];
  habitRows.forEach((h, i) => {
    for (let d = 1; d < 98; d++) {
      // Die Disziplin nimmt über die Wochen leicht zu.
      if (rand() < habitSeeds[i].p - d * 0.0025 + (d < 6 ? 0.2 : 0)) logs.push({ userId, habitId: h.id, date: addDays(today, -d) });
    }
  });
  logs.push({ userId, habitId: habitRows[0].id, date: today }, { userId, habitId: habitRows[3].id, date: today });
  await db.insert(schema.habitLogs).values(logs).onConflictDoNothing();

  await db.insert(schema.notes).values([
    { userId, title: "Ideen für den Blog", pinned: true, content: "– Wie ich meine Woche plane\n– Werkzeuge, die ich täglich nutze\n– Rückblick auf das erste Jahr als Freelancerin\n\nErster Artikel bis Monatsende.", updatedAt: past(1) },
    { userId, title: "Packliste Umzug", content: "Kartons (ca. 40)\nLuftpolsterfolie\nWerkzeugkoffer\nEtiketten und Marker\n\nNicht vergessen: Zählerstände fotografieren!", updatedAt: past(3) },
    { userId, title: "Buchnotizen: Deep Work", content: "Konzentration ist eine Fähigkeit, die man trainiert.\n\n1. Feste Fokusblöcke am Vormittag\n2. Benachrichtigungen aus\n3. Tagesabschluss-Ritual", updatedAt: past(6) },
    { userId, title: "Fragen an den Steuerberater", content: "Arbeitszimmer absetzbar?\nVorauszahlungen anpassen\nBelege für den Umzug", updatedAt: past(9) },
  ]);

  const month = monthOf(today);
  const day = Number(today.slice(8));
  const txs: { userId: string; type: string; amountCents: number; category: string; description: string; date: string }[] = [];
  for (let m = 0; m < 6; m++) {
    const key = addMonths(month, -m);
    const lastDay = m === 0 ? day : 28;
    const on = (d: number) => `${key}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
    const add = (type: string, category: string, description: string, euros: number, d: number) => {
      if (d <= lastDay) txs.push({ userId, type, category, description, amountCents: Math.round(euros * 100), date: on(d) });
    };
    add("income", "salary", "Gehalt", 3450, 1);
    if (rand() > 0.4) add("income", "freelance", "Projekt Studio Nord", 400 + Math.floor(rand() * 9) * 100, 12 + Math.floor(rand() * 10));
    if (m % 3 === 0) add("income", "investment", "Dividende ETF", 86.4, 15);
    add("expense", "housing", "Miete", 1120, 2);
    add("expense", "housing", "Strom & Internet", 94.5, 5);
    add("expense", "subscriptions", "Streaming", 17.99, 6);
    add("expense", "subscriptions", "Cloud-Speicher", 9.99, 8);
    add("expense", "mobility", "Deutschlandticket", 58, 3);
    add("expense", "health", "Fitnessstudio", 39.9, 4);
    for (let d = 2; d <= 28; d += 3) add("expense", "food", pick(["Supermarkt", "Wochenmarkt", "Bäckerei", "Drogerie"]), 18 + rand() * 60, d + Math.floor(rand() * 2));
    for (let i = 0; i < 4; i++) add("expense", "leisure", pick(["Restaurant", "Kino", "Konzertkarten", "Bar", "Museum"]), 14 + rand() * 70, 3 + Math.floor(rand() * 25));
    for (let i = 0; i < 2; i++) add("expense", "shopping", pick(["Kleidung", "Bücher", "Elektronik", "Haushalt"]), 25 + rand() * 140, 5 + Math.floor(rand() * 22));
    if (rand() > 0.5) add("expense", "mobility", "Bahnticket", 39 + rand() * 60, 10 + Math.floor(rand() * 15));
    if (rand() > 0.6) add("expense", "health", "Apotheke", 8 + rand() * 30, 9 + Math.floor(rand() * 15));
  }
  await db.insert(schema.transactions).values(txs);
  await db
    .insert(schema.budgets)
    .values([
      { userId, category: "food", amountCents: 45000 },
      { userId, category: "leisure", amountCents: 20000 },
      { userId, category: "shopping", amountCents: 15000 },
      { userId, category: "mobility", amountCents: 12000 },
    ])
    .onConflictDoNothing();
}
