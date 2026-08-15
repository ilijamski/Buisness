import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.company_id) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold">Fast geschafft</h1>
      <p className="mt-1 text-sm text-muted">
        Dein Konto ist noch keiner Firma zugeordnet. Lege eine Firma an oder tritt
        mit dem Code deines Admins bei.
      </p>
      <OnboardingForm invitedCode={code?.trim().toUpperCase() ?? ""} />
    </main>
  );
}
