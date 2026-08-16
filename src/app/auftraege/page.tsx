import { requireActiveSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, EmptyState, Badge } from "@/components/ui";
import { JobStatusForm } from "@/components/JobStatusForm";
import { formatDateTime } from "@/lib/format";
import type { JobStatus, JobWithContext } from "@/lib/types";

const STATUS_LABELS: Record<JobStatus, string> = {
  geplant: "Geplant",
  unterwegs: "Unterwegs",
  erledigt: "Erledigt",
  abgebrochen: "Abgebrochen",
};

/**
 * Aufträge des angemeldeten Fahrers.
 *
 * RLS liefert nur die eigenen — für Admins alle der Firma, die haben aber
 * ihre eigene Seite unter /admin/auftraege mit Anlegen und Zuweisen.
 */
export default async function JobsPage() {
  const { profile, company } = await requireActiveSession();
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, vehicles(id, name, plate), profiles!jobs_assigned_to_fkey(id, full_name, email)")
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  const jobList = (jobs as JobWithContext[] | null) ?? [];
  const open = jobList.filter(
    (job) => job.status === "geplant" || job.status === "unterwegs",
  );
  const closed = jobList.filter(
    (job) => job.status === "erledigt" || job.status === "abgebrochen",
  );

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <PageTitle title="Meine Aufträge" subtitle="Was heute ansteht." />

        <Card
          title="Offen"
          action={open.length > 0 ? <Badge tone="warn">{open.length}</Badge> : undefined}
        >
          {open.length === 0 ? (
            <EmptyState>
              Nichts geplant. Neue Aufträge erscheinen hier, sobald dein
              Fuhrpark-Admin sie dir zuweist.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {open.map((job) => (
                <li key={job.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{job.title}</p>
                      {job.description && (
                        <p className="mt-0.5 text-sm text-muted">{job.description}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted">
                        {job.address ?? "Ohne Adresse"}
                        {job.scheduled_for ? ` · ${formatDateTime(job.scheduled_for)}` : ""}
                        {job.vehicles ? ` · ${job.vehicles.name}` : ""}
                      </p>
                    </div>
                    <Badge tone={job.status === "unterwegs" ? "warn" : "neutral"}>
                      {STATUS_LABELS[job.status]}
                    </Badge>
                  </div>

                  {job.address && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-sm text-accent underline underline-offset-2"
                    >
                      Route öffnen
                    </a>
                  )}

                  <JobStatusForm job={job} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {closed.length > 0 && (
          <Card title="Erledigt">
            <ul className="divide-y divide-border">
              {closed.slice(0, 20).map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm">{job.title}</p>
                    <p className="text-xs text-muted">
                      {job.completed_at ? formatDateTime(job.completed_at) : "—"}
                    </p>
                  </div>
                  <Badge tone={job.status === "erledigt" ? "ok" : "neutral"}>
                    {STATUS_LABELS[job.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>
    </>
  );
}
