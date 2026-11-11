import { notFound } from "next/navigation";
import { z } from "zod";
import { ProjectBoard } from "@/features/projects/project-ui";
import { getProject } from "@/features/projects/queries";
import { listTasks } from "@/features/tasks/queries";
import { getClock, requireUser } from "@/lib/auth/session";

export const metadata = { title: "Projekt" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ today }, project, tasks] = await Promise.all([getClock(), getProject(user.id, id), listTasks(user.id)]);
  if (!project) notFound();
  return (
    <ProjectBoard
      today={today}
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        color: project.color,
        dueDate: project.dueDate,
      }}
      tasks={tasks.filter((t) => t.projectId === project.id)}
    />
  );
}
