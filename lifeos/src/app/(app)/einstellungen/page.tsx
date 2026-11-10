import { SettingsView } from "@/features/account/settings-view";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireUser();
  const storage = process.env.DATABASE_URL
    ? "Deine Daten liegen dauerhaft in einer Postgres-Datenbank."
    : "Deine Daten liegen dauerhaft in der eingebetteten Postgres-Datenbank auf diesem Server (Ordner .data).";
  return <SettingsView user={{ name: user.name, email: user.email }} storage={storage} />;
}
