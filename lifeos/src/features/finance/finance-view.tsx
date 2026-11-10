"use client";

import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BarChart, DonutChart, Legend } from "@/components/charts";
import { FormModal } from "@/components/ui/modal";
import { Button, Card, CardHeader, Dot, EmptyState, Field, PageHeader, Segmented, StatTile } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/toast";
import { categoryMeta, EXPENSE_CATEGORIES, INCOME_CATEGORIES, slotVar } from "@/lib/constants";
import { addMonths, formatMonth, formatMonthShort, formatRelative } from "@/lib/dates";
import { cn, formatMoney, formatPercent } from "@/lib/format";
import { deleteTransaction, saveTransaction } from "./actions";
import type { MonthTotals } from "./queries";

export type TxData = { id: string; type: string; amountCents: number; category: string; description: string; date: string };
type TxType = "income" | "expense";
const FLOW_SERIES = [
  { name: "Einnahmen", color: "var(--color-s1)" },
  { name: "Ausgaben", color: "var(--color-s2)" },
];

/** "1.234,56" → 123456 Cent; NaN bei ungültiger Eingabe. */
function parseCents(input: string): number {
  const cleaned = input.replace(/[€\s]/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Math.round(Number(normalized) * 100) : NaN;
}

function TransactionDialog({ open, onClose, tx, defaultDate }: { open: boolean; onClose: () => void; tx?: TxData | null; defaultDate: string }) {
  const { run, pending } = useAction();
  const [type, setType] = useState<TxType>((tx?.type as TxType) ?? "expense");
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={tx ? "Buchung bearbeiten" : "Neue Buchung"}
      pending={pending}
      submitLabel={tx ? "Speichern" : "Buchen"}
      onDelete={tx ? () => run(() => deleteTransaction({ id: tx.id }), { success: "Buchung gelöscht", onSuccess: onClose }) : undefined}
      onSubmit={(data) =>
        run(
          () =>
            saveTransaction({
              id: tx?.id,
              type,
              amountCents: parseCents(String(data.get("amount"))),
              category: String(data.get("category")),
              description: String(data.get("description")),
              date: String(data.get("date")),
            }),
          { success: tx ? "Buchung gespeichert" : "Buchung angelegt", onSuccess: onClose },
        )
      }
    >
      <Segmented<TxType>
        label="Art der Buchung"
        value={type}
        onChange={setType}
        options={[
          { value: "expense", label: "Ausgabe" },
          { value: "income", label: "Einnahme" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Betrag in €">
          <input
            name="amount"
            className="field tabular-nums"
            inputMode="decimal"
            required
            autoFocus={!tx}
            pattern="[0-9.]*(,[0-9]{1,2})?|[0-9]+(\.[0-9]{1,2})?"
            title="Betrag, z. B. 12,50"
            defaultValue={tx ? (tx.amountCents / 100).toFixed(2).replace(".", ",") : ""}
            placeholder="0,00"
          />
        </Field>
        <Field label="Datum">
          <input name="date" type="date" className="field" required defaultValue={tx?.date ?? defaultDate} />
        </Field>
      </div>
      <Field label="Kategorie">
        <select key={type} name="category" className="field" defaultValue={tx?.type === type ? tx.category : categories[0].key}>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Beschreibung">
        <input name="description" className="field" maxLength={200} defaultValue={tx?.description} placeholder="z. B. Wocheneinkauf" />
      </Field>
    </FormModal>
  );
}

export function FinanceView({ month, today, transactions, history }: { month: string; today: string; transactions: TxData[]; history: MonthTotals[] }) {
  const [dialog, setDialog] = useState<{ tx: TxData | null } | null>(null);
  const income = transactions.filter((t) => t.type === "income").reduce((a, t) => a + t.amountCents, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((a, t) => a + t.amountCents, 0);
  const balance = income - expense;
  const isCurrent = today.startsWith(month);

  const byCategory = new Map<string, number>();
  for (const t of transactions) if (t.type === "expense") byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amountCents);
  // Feste Kategorie-Reihenfolge, damit jede Kategorie in jedem Monat dieselbe Farbe trägt.
  const slices = EXPENSE_CATEGORIES.filter((c) => byCategory.has(c.key)).map((c) => ({
    name: c.label,
    color: slotVar(c.color),
    value: byCategory.get(c.key)!,
  }));

  const dates = [...new Set(transactions.map((t) => t.date))];
  const hasHistory = history.some((h) => h.income || h.expense);

  return (
    <>
      <PageHeader title="Finanzen" subtitle="Einnahmen, Ausgaben und wohin dein Geld fließt.">
        <div className="flex items-center rounded-[10px] border border-line bg-white/[0.03]">
          <Link href={`/finanzen?m=${addMonths(month, -1)}`} aria-label="Vorheriger Monat" className="flex size-10 items-center justify-center rounded-l-[10px] text-ink-2 hover:bg-white/[0.07]">
            <ChevronLeft size={17} />
          </Link>
          <span className="min-w-32 px-1 text-center text-sm font-medium capitalize">{formatMonth(month)}</span>
          <Link href={`/finanzen?m=${addMonths(month, 1)}`} aria-label="Nächster Monat" className="flex size-10 items-center justify-center rounded-r-[10px] text-ink-2 hover:bg-white/[0.07]">
            <ChevronRight size={17} />
          </Link>
        </div>
        <Button variant="primary" onClick={() => setDialog({ tx: null })}>
          <Plus size={16} />
          Neue Buchung
        </Button>
      </PageHeader>

      <div key={month} className="stagger space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Einnahmen" value={formatMoney(income)} icon={<ArrowUpRight size={16} />} />
          <StatTile label="Ausgaben" value={formatMoney(expense)} icon={<ArrowDownRight size={16} />} />
          <StatTile label="Saldo" value={formatMoney(balance)} detail={balance >= 0 ? "Überschuss" : "Mehr ausgegeben als eingenommen"} />
          <StatTile label="Sparquote" value={income > 0 ? formatPercent(Math.max(0, balance) / income) : "–"} detail="vom Einkommen behalten" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Ausgaben nach Kategorie" hint={formatMonth(month)} />
            {slices.length ? (
              <DonutChart slices={slices} centerLabel="Ausgaben" label="Ringdiagramm der Ausgaben nach Kategorie" />
            ) : (
              <p className="py-12 text-center text-sm text-muted">In diesem Monat gibt es noch keine Ausgaben.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Verlauf" hint="Einnahmen und Ausgaben der letzten sechs Monate" action={<Legend series={FLOW_SERIES} />} />
            {hasHistory ? (
              <BarChart
                label="Säulendiagramm: Einnahmen und Ausgaben je Monat"
                format="money"
                series={FLOW_SERIES}
                highlight={history.length - 1}
                data={history.map((h) => ({ label: formatMonthShort(h.month), title: formatMonth(h.month), values: [h.income, h.expense] }))}
              />
            ) : (
              <p className="py-12 text-center text-sm text-muted">Sobald du Buchungen erfasst, erscheint hier der Verlauf.</p>
            )}
          </Card>
        </div>

        <section className="card p-2">
          <h2 className="px-3 pt-2 pb-1 text-[15px] font-semibold tracking-tight">Buchungen</h2>
          {transactions.length ? (
            dates.map((date) => (
              <div key={date}>
                <h3 className="px-3 pt-3 pb-1 text-xs font-medium text-muted">{formatRelative(date, today)}</h3>
                <ul>
                  {transactions
                    .filter((t) => t.date === date)
                    .map((t) => {
                      const meta = categoryMeta(t.category);
                      const isIncome = t.type === "income";
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => setDialog({ tx: t })}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.05]">
                              {isIncome ? <ArrowUpRight size={16} className="text-good" /> : <Dot color={slotVar(meta.color)} className="!size-2.5" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-ink">{t.description || meta.label}</span>
                              <span className="block text-xs text-muted">{meta.label}</span>
                            </span>
                            <span className={cn("shrink-0 text-sm font-medium tabular-nums", isIncome ? "text-ink" : "text-ink-2")}>
                              {isIncome ? "+" : "−"} {formatMoney(t.amountCents)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<Wallet size={22} />}
              title="Keine Buchungen"
              text={`Für ${formatMonth(month)} ist noch nichts erfasst.`}
              action={
                <Button variant="primary" onClick={() => setDialog({ tx: null })}>
                  <Plus size={16} />
                  Buchung erfassen
                </Button>
              }
            />
          )}
        </section>
      </div>

      <TransactionDialog
        key={dialog?.tx?.id ?? "new"}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        tx={dialog?.tx}
        defaultDate={isCurrent ? today : `${month}-01`}
      />
    </>
  );
}
