import { NotesView } from "@/features/notes/notes-view";
import { listFolders, listNotes } from "@/features/notes/queries";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Notizen" };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser();
  const [notes, folders, params] = await Promise.all([listNotes(user.id), listFolders(user.id), searchParams]);
  const id = notes.some((n) => n.id === params.id) ? params.id : undefined;
  return <NotesView key={id ?? "list"} notes={notes} folders={folders} initialId={id} />;
}
