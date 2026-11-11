import { FinanceView } from "@/features/finance/finance-view";
import { listAccounts, listBudgets, listHoldings, listSnapshots, listTransactions, monthlyTotals } from "@/features/finance/queries";
import { getClock, requireUser } from "@/lib/auth/session";
import { isMonthKey, monthOf } from "@/lib/dates";

export const metadata = { title: "Finanzen" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ m?: string; k?: string }> }) {
  const user = await requireUser();
  const [{ today }, params] = await Promise.all([getClock(), searchParams]);
  const month = isMonthKey(params.m) ? params.m : monthOf(today);
  const accounts = await listAccounts(user.id);
  const accountId = accounts.find((a) => a.id === params.k)?.id;
  const [transactions, history, budgets, holdings, snapshots] = await Promise.all([
    listTransactions(user.id, month, accountId),
    monthlyTotals(user.id, month, 6, accountId),
    listBudgets(user.id),
    listHoldings(user.id),
    listSnapshots(user.id),
  ]);
  return (
    <FinanceView
      month={month}
      today={today}
      history={history}
      budgets={budgets}
      accounts={accounts}
      accountId={accountId}
      holdings={holdings}
      snapshots={snapshots}
      transactions={transactions.map(({ id, type, amountCents, category, description, counterparty, accountId: account, date }) => ({
        id, type, amountCents, category, description, counterparty, accountId: account, date,
      }))}
    />
  );
}
