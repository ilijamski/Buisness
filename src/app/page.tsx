import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export default async function Home() {
  const { profile } = await requireSession();
  redirect(profile.role === "admin" ? "/admin" : "/mitarbeiter");
}
