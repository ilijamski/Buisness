"use client";

import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, CircleAlert, FileUp, Landmark, Pencil, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { BarChart, DonutChart, Legend } from "@/components/charts";
import { ColorPicker } from "@/components/ui/color-picker";
import { FormModal, Modal } from "@/components/ui/modal";
import { Button, Card, CardHeader, Dot, EmptyState, Field, IconButton, PageHeader, ProgressBar, Segmented, StatTile } from "@/components/ui/primitives";
import { useAction, useToast } from "@/components/ui/toast";
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABEL, categoryMeta, EXPENSE_CATEGORIES, INCOME_CATEGORIES, slotVar, type AccountKind } from "@/lib/constants";
import { addMonths, formatMedium, formatMonth, formatMonthShort, formatRelative } from "@/lib/dates";
import { cn, formatMoney, formatPercent } from "@/lib/format";
import { deleteAccount, deleteTransaction, saveAccount, saveBudgets, saveTransaction } from "./actions";
import { previewImport, runImport, type ImportPreview } from "./import";
import { centsToInput, parseCents } from "./money";
import { PortfolioCard } from "./portfolio-view";
import type { AccountView, HoldingView, MonthTotals } from "./queries";

export type TxData = {
  id: string;
  type: string;
  amountCents: number;
  category: string;
  description: string;
  counterparty: string;
  accountId: string | null;
  date: string;
};
type TxType = "income" | "expense";
const FLOW_SERIES = [
  { name: "Einnahmen", color: "var(--color-s1)" },
  { name: "Ausgaben", color: "var(--color-s2)" },
];


function TransactionDialog({
  open,
  onClose,
  tx,
  defaultDate,
  accounts,
  defaultAccountId,
}: {
  open: boolean;
  onClose: () => void;
  tx?: TxData | null;
  defaultDate: string;
  accounts: AccountView[];
  defaultAccountId?: string;
}) {
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
              counterparty: String(data.get("counterparty")),
              accountId: String(data.get("accountId") ?? ""),
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Empfänger / Auftraggeber">
          <input name="counterparty" className="field" maxLength={120} defaultValue={tx?.counterparty} placeholder="z. B. REWE" />
        </Field>
        <Field label="Beschreibung">
          <input name="description" className="field" maxLength={200} defaultValue={tx?.description} placeholder="z. B. Wocheneinkauf" />
        </Field>
      </div>
      {accounts.length ? (
        <Field label="Konto">
          <select name="accountId" className="field" defaultValue={tx ? (tx.accountId ?? "") : (defaultAccountId ?? accounts[0].id)}>
            <option value="">Kein Konto</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </FormModal>
  );
}


function BudgetDialog({ open, onClose, budgets }: { open: boolean; onClose: () => void; budgets: Record<string, number> }) {
  const { run, pending } = useAction();
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Monatsbudgets"
      pending={pending}
      onSubmit={(data) =>
        run(
          () =>
            saveBudgets({
              budgets: EXPENSE_CATEGORIES.map((c) => {
                const raw = String(data.get(c.key) ?? "").trim();
                return { category: c.key, amountCents: raw ? parseCents(raw) : null };
              }),
            }),
          { success: "Budgets gespeichert", onSuccess: onClose },
        )
      }
    >
      <p className="text-sm text-pretty text-muted">Lege fest, wie viel du pro Monat je Kategorie ausgeben möchtest. Leere Felder haben kein Budget.</p>
      <div className="grid grid-cols-2 gap-3">
        {EXPENSE_CATEGORIES.map((c) => (
          <label key={c.key} className="block">
            <span className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-ink-2">
              <Dot color={slotVar(c.color)} />
              {c.label}
            </span>
            <input name={c.key} className="field tabular-nums" inputMode="decimal" placeholder="– €" defaultValue={budgets[c.key] ? centsToInput(budgets[c.key]) : ""} />
          </label>
        ))}
      </div>
    </FormModal>
  );
}

function AccountDialog({ open, onClose, account }: { open: boolean; onClose: () => void; account?: AccountView | null }) {
  const { run, pending } = useAction();
  const [deleting, setDeleting] = useState(false);
  const done = () => {
    setDeleting(false);
    onClose();
  };
  return (
    <>
      <FormModal
        open={open && !deleting}
        onClose={onClose}
        title={account ? "Konto bearbeiten" : "Neues Konto"}
        pending={pending}
        submitLabel={account ? "Speichern" : "Anlegen"}
        onDelete={account ? () => setDeleting(true) : undefined}
        onSubmit={(data) => {
          const raw = String(data.get("opening") ?? "").trim();
          const negative = raw.startsWith("-") || raw.startsWith("−");
          const cents = raw ? parseCents(raw.replace(/^[-−]/, "")) : 0;
          run(
            () =>
              saveAccount({
                id: account?.id,
                name: String(data.get("name")),
                kind: data.get("kind") as AccountKind,
                openingCents: negative ? -cents : cents,
                color: Number(data.get("color")),
              }),
            { success: account ? "Konto gespeichert" : "Konto angelegt", onSuccess: onClose },
          );
        }}
      >
        <Field label="Name">
          <input name="name" className="field" required maxLength={200} autoFocus={!account} defaultValue={account?.name} placeholder="z. B. Girokonto Sparkasse" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Art">
            <select name="kind" className="field" defaultValue={account?.kind ?? "checking"}>
              {ACCOUNT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ACCOUNT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Anfangsstand in €" hint="Stand vor der ersten erfassten Buchung.">
            <input
              name="opening"
              className="field tabular-nums"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={account ? (account.openingCents < 0 ? "-" : "") + centsToInput(Math.abs(account.openingCents)) : ""}
            />
          </Field>
        </div>
        <div>
          <span className="mb-2 block text-[13px] font-medium text-ink-2">Farbe</span>
          <ColorPicker name="color" defaultValue={account?.color ?? 1} />
        </div>
      </FormModal>
      <Modal open={deleting} onClose={() => setDeleting(false)} title="Konto löschen" size="sm">
        <p className="text-sm text-pretty text-ink-2">
          „{account?.name}“ hat {account?.count ?? 0} {account?.count === 1 ? "Buchung" : "Buchungen"}. Was soll damit geschehen?
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            disabled={pending}
            onClick={() => account && run(() => deleteAccount({ id: account.id, withTransactions: false }), { success: "Konto gelöscht", onSuccess: done })}
          >
            Nur das Konto löschen, Buchungen behalten
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => account && run(() => deleteAccount({ id: account.id, withTransactions: true }), { success: "Konto und Buchungen gelöscht", onSuccess: done })}
          >
            Konto mit allen Buchungen löschen
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(false)}>
            Abbrechen
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** Kontoauszug einlesen: erst Vorschau, dann bestätigen. Gespeichert wird erst beim zweiten Schritt. */
function ImportDialog({ open, onClose, accounts, defaultAccountId }: { open: boolean; onClose: () => void; accounts: AccountView[]; defaultAccountId?: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const close = () => {
    setPreview(null);
    setError(null);
    onClose();
  };
  const check = () => {
    setPreview(null);
    setError(null);
    const data = form.current ? new FormData(form.current) : null;
    const file = data?.get("file");
    if (!data || !(file instanceof File) || !file.size) return;
    startTransition(async () => {
      try {
        const result = await previewImport(data);
        if (result.ok) setPreview(result.data);
        else setError(result.error);
      } catch {
        setError("Die Datei konnte nicht hochgeladen werden. Ist sie größer als 4 MB?");
      }
    });
  };
  const submit = () => {
    if (!form.current) return;
    const data = new FormData(form.current);
    startTransition(async () => {
      try {
        const result = await runImport(data);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(
          `${result.data.imported} ${result.data.imported === 1 ? "Buchung" : "Buchungen"} importiert` +
            (result.data.duplicates ? `, ${result.data.duplicates} bereits vorhanden` : ""),
        );
        close();
      } catch {
        setError("Der Import ist fehlgeschlagen. Bitte versuche es erneut.");
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Kontoauszug importieren"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={pending || !preview || preview.fresh === 0} onClick={submit}>
            {pending ? "Einen Moment …" : preview?.fresh ? `${preview.fresh} ${preview.fresh === 1 ? "Buchung" : "Buchungen"} importieren` : "Importieren"}
          </Button>
        </>
      }
    >
      <form ref={form} className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <p className="text-sm text-pretty text-muted">
          Lade im Online-Banking deiner Bank die Umsätze als CSV-Datei herunter und wähle sie hier aus. Bereits vorhandene Buchungen werden erkannt
          und nicht doppelt angelegt.
        </p>
        <Field label="Konto">
          <select name="accountId" className="field" defaultValue={defaultAccountId ?? accounts[0]?.id} onChange={check}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="CSV-Datei">
          <input
            name="file"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={check}
            className="block w-full cursor-pointer rounded-[10px] border border-dashed border-line-strong bg-white/[0.03] p-3 text-sm text-ink-2 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/[0.1] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
          />
        </Field>
      </form>

      {pending && !preview ? <p className="mt-4 text-sm text-muted">Datei wird gelesen …</p> : null}
      {error ? (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-[10px] border border-critical/40 bg-critical/10 px-3 py-2.5 text-sm text-danger">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
      {preview ? (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="rounded-xl border border-line bg-white/[0.03] p-3 text-sm">
            <p className="font-medium text-ink">
              {preview.fresh} neue {preview.fresh === 1 ? "Buchung" : "Buchungen"}
              {preview.duplicates ? ` · ${preview.duplicates} bereits vorhanden` : ""}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {preview.from && preview.to ? `${formatMedium(preview.from)} – ${formatMedium(preview.to)} · ` : ""}
              Einnahmen {formatMoney(preview.incomeCents)} · Ausgaben {formatMoney(preview.expenseCents)}
              {preview.skipped ? ` · ${preview.skipped} Zeilen ohne Buchung übersprungen` : ""}
            </p>
            <p className="mt-1 text-xs text-muted">
              Erkannte Spalten: {[preview.columns.date, preview.columns.amount, preview.columns.counterparty, preview.columns.description].filter(Boolean).join(", ")}
            </p>
          </div>
          <ul className="divide-y divide-line text-sm">
            {preview.sample.map((row, i) => (
              <li key={i} className={cn("flex items-center gap-3 py-2", row.duplicate && "opacity-50")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{row.title}</span>
                  <span className="block text-xs text-muted">
                    {formatMedium(row.date)} · {row.category}
                    {row.duplicate ? " · bereits vorhanden" : ""}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-2">
                  {row.amountCents > 0 ? "+" : "−"} {formatMoney(Math.abs(row.amountCents))}
                </span>
              </li>
            ))}
          </ul>
          {preview.total > preview.sample.length ? <p className="text-xs text-muted">… und {preview.total - preview.sample.length} weitere. Kategorien kannst du nach dem Import anpassen.</p> : null}
        </div>
      ) : null}
    </Modal>
  );
}

export function FinanceView({
  month,
  today,
  transactions,
  history,
  budgets,
  accounts,
  accountId,
  holdings,
  snapshots,
}: {
  month: string;
  today: string;
  transactions: TxData[];
  history: MonthTotals[];
  budgets: Record<string, number>;
  accounts: AccountView[];
  /** gesetzt, wenn die Ansicht auf ein Konto eingeschränkt ist */
  accountId?: string;
  holdings: HoldingView[];
  snapshots: { date: string; valueCents: number }[];
}) {
  const [dialog, setDialog] = useState<{ tx: TxData | null } | null>(null);
  const [accountDialog, setAccountDialog] = useState<{ account: AccountView | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const activeAccount = accounts.find((a) => a.id === accountId);
  const href = (m: string, k: string | undefined = accountId) => `/finanzen?m=${m}${k ? `&k=${k}` : ""}`;
  const [budgetOpen, setBudgetOpen] = useState(false);
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

  const budgetRows = EXPENSE_CATEGORIES.filter((c) => budgets[c.key]).map((c) => ({
    ...c,
    budget: budgets[c.key],
    spent: byCategory.get(c.key) ?? 0,
  }));
  const budgetTotal = budgetRows.reduce((a, b) => a + b.budget, 0);
  const budgetSpent = budgetRows.reduce((a, b) => a + b.spent, 0);

  const dates = [...new Set(transactions.map((t) => t.date))];
  const hasHistory = history.some((h) => h.income || h.expense);

  return (
    <>
      <PageHeader title="Finanzen" subtitle={activeAccount ? `Nur Konto „${activeAccount.name}“` : "Einnahmen, Ausgaben und wohin dein Geld fließt."}>
        <div className="flex items-center rounded-[10px] border border-line bg-white/[0.03]">
          <Link href={href(addMonths(month, -1))} aria-label="Vorheriger Monat" className="flex size-10 items-center justify-center rounded-l-[10px] text-ink-2 hover:bg-white/[0.07]">
            <ChevronLeft size={17} />
          </Link>
          <span className="min-w-32 px-1 text-center text-sm font-medium capitalize">{formatMonth(month)}</span>
          <Link href={href(addMonths(month, 1))} aria-label="Nächster Monat" className="flex size-10 items-center justify-center rounded-r-[10px] text-ink-2 hover:bg-white/[0.07]">
            <ChevronRight size={17} />
          </Link>
        </div>
        <Button variant="primary" onClick={() => setDialog({ tx: null })}>
          <Plus size={16} />
          Neue Buchung
        </Button>
      </PageHeader>

      <div key={`${month}:${accountId ?? ""}`} className="stagger space-y-5">
        <Card>
          <CardHeader
            title="Konten"
            hint={
              accounts.length
                ? `Gesamt ${formatMoney(accounts.reduce((a, k) => a + k.balanceCents, 0))} · Tippe ein Konto an, um nur dessen Buchungen zu sehen.`
                : "Lege deine Konten an und lies die Umsätze deiner Bank als Kontoauszug ein."
            }
            action={
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {accounts.length ? (
                  <Button size="sm" onClick={() => setImportOpen(true)}>
                    <FileUp size={14} />
                    Kontoauszug importieren
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => setAccountDialog({ account: null })}>
                  <Plus size={14} />
                  Konto
                </Button>
              </div>
            }
          />
          {accounts.length ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((a) => {
                const active = a.id === accountId;
                return (
                  <li key={a.id} className={cn("relative rounded-xl border transition-colors", active ? "border-accent/60 bg-accent-soft" : "border-line bg-white/[0.02] hover:border-line-strong")}>
                    <Link href={href(month, active ? "" : a.id)} aria-current={active ? "true" : undefined} className="block p-3.5 pr-12">
                      <span className="flex items-center gap-2 text-[13px] text-muted">
                        <Landmark size={14} style={{ color: slotVar(a.color) }} />
                        {ACCOUNT_KIND_LABEL[a.kind as AccountKind] ?? "Konto"}
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium text-ink">{a.name}</span>
                      <span className="mt-1 block text-lg font-semibold tracking-tight text-ink tabular-nums">{formatMoney(a.balanceCents)}</span>
                    </Link>
                    <IconButton label={`„${a.name}“ bearbeiten`} className="absolute top-2 right-2" onClick={() => setAccountDialog({ account: a })}>
                      <Pencil size={14} />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>

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

        <Card>
          <CardHeader
            title="Budgets"
            hint={
              budgetRows.length
                ? `${formatMoney(budgetSpent)} von ${formatMoney(budgetTotal)} verbraucht · ${formatMonth(month)}`
                : "Setze dir Monatsgrenzen je Kategorie und sieh, wie viel noch übrig ist."
            }
            action={
              <Button size="sm" onClick={() => setBudgetOpen(true)}>
                {budgetRows.length ? "Bearbeiten" : "Budgets festlegen"}
              </Button>
            }
          />
          {budgetRows.length ? (
            <ul className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              {budgetRows.map((b) => {
                const over = b.spent > b.budget;
                return (
                  <li key={b.key}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-ink">
                        <Dot color={slotVar(b.color)} />
                        <span className="truncate">{b.label}</span>
                      </span>
                      <span className="shrink-0 text-[13px] text-muted tabular-nums">
                        {formatMoney(b.spent)} / {formatMoney(b.budget)}
                      </span>
                    </div>
                    <ProgressBar value={b.spent / b.budget} color={over ? "var(--color-critical)" : slotVar(b.color)} label={`Budget ${b.label}`} />
                    <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs", over ? "text-danger" : "text-muted")}>
                      {over ? <CircleAlert size={12} /> : null}
                      {over ? `${formatMoney(b.spent - b.budget)} über dem Budget` : `Noch ${formatMoney(b.budget - b.spent)} übrig`}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>

        {accountId ? null : <PortfolioCard holdings={holdings} snapshots={snapshots} cashCents={accounts.reduce((a, k) => a + k.balanceCents, 0)} today={today} />}

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
                              <span className="block truncate text-sm text-ink">{t.counterparty || t.description || meta.label}</span>
                              <span className="block truncate text-xs text-muted">
                                {meta.label}
                                {t.counterparty && t.description ? ` · ${t.description}` : ""}
                              </span>
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

      <BudgetDialog open={budgetOpen} onClose={() => setBudgetOpen(false)} budgets={budgets} />
      <TransactionDialog
        key={dialog?.tx?.id ?? "new"}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        tx={dialog?.tx}
        defaultDate={isCurrent ? today : `${month}-01`}
        accounts={accounts}
        defaultAccountId={accountId}
      />
      <AccountDialog key={accountDialog?.account?.id ?? "new-account"} open={accountDialog !== null} onClose={() => setAccountDialog(null)} account={accountDialog?.account} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} accounts={accounts} defaultAccountId={accountId} />
    </>
  );
}
