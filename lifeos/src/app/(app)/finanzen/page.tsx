import { FinanceView } from "@/features/finance/finance-view";
import { listBudgets, listTransactions, monthlyTotals } from "@/features/finance/queries";
import { getClock, requireUser } from "@/lib/auth/session";
import { isMonthKey, monthOf } from "@/lib/dates";

export const metadata = { title: "Finanzen" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const [{ today }, params] = await Promise.all([getClock(), searchParams]);
  const month = isMonthKey(params.m) ? params.m : monthOf(today);
  const [transactions, history, budgets] = await Promise.all([
    listTransactions(user.id, month),
    monthlyTotals(user.id, month, 6),
    listBudgets(user.id),
  ]);
  return (
    <FinanceView
      month={month}
      today={today}
      history={history}
      budgets={budgets}
      transactions={transactions.map(({ id, type, amountCents, category, description, date }) => ({
        id, type, amountCents, category, description, date,
      }))}
    />
  );
}
