import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui";
import { urgentDeadlines, deadlineText } from "@/lib/deadlines";
import type { ModuleConfig } from "@/lib/modules";
import type { Vehicle } from "@/lib/types";

export function VehicleList({
  vehicles,
  config,
  driverNames,
}: {
  vehicles: Vehicle[];
  config: ModuleConfig;
  driverNames?: Map<string, string>;
}) {
  if (vehicles.length === 0) {
    return <EmptyState>Noch keine Fahrzeuge angelegt.</EmptyState>;
  }

  return (
    <ul className="divide-y divide-border">
      {vehicles.map((vehicle) => {
        const urgent = urgentDeadlines(vehicle, config);
        const driver = driverNames?.get(vehicle.id);

        return (
          <li key={vehicle.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/fahrzeuge/${vehicle.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {vehicle.vehicle_number !== null && (
                    <span className="text-muted">#{vehicle.vehicle_number} </span>
                  )}
                  {vehicle.name}
                </Link>
                <p className="text-sm text-muted">
                  {vehicle.plate}
                  {vehicle.type ? ` · ${vehicle.type}` : ""}
                  {driver ? ` · Fahrer: ${driver}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {urgent.slice(0, 3).map((deadline) => (
                  <Badge
                    key={deadline.moduleKey}
                    tone={deadline.status === "overdue" ? "danger" : "warn"}
                  >
                    {deadline.label}: {deadlineText(deadline)}
                  </Badge>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
