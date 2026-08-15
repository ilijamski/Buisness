import { Field } from "@/components/ui";
import {
  MODULES,
  MODULE_GROUP_LABELS,
  isEnabled,
  isRequired,
  type ModuleConfig,
  type ModuleField,
  type ModuleGroup,
} from "@/lib/modules";
import type { Vehicle } from "@/lib/types";

function inputProps(field: ModuleField) {
  switch (field.type) {
    case "date":
      return { type: "date" as const };
    case "number":
      return { type: "number" as const, step: "1", min: "0" };
    case "decimal":
      return { type: "number" as const, step: "0.01", min: "0" };
    default:
      return { type: "text" as const };
  }
}

function valueFor(vehicle: Vehicle | null, field: ModuleField): string {
  if (!vehicle) return "";
  const value = vehicle[field.key];
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Rendert die Eingabefelder aller aktiven Module einer Gruppe.
 * `scope` steuert, ob nur fahrerbearbeitbare Felder gezeigt werden.
 */
export function ModuleFields({
  group,
  config,
  vehicle,
  scope = "admin",
}: {
  group: ModuleGroup;
  config: ModuleConfig;
  vehicle: Vehicle | null;
  scope?: "admin" | "driver";
}) {
  const modules = MODULES.filter(
    (m) => m.group === group && m.fields.length > 0 && isEnabled(config, m.key),
  );

  const visible = modules
    .map((module) => ({
      module,
      fields: module.fields.filter((f) => scope === "admin" || f.driverEditable),
    }))
    .filter((m) => m.fields.length > 0);

  if (visible.length === 0) return null;

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold">{MODULE_GROUP_LABELS[group]}</legend>

      {visible.map(({ module, fields }) => (
        <div key={module.key} className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {module.label}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => {
              const required = isRequired(config, module.key) && field.requirable === true;
              return (
                <Field
                  key={field.key}
                  label={field.label}
                  hint={field.hint}
                  required={required}
                >
                  <input
                    name={field.key}
                    required={required}
                    defaultValue={valueFor(vehicle, field)}
                    {...inputProps(field)}
                  />
                </Field>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
