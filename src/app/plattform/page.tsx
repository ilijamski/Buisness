import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, EmptyState, Badge } from "@/components/ui";
import { PromoCodeForm } from "@/components/billing/PromoCodeForm";
import { PlatformStats } from "@/components/billing/PlatformStats";
import { formatDate } from "@/lib/format";
import type {
  PromoCode,
  PlatformCompany,
  PlatformStats as PlatformStatsType,
} from "@/lib/types";

/**
 * Betreiber-Bereich: Testcodes erzeugen und deren Nutzung verfolgen.
 *
 * Sichtbar nur für Plattform-Admins (Tabelle `platform_admins`). Für alle
 * anderen verhält sich die Seite, als gäbe es sie nicht — kein Hinweis auf
 * ihre Existenz.
 */
export default async function PlatformPage() {
  const { profile, company, isPlatformAdmin } = await requireSession();
  if (!isPlatformAdmin) notFound();

  const supabase = await createClient();

  const [{ data: stats }, { data: companies }, { data: codes }] = await Promise.all([
    supabase.rpc("platform_stats"),
    supabase.rpc("platform_companies"),
    // RLS gibt die Codeliste ohnehin nur Plattform-Admins frei.
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
  ]);

  const codeList = (codes as PromoCode[] | null) ?? [];

  return (
    <>
      <Header profile={profile} company={company} />

      {/* Breiter als die übrigen Seiten: die Kundentabelle braucht den Platz,
          sonst wird die letzte Spalte abgeschnitten. */}
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Betreiber-Dashboard"
          subtitle="Nur für dich sichtbar: Kennzahlen, Kunden und Testcodes."
        />

        {stats && (
          <PlatformStats
            stats={stats as PlatformStatsType}
            companies={(companies as PlatformCompany[] | null) ?? []}
          />
        )}

        <Card title="Neuen Code erzeugen">
          <PromoCodeForm />
        </Card>

        <Card title="Ausgegebene Codes">
          {codeList.length === 0 ? (
            <EmptyState>Noch keine Codes erzeugt.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {codeList.map((code) => {
                const usedUp = code.used_count >= code.max_uses;
                return (
                  <li key={code.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-mono text-sm font-medium">{code.code}</p>
                      <p className="text-xs text-muted">
                        {code.grants_days} Tage · {code.used_count}/{code.max_uses} eingelöst
                        {code.note ? ` · ${code.note}` : ""} · erstellt{" "}
                        {formatDate(code.created_at)}
                      </p>
                    </div>
                    <Badge tone={!code.active ? "neutral" : usedUp ? "danger" : "ok"}>
                      {!code.active ? "deaktiviert" : usedUp ? "aufgebraucht" : "offen"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </main>
    </>
  );
}
