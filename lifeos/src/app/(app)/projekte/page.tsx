import { ProjectsView } from "@/features/projects/project-ui";
import { listProjects } from "@/features/projects/queries";
import { getClock, requireUser } from "@/lib/auth/session";

export const metadata = { title: "Projekte" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const [{ today }, projects] = await Promise.all([getClock(), listProjects(user.id)]);
  return <ProjectsView projects={projects} today={today} />;
}
