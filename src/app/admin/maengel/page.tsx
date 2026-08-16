import { requireActiveAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, EmptyState, Badge, Notice } from "@/components/ui";
import { DefectRow } from "@/components/admin/DefectRow";
import { getSignedUrls, DEFECTS_BUCKET } from "@/lib/receipts";
import { byUrgency, isOpen } from "@/lib/checks";
import { isMissingSchema, MISSING_SCHEMA_HINT } from "@/lib/schema";
import type { DefectWithContext } from "@/lib/types";

/**
 * Mängelliste der Flotte.
 *
 * Offene zuerst und darin die kritischen — was lange liegt, rutscht nicht
 * nach unten. Erledigte bleiben sichtbar, aber getrennt: sie sind der
 * Nachweis, dass etwas getan wurde.
 */
export default async function AdminDefectsPage() {
  const { profile, company } = await requireActiveAdmin();
  const supabase = await createClient();

  const { data: defects, error } = await supabase
    .from("defects")
    .select("*, vehicles(id, name, plate), profiles!defects_reported_by_fkey(id, full_name, email)")
    .order("created_at", { ascending: false });

  const defectList = ((defects as DefectWithContext[] | null) ?? []).sort(byUrgency);
  const open = defectList.filter(isOpen);
  const closed = defectList.filter((defect) => !isOpen(defect));

  const photoUrls = await getSignedUrls(
    supabase,
    DEFECTS_BUCKET,
    defectList.map((defect) => defect.photo_path),
  );

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Mängel"
          subtitle="Aus Fahrzeugchecks und Meldungen der Fahrer."
        />

        {isMissingSchema(error) && <Notice kind="info">{MISSING_SCHEMA_HINT}</Notice>}

        <Card
          title="Offen"
          action={open.length > 0 ? <Badge tone="warn">{open.length}</Badge> : undefined}
        >
          {open.length === 0 ? (
            <EmptyState>
              Keine offenen Mängel. Meldungen aus der Abfahrtskontrolle landen
              automatisch hier.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {open.map((defect) => (
                <DefectRow
                  key={defect.id}
                  defect={defect}
                  photoUrl={
                    defect.photo_path ? photoUrls.get(defect.photo_path) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </Card>

        {closed.length > 0 && (
          <Card title="Abgeschlossen">
            <ul className="divide-y divide-border">
              {closed.slice(0, 50).map((defect) => (
                <DefectRow
                  key={defect.id}
                  defect={defect}
                  photoUrl={
                    defect.photo_path ? photoUrls.get(defect.photo_path) : undefined
                  }
                />
              ))}
            </ul>
          </Card>
        )}
      </main>
    </>
  );
}
