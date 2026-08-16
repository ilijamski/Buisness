import { requireActiveAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Card, PageTitle, EmptyState, Badge } from "@/components/ui";
import { JobForm } from "@/components/admin/JobForm";
import { formatDateTime } from "@/lib/format";
import type { JobStatus, JobWithContext, Profile, Vehicle } from "@/lib/types";

const STATUS_LABELS: Record<JobStatus, string> = {
  geplant: "Geplant",
  unterwegs: "Unterwegs",
  erledigt: "Erledigt",
  abgebrochen: "Abgebrochen",
};

/** Aufträge planen und zuweisen. */
export default async function AdminJobsPage() {
  const { profile, company } = await requireActiveAdmin();
  const supabase = await createClient();

  const [{ data: jobs }, { data: vehicles }, { data: staff }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, vehicles(id, name, plate), profiles!jobs_assigned_to_fkey(id, full_name, email)")
      .order("scheduled_for", { ascending: true, nullsFirst: false }),
    supabase.from("vehicles").select("id, name, plate").order("vehicle_number"),
    supabase.from("profiles").select("id, full_name, email").order("employee_number"),
  ]);

  const jobList = (jobs as JobWithContext[] | null) ?? [];
  const vehicleList = (vehicles as Pick<Vehicle, "id" | "name" | "plate">[] | null) ?? [];
  const driverList =
    (staff as Pick<Profile, "id" | "full_name" | "email">[] | null) ?? [];

  const open = jobList.filter(
    (job) => job.status === "geplant" || job.status === "unterwegs",
  );
  const closed = jobList.filter(
    (job) => job.status === "erledigt" || job.status === "abgebrochen",
  );

  return (
    <>
      <Header profile={profile} company={company} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <PageTitle
          title="Aufträge"
          subtitle="Was welcher Fahrer mit welchem Fahrzeug zu erledigen hat."
        />

        <Card title="Neuer Auftrag">
          <JobForm vehicles={vehicleList} drivers={driverList} />
        </Card>

        <Card
          title="Offen"
          action={open.length > 0 ? <Badge tone="warn">{open.length}</Badge> : undefined}
        >
          {open.length === 0 ? (
            <EmptyState>Nichts geplant.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {open.map((job) => (
                <li key={job.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-muted">
                        {job.profiles?.full_name || job.profiles?.email || "Nicht zugewiesen"}
                        {job.vehicles ? ` · ${job.vehicles.name}` : ""}
                        {job.scheduled_for ? ` · ${formatDateTime(job.scheduled_for)}` : ""}
                      </p>
                      {job.address && <p className="text-xs text-muted">{job.address}</p>}
                      {job.driver_note && (
                        <p className="mt-1 text-xs italic text-muted">
                          Notiz vom Fahrer: {job.driver_note}
                        </p>
                      )}
                    </div>
                    <Badge tone={job.status === "unterwegs" ? "warn" : "neutral"}>
                      {STATUS_LABELS[job.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {closed.length > 0 && (
          <Card title="Abgeschlossen">
            <ul className="divide-y divide-border">
              {closed.slice(0, 50).map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm">{job.title}</p>
                    <p className="text-xs text-muted">
                      {job.profiles?.full_name || job.profiles?.email || "—"}
                      {job.completed_at ? ` · ${formatDateTime(job.completed_at)}` : ""}
                    </p>
                    {job.driver_note && (
                      <p className="mt-1 text-xs italic text-muted">{job.driver_note}</p>
                    )}
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
