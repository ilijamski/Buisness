import { GoalsView } from "@/features/goals/goals-view";
import { listGoals } from "@/features/goals/queries";
import { getClock, requireUser } from "@/lib/auth/session";

export const metadata = { title: "Ziele" };

export default async function GoalsPage() {
  const user = await requireUser();
  const [{ today }, goals] = await Promise.all([getClock(), listGoals(user.id)]);
  return (
    <GoalsView
      today={today}
      goals={goals.map(({ id, title, description, category, current, target, unit, deadline, completedOn }) => ({
        id, title, description, category, current, target, unit, deadline, completedOn,
      }))}
    />
  );
}
