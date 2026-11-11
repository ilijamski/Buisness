import assert from "node:assert/strict";
import { test } from "node:test";
import { categorize, decodeBytes, parseAmount, parseDate, parseStatement } from "./csv.ts";

test("Beträge in deutscher und englischer Schreibweise", () => {
  assert.equal(parseAmount("-1.234,56"), -123456);
  assert.equal(parseAmount("1,234.56"), 123456);
  assert.equal(parseAmount("12,50-"), -1250);
  assert.equal(parseAmount("45,00 S"), -4500);
  assert.equal(parseAmount("45,00 H"), 4500);
  assert.equal(parseAmount("€ 9.99"), 999);
  assert.equal(parseAmount("1.000"), 100000);
  assert.equal(parseAmount("+3.450,00 EUR"), 345000);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(""), null);
});

test("Datumsformate", () => {
  assert.equal(parseDate("03.11.2026"), "2026-11-03");
  assert.equal(parseDate("3.11.26"), "2026-11-03");
  assert.equal(parseDate("2026-11-03"), "2026-11-03");
  assert.equal(parseDate("31.02.2026"), null);
  assert.equal(parseDate("Saldo"), null);
});

test("Windows-1252 wird erkannt", () => {
  const bytes = new Uint8Array([0x42, 0xe4, 0x63, 0x6b, 0x65, 0x72]); // "Bäcker" in Latin-1
  assert.equal(decodeBytes(bytes), "Bäcker");
  assert.equal(decodeBytes(new TextEncoder().encode("﻿Bäcker")), "Bäcker");
});

test("Kontoauszug mit Vorspann, Semikolon und Anführungszeichen", () => {
  const csv = [
    '"Girokonto";"DE00 1234"',
    '"Zeitraum:";"01.11.2026 - 30.11.2026"',
    "",
    '"Buchungstag";"Wertstellung";"Buchungstext";"Beguenstigter/Zahlungspflichtiger";"Verwendungszweck";"Betrag (EUR)"',
    '"03.11.2026";"03.11.2026";"Lastschrift";"REWE Markt GmbH";"Einkauf; Karte 1234";"-42,17"',
    '"01.11.2026";"01.11.2026";"Gutschrift";"Muster AG";"Gehalt November";"3.450,00"',
    '"Summe";"";"";"";"";""',
  ].join("\r\n");
  const { rows, skipped, columns } = parseStatement(csv);
  assert.equal(rows.length, 2);
  assert.equal(skipped, 1);
  assert.deepEqual(rows[0], { date: "2026-11-03", amountCents: -4217, description: "Einkauf; Karte 1234", counterparty: "REWE Markt GmbH" });
  assert.equal(rows[1].amountCents, 345000);
  assert.equal(columns.description, "Verwendungszweck"); // Vorrang vor "Buchungstext"
});

test("Komma-getrennt mit Soll/Haben-Spalten", () => {
  const csv = "Datum,Empfänger,Soll,Haben\n2026-11-05,Stadtwerke,89.50,\n2026-11-06,Erstattung,,12.00\n";
  const { rows } = parseStatement(csv);
  assert.deepEqual(rows.map((r) => r.amountCents), [-8950, 1200]);
});

test("Datei ohne erkennbare Kopfzeile wird abgelehnt", () => {
  assert.throws(() => parseStatement("foo;bar\n1;2\n"), /Kopfzeile/);
});

test("Kategorien: gelernte Zuordnung schlägt Stichwörter", () => {
  const row = { date: "2026-11-03", amountCents: -4217, description: "Einkauf", counterparty: "REWE Markt GmbH" };
  assert.deepEqual(categorize(row, new Map()), { type: "expense", category: "food" });
  assert.deepEqual(categorize(row, new Map([["expense:rewe markt gmbh", "leisure"]])), { type: "expense", category: "leisure" });
  assert.equal(categorize({ ...row, amountCents: 345000, counterparty: "Muster AG", description: "Gehalt November" }, new Map()).category, "salary");
  assert.equal(categorize({ ...row, counterparty: "Unbekannt", description: "xyz" }, new Map()).category, "other");
});
