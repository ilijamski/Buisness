import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDecimal } from "./csv.ts";
import { guessAssetClass, parsePortfolio } from "./portfolio-csv.ts";

test("Stückzahlen mit mehr als zwei Nachkommastellen", () => {
  assert.equal(parseDecimal("12,3456"), 12.3456);
  assert.equal(parseDecimal("1.250,5 Stk."), 1250.5);
  assert.equal(parseDecimal("0.00123"), 0.00123);
});

test("Depotübersicht mit Vorspann, Kurswert und Einstandskurs", () => {
  const csv = [
    '"Depot 123456";"Stand 11.11.2026"',
    "",
    '"Bezeichnung";"ISIN";"Stück";"Einstandskurs";"Kurs";"Kurswert in EUR"',
    '"iShares Core MSCI World UCITS ETF";"IE00B4L5Y983";"42,5";"70,00";"98,40";"4.182,00"',
    '"Allianz SE";"DE0008404005";"10";"210,00";"265,30";"2.653,00"',
    '"Gesamt";"";"";"";"";"6.835,00"',
  ].join("\r\n");
  const { positions, skipped } = parsePortfolio(csv);
  assert.equal(positions.length, 2);
  assert.equal(skipped, 1);
  assert.deepEqual(positions[0], {
    name: "iShares Core MSCI World UCITS ETF",
    isin: "IE00B4L5Y983",
    assetClass: "etf",
    quantity: 42.5,
    valueCents: 418200,
    costCents: 297500,
  });
  assert.equal(positions[1].assetClass, "stock");
  assert.equal(positions[1].costCents, 210000);
});

test("Wert aus Stückzahl mal Kurs, wenn keine Wertspalte vorhanden ist", () => {
  const { positions } = parsePortfolio("Name,Quantity,Price\nBitcoin,0.05,60000\nApple Inc.,3,180.50\n");
  assert.deepEqual(positions.map((p) => [p.valueCents, p.assetClass, p.costCents]), [
    [300000, "crypto", null],
    [54150, "stock", null],
  ]);
});

test("Anlageklasse aus der Gattungsspalte", () => {
  assert.equal(guessAssetClass("Bundesrep. Deutschland 2,5% 2034", "Anleihe"), "bond");
  assert.equal(guessAssetClass("DWS Top Dividende", "Fonds"), "fund");
  assert.equal(guessAssetClass("Gold Barren", "Rohstoff"), "other");
});

test("Datei ohne Bestandsspalten wird abgelehnt", () => {
  assert.throws(() => parsePortfolio("Datum;Betrag\n01.01.2026;5\n"), /Kopfzeile/);
});
