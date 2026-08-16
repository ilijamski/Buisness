import { notFound } from "next/navigation";
import { requireActiveSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle } from "@/components/ui";
import { CheckForm } from "@/components/forms/CheckForm";
import { DEFAULT_CHECK_ITEMS } from "@/lib/checks";
import type { CheckTemplate, Vehicle } from "@/lib/types";

/**
 * Abfahrtskontrolle für ein Fahrzeug.
 *
 * Gibt es keine Vorlage in der Firma, wird die Standardliste genommen statt
 * eine Fehlermeldung zu zeigen: Der Fahrer steht am Fahrzeug und will los —
 * ihn hier an eine Einstellung zu verweisen, die nur der Admin ändern kann,
 * würde die Funktion in der Praxis nie zum Einsatz bringen.
 */
export default async function CheckPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const { profile, company } = await requireActiveSession();
  const supabase = await createClient();

  const [{ data: vehicle }, { data: templates }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle(),
    supabase
      .from("check_templates")
      .select("*")
      .eq("active", true)
      .order("is_default", { ascending: false }),
  ]);

  // RLS liefert nichts, wenn das Fahrzeug nicht zugewiesen ist — für den
  // Fahrer sieht das aus wie „gibt es nicht", und genau so soll es sein.
  if (!vehicle) notFound();

  const vehicleRow = vehicle as Vehicle;
  const templateList = (templates as CheckTemplate[] | null) ?? [];
  const template = templateList[0] ?? null;
  const items = template?.items?.length ? template.items : DEFAULT_CHECK_ITEMS;

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <PageTitle
          title="Abfahrtskontrolle"
          subtitle={`${vehicleRow.name} · ${vehicleRow.plate}`}
        />

        <Card title={template?.name ?? "Abfahrtskontrolle (Standard)"}>
          <CheckForm
            vehicleId={vehicleRow.id}
            vehicleName={vehicleRow.name}
            templateId={template?.id ?? null}
            items={items}
            currentMileage={vehicleRow.current_mileage}
          />
        </Card>
      </main>
    </>
  );
}
