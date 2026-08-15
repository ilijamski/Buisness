"use client";

import { useActionState } from "react";
import { saveVehicleModules } from "@/app/admin/actions";
import { Button, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";
import { MODULES, MODULE_GROUP_LABELS, type ModuleGroup } from "@/lib/modules";
import type { VehicleModuleSetting } from "@/lib/types";

const GROUPS: ModuleGroup[] = ["fristen", "wartung", "fahrer", "finanzen", "dokumente"];

/** "erben" = null in der DB, sodass die Firmeneinstellung greift. */
function toValue(flag: boolean | null | undefined): "inherit" | "on" | "off" {
  if (flag === null || flag === undefined) return "inherit";
  return flag ? "on" : "off";
}

export function VehicleModuleOverrides({
  vehicleId,
  overrides,
}: {
  vehicleId: string;
  overrides: VehicleModuleSetting[];
}) {
  const [state, formAction, pending] = useActionState(saveVehicleModules, idleState);
  const byKey = new Map(overrides.map((o) => [o.module_key, o]));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="vehicle_id" value={vehicleId} />

      {GROUPS.map((group) => (
        <div key={group}>
          <h4 className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
            {MODULE_GROUP_LABELS[group]}
          </h4>
          <ul className="divide-y divide-border border-y border-border">
            {MODULES.filter((m) => m.group === group).map((module) => {
              const current = byKey.get(module.key);
              return (
                <li
                  key={module.key}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="text-sm">{module.label}</span>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 text-xs text-muted">
                      Aktiv
                      <select
                        name={`enabled:${module.key}`}
                        defaultValue={toValue(current?.enabled)}
                        className="w-auto py-1 text-xs"
                      >
                        <option value="inherit">erben</option>
                        <option value="on">ja</option>
                        <option value="off">nein</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs text-muted">
                      Pflicht
                      <select
                        name={`required:${module.key}`}
                        defaultValue={toValue(current?.required)}
                        className="w-auto py-1 text-xs"
                      >
                        <option value="inherit">erben</option>
                        <option value="on">ja</option>
                        <option value="off">nein</option>
                      </select>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Fahrzeug-Einstellungen gespeichert.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Fahrzeug-Einstellungen speichern"}
      </Button>
    </form>
  );
}
