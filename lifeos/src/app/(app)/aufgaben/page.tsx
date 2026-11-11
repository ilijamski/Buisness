import { listProjects } from "@/features/projects/queries";
import { listTasks } from "@/features/tasks/queries";
import { TasksView } from "@/features/tasks/tasks-view";
import { getClock, requireUser } from "@/lib/auth/session";

export const metadata = { title: "Aufgaben" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const [{ today }, tasks, projects, params] = await Promise.all([getClock(), listTasks(user.id), listProjects(user.id), searchParams]);
  const q = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  return <TasksView key={q} initialQuery={q} tasks={tasks} today={today} projects={projects.map(({ id, name, color }) => ({ id, name, color }))} />;
}
