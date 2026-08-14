import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { CostByVehicle } from "@/components/CostByVehicle";
import { AllEntriesTable } from "@/components/AllEntriesTable";
import { AddVehicleForm } from "@/components/AddVehicleForm";
import { VehicleCard } from "@/components/VehicleCard";
import type { Entry, EntryWithVehicle, Profile, Vehicle } from "@/lib/types";

export default async function AdminPage() {
  const { profile } = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/mitarbeiter");
  }

  const supabase = await createClient();

  const [{ data: vehicles }, { data: entries }, { data: profiles }] = await Promise.all([
    supabase.from("vehicles").select("*").order("name"),
    supabase
      .from("entries")
      .select("*, vehicles(id, name, plate)")
      .order("date", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);

  const vehicleList = (vehicles as Vehicle[] | null) ?? [];
  const entryList = (entries as EntryWithVehicle[] | null) ?? [];
  const authorEmails = new Map(
    ((profiles as Profile[] | null) ?? []).map((p) => [p.id, p.email]),
  );

  return (
    <div className="min-h-screen bg-bg">
      <Header profile={profile} />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <section>
          <CostByVehicle vehicles={vehicleList} entries={entryList as Entry[]} />
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-fg">Fahrzeuge</h2>
            <div className="space-y-2">
              {vehicleList.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
              {vehicleList.length === 0 && (
                <p className="text-sm text-muted">Noch keine Fahrzeuge im Fuhrpark.</p>
              )}
            </div>
          </div>

          <AddVehicleForm />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-fg">Alle Einträge</h2>
          <AllEntriesTable entries={entryList} authorEmails={authorEmails} />
        </section>
      </main>
    </div>
  );
}
