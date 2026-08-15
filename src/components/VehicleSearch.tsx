"use client";

import { useMemo, useState } from "react";
import { VehicleList } from "@/components/VehicleList";
import { Field } from "@/components/ui";
import type { ModuleConfig } from "@/lib/modules";
import type { Vehicle } from "@/lib/types";

/**
 * Fahrzeugliste mit Sofortsuche. Ab etwa zehn Fahrzeugen wird Scrollen
 * mühsam — gesucht wird über Nummer, Name, Kennzeichen und Typ.
 */
export function VehicleSearch({
  vehicles,
  config,
  driverNames,
}: {
  vehicles: Vehicle[];
  config: ModuleConfig;
  driverNames?: Map<string, string>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return vehicles;

    return vehicles.filter((vehicle) =>
      [
        vehicle.vehicle_number?.toString(),
        vehicle.name,
        vehicle.plate,
        vehicle.type,
        driverNames?.get(vehicle.id),
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [vehicles, query, driverNames]);

  return (
    <div className="space-y-3">
      {vehicles.length > 5 && (
        <Field label="Suche">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nummer, Name, Kennzeichen oder Fahrer…"
          />
        </Field>
      )}

      {filtered.length === 0 && query ? (
        <p className="py-2 text-sm text-muted">Kein Fahrzeug gefunden.</p>
      ) : (
        <VehicleList vehicles={filtered} config={config} driverNames={driverNames} />
      )}
    </div>
  );
}
