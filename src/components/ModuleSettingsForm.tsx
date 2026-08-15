"use client";

import { useActionState } from "react";
import { saveCompanyModules } from "@/app/admin/actions";
import { Button, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";
import {
  MODULES,
  MODULE_GROUP_LABELS,
  type ModuleConfig,
  type ModuleGroup,
} from "@/lib/modules";

const GROUPS: ModuleGroup[] = ["fristen", "wartung", "fahrer", "finanzen", "dokumente"];

export function ModuleSettingsForm({ config }: { config: ModuleConfig }) {
  const [state, formAction, pending] = useActionState(saveCompanyModules, idleState);

  return (
    <form action={formAction} className="space-y-5">
      {GROUPS.map((group) => (
        <div key={group} className="rounded border border-border bg-bg">
          <h3 className="border-b border-border px-4 py-2 text-sm font-semibold">
            {MODULE_GROUP_LABELS[group]}
          </h3>
          <ul className="divide-y divide-border">
            {MODULES.filter((m) => m.group === group).map((module) => {
              const current = config.get(module.key);
              return (
                <li
                  key={module.key}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-[12rem] flex-1">
                    <p className="text-sm font-medium">{module.label}</p>
                    <p className="text-xs text-muted">{module.description}</p>
                  </div>

                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        name={`enabled:${module.key}`}
                        defaultChecked={current?.enabled ?? true}
                      />
                      <span>Aktiv</span>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        name={`required:${module.key}`}
                        defaultChecked={current?.required ?? false}
                      />
                      <span>Pflicht</span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && <Notice kind="success">Einstellungen gespeichert.</Notice>}

      <div className="sticky bottom-0 border-t border-border bg-page py-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern…" : "Einstellungen speichern"}
        </Button>
      </div>
    </form>
  );
}
