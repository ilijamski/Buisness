import assert from "node:assert/strict";
import { test } from "node:test";
import { occurrencesBetween } from "./recurrence.ts";

const ev = (date: string, repeat = "none", extra: Partial<{ endDate: string; repeatUntil: string }> = {}) => ({
  date,
  repeat,
  endDate: extra.endDate ?? null,
  repeatUntil: extra.repeatUntil ?? null,
});
const starts = (...args: Parameters<typeof occurrencesBetween>) => occurrencesBetween(...args).map((o) => o.start);

test("einzelner Termin nur innerhalb des Zeitraums", () => {
  assert.deepEqual(starts(ev("2026-11-10"), "2026-11-01", "2026-11-30"), ["2026-11-10"]);
  assert.deepEqual(starts(ev("2026-11-10"), "2026-12-01", "2026-12-31"), []);
});

test("mehrtägiger Termin ragt in den Zeitraum hinein", () => {
  const result = occurrencesBetween(ev("2026-10-30", "none", { endDate: "2026-11-02" }), "2026-11-01", "2026-11-30");
  assert.deepEqual(result, [{ start: "2026-10-30", end: "2026-11-02" }]);
  assert.deepEqual(starts(ev("2026-10-28", "none", { endDate: "2026-10-31" }), "2026-11-01", "2026-11-30"), []);
});

test("wöchentliche Serie beginnt nicht vor dem ersten Termin und endet mit repeatUntil", () => {
  assert.deepEqual(starts(ev("2026-11-10", "weekly"), "2026-11-01", "2026-11-30"), ["2026-11-10", "2026-11-17", "2026-11-24"]);
  assert.deepEqual(starts(ev("2026-11-10", "weekly", { repeatUntil: "2026-11-17" }), "2026-11-01", "2026-11-30"), ["2026-11-10", "2026-11-17"]);
  // weit in der Zukunft: Wochentag bleibt erhalten
  assert.deepEqual(starts(ev("2020-01-07", "weekly"), "2026-11-09", "2026-11-15"), ["2026-11-10"]);
});

test("tägliche Serie", () => {
  assert.equal(starts(ev("2026-11-10", "daily"), "2026-11-01", "2026-11-30").length, 21);
});

test("monatliche Serie überspringt Monate ohne diesen Tag", () => {
  assert.deepEqual(starts(ev("2026-01-31", "monthly"), "2026-01-01", "2026-05-31"), ["2026-01-31", "2026-03-31", "2026-05-31"]);
});

test("jährliche Serie, auch am 29. Februar", () => {
  assert.deepEqual(starts(ev("1990-05-12", "yearly"), "2026-05-01", "2026-05-31"), ["2026-05-12"]);
  assert.deepEqual(starts(ev("2024-02-29", "yearly"), "2025-01-01", "2028-12-31"), ["2028-02-29"]);
});

test("mehrtägige Serie über die Zeitraumgrenze", () => {
  const result = occurrencesBetween(ev("2026-11-06", "weekly", { endDate: "2026-11-08" }), "2026-11-08", "2026-11-14");
  assert.deepEqual(result, [
    { start: "2026-11-06", end: "2026-11-08" },
    { start: "2026-11-13", end: "2026-11-15" },
  ]);
});

test("ausgenommene Termine einer Serie fehlen", () => {
  const event = { ...ev("2026-11-10", "weekly"), skipDates: "2026-11-17,2026-12-01" };
  assert.deepEqual(starts(event, "2026-11-01", "2026-11-30"), ["2026-11-10", "2026-11-24"]);
});
