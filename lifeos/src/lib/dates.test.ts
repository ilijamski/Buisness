import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, addMonths, diffDays, formatRelative, isIsoDate, isMonthKey, isoWeek, monthBounds, rangeDays, startOfWeek, weekdayIndex } from "./dates.ts";

test("addDays überschreitet Monats- und Jahresgrenzen", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  assert.equal(diffDays("2026-03-30", "2026-03-28"), 2); // über die Zeitumstellung hinweg
});

test("Wochen beginnen am Montag", () => {
  assert.equal(weekdayIndex("2026-11-10"), 1); // Dienstag
  assert.equal(startOfWeek("2026-11-10"), "2026-11-09");
  assert.equal(startOfWeek("2026-11-15"), "2026-11-09"); // Sonntag gehört zur selben Woche
  assert.deepEqual(rangeDays("2026-11-09", 3), ["2026-11-09", "2026-11-10", "2026-11-11"]);
});

test("ISO-Kalenderwochen an Jahresgrenzen", () => {
  assert.equal(isoWeek("2026-11-10"), 46);
  assert.equal(isoWeek("2027-01-01"), 53);
  assert.equal(isoWeek("2025-12-29"), 1);
});

test("Monatsrechnung", () => {
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.deepEqual(monthBounds("2024-02"), { start: "2024-02-01", end: "2024-02-29" });
});

test("Eingaben werden streng geprüft", () => {
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026-02-28"), true);
  assert.equal(isIsoDate("28.02.2026"), false);
  assert.equal(isMonthKey("2026-13"), false);
  assert.equal(isMonthKey("2026-07"), true);
});

test("relative Datumsangaben", () => {
  assert.equal(formatRelative("2026-11-10", "2026-11-10"), "Heute");
  assert.equal(formatRelative("2026-11-11", "2026-11-10"), "Morgen");
  assert.equal(formatRelative("2026-11-09", "2026-11-10"), "Gestern");
});
