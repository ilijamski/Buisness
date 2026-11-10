"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { COLOR_NAME, COLOR_SLOTS, slotVar } from "@/lib/constants";

/** Farbauswahl als Radiogruppe; der Wert landet als `name` im Formular. */
export function ColorPicker({ name, defaultValue = 1 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div role="radiogroup" aria-label="Farbe" className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={value} />
      {COLOR_SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          role="radio"
          aria-checked={value === slot}
          aria-label={COLOR_NAME[slot]}
          title={COLOR_NAME[slot]}
          onClick={() => setValue(slot)}
          className="flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110 aria-checked:ring-2 aria-checked:ring-white/70 aria-checked:ring-offset-2 aria-checked:ring-offset-raised"
          style={{ background: slotVar(slot) }}
        >
          {value === slot ? <Check size={14} strokeWidth={3} className="text-white" /> : null}
        </button>
      ))}
    </div>
  );
}
