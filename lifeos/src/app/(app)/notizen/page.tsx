import { NotesView } from "@/features/notes/notes-view";
import { listNotes } from "@/features/notes/queries";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Notizen" };

export default async function NotesPage() {
  const user = await requireUser();
  return <NotesView notes={await listNotes(user.id)} />;
}
