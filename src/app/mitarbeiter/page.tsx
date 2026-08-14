import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { VehicleCard } from "@/components/VehicleCard";
import { NewEntryForm } from "@/components/NewEntryForm";
import { EntryHistory } from "@/components/EntryHistory";
import type { EntryWithVehicle, Vehicle } from "@/lib/types";

export default async function MitarbeiterPage() {
  const { profile } = await requireProfile();
  if (profile.role === "admin") {
    redirect("/admin");
  }

  const supabase = await createClient();

  const [{ data: vehicles }, { data: entries }] = await Promise.all([
    supabase.from("vehicles").select("*").order("name"),
    supabase
      .from("entries")
      .select("*, vehicles(id, name, plate)")
      .order("date", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <Header profile={profile} />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-fg">Fahrzeuge</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(vehicles as Vehicle[] | null)?.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
            {(!vehicles || vehicles.length === 0) && (
              <p className="text-sm text-muted">Noch keine Fahrzeuge im Fuhrpark.</p>
            )}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <NewEntryForm vehicles={(vehicles as Vehicle[] | null) ?? []} />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-fg">Meine Historie</h2>
            <EntryHistory entries={(entries as EntryWithVehicle[] | null) ?? []} />
          </div>
        </section>
      </main>
    </div>
  );
}
