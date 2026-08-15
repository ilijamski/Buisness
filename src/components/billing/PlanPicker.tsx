"use client";

import { useActionState, useEffect, useState } from "react";
import { startCheckout, redeemCode } from "@/app/abo/actions";
import { Button, Notice } from "@/components/ui";
import { idleState } from "@/lib/action-state";
import {
  PLANS,
  VAT_RATE,
  formatPrice,
  netFromGross,
  vatFromGross,
  type Plan,
} from "@/lib/billing";
import { isNative } from "@/lib/native";

/**
 * Tarifauswahl und Code-Einlösung.
 *
 * In der nativen App wird die Kaufoberfläche ausgeblendet: Apple verlangt für
 * digitale Käufe innerhalb der App die eigene Abrechnung (Richtlinie 3.1.1).
 * Das Abo wird deshalb im Web abgeschlossen — die App weist nur darauf hin,
 * ohne zu verlinken oder zu werben.
 */
export function PlanPicker() {
  const [plan, setPlan] = useState<Plan>("monthly");
  const [native, setNative] = useState(false);
  const [checkoutState, checkoutAction, checkingOut] = useActionState(
    startCheckout,
    idleState,
  );
  const [codeState, codeAction, redeeming] = useActionState(redeemCode, idleState);

  useEffect(() => {
    void isNative().then(setNative);
  }, []);

  return (
    <div className="space-y-5">
      {!native && (
        <form action={checkoutAction} className="space-y-3">
          <input type="hidden" name="plan" value={plan} />

          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(PLANS) as Plan[]).map((key) => {
              const option = PLANS[key];
              const selected = plan === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlan(key)}
                  aria-pressed={selected}
                  className={`rounded border p-4 text-left transition ${
                    selected
                      ? "border-primary bg-page"
                      : "border-border bg-bg hover:border-border-strong"
                  }`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatPrice(option.priceCents)}
                  </p>
                  <p className="text-xs text-muted">
                    {option.interval} · inkl. {Math.round(VAT_RATE * 100)} % MwSt.
                  </p>
                  <p className="mt-1 text-xs text-muted">{option.hint}</p>
                  <p className="mt-1 text-xs text-muted">
                    Netto {formatPrice(netFromGross(option.priceCents))} +{" "}
                    {formatPrice(vatFromGross(option.priceCents))} MwSt.
                  </p>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted">
            Endpreise inklusive gesetzlicher Umsatzsteuer — es kommt nichts mehr
            dazu. Der Preis gilt für die gesamte Firma, unabhängig von der Anzahl
            der Mitarbeiter und Fahrzeuge.
          </p>

          {checkoutState.error && <Notice kind="error">{checkoutState.error}</Notice>}

          <Button type="submit" disabled={checkingOut}>
            {checkingOut ? "Weiterleiten…" : "Kostenpflichtig abonnieren"}
          </Button>
        </form>
      )}

      {native && (
        <Notice kind="info">
          Das Abo verwaltest du im Browser unter deinem Firmenkonto. Sobald es
          aktiv ist, funktioniert die App hier ohne weiteres Zutun.
        </Notice>
      )}

      <form action={codeAction} className="space-y-2 border-t border-border pt-4">
        <label className="block space-y-1">
          <span className="block text-sm font-medium">Testcode einlösen</span>
          <input
            name="code"
            placeholder="TEST-XXXXXXXX"
            autoCapitalize="characters"
            className="uppercase"
          />
          <span className="block text-xs text-muted">
            Hast du einen Code erhalten, verlängert er deinen kostenlosen Zeitraum.
          </span>
        </label>

        {codeState.error && <Notice kind="error">{codeState.error}</Notice>}
        {codeState.success && (
          <Notice kind="success">Code eingelöst — der Zeitraum wurde verlängert.</Notice>
        )}

        <Button type="submit" variant="secondary" disabled={redeeming}>
          {redeeming ? "Wird geprüft…" : "Code einlösen"}
        </Button>
      </form>
    </div>
  );
}
