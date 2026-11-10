import { listProjects } from "@/features/projects/queries";
import { listTasks } from "@/features/tasks/queries";
import { TasksView } from "@/features/tasks/tasks-view";
import { getClock, requireUser } from "@/lib/auth/session";

export const metadata = { title: "Aufgaben" };

export default async function TasksPage() {
  const user = await requireUser();
  const [{ today }, tasks, projects] = await Promise.all([getClock(), listTasks(user.id), listProjects(user.id)]);
  return <TasksView tasks={tasks} today={today} projects={projects.map(({ id, name, color }) => ({ id, name, color }))} />;
}
