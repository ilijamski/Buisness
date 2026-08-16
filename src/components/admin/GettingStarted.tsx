import Link from "next/link";

/**
 * Einstiegshilfe auf der Übersicht.
 *
 * Ein frisch registrierter Admin sieht sonst ein Dashboard voller Nullen und
 * weiß nicht, womit er anfangen soll. Die Liste verschwindet vollständig,
 * sobald alle vier Schritte erledigt sind — sie ist Starthilfe, keine
 * Dauereinblendung.
 */

export type Step = {
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export function GettingStarted({ steps }: { steps: Step[] }) {
  const open = steps.filter((step) => !step.done);
  if (open.length === 0) return null;

  const doneCount = steps.length - open.length;
  const next = open[0];

  return (
    <section className="rounded border border-accent-bg bg-accent-soft">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-accent-bg px-4 py-2.5">
        <h2 className="text-sm font-semibold">Erste Schritte</h2>
        <p className="text-xs text-muted tabular-nums">
          {doneCount} von {steps.length} erledigt
        </p>
      </header>

      <ol className="divide-y divide-accent-bg">
        {steps.map((step) => (
          <li key={step.href} className="flex items-start gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                step.done
                  ? "border-ok bg-ok text-primary-fg"
                  : "border-border-strong bg-bg text-muted"
              }`}
            >
              {step.done ? "✓" : ""}
            </span>

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${step.done ? "text-muted line-through" : ""}`}>
                {step.label}
              </p>
              {!step.done && <p className="text-xs text-muted">{step.description}</p>}
            </div>

            {!step.done && (
              <Link
                href={step.href}
                className={`shrink-0 rounded border px-2.5 py-1 text-xs font-medium ${
                  step === next
                    ? "border-primary bg-primary text-primary-fg hover:bg-primary-hover"
                    : "border-border-strong bg-bg hover:bg-page"
                }`}
              >
                {step === next ? "Loslegen" : "Öffnen"}
              </Link>
            )}
          </li>
        ))}
      </ol>

      <p className="sr-only">
        Diese Liste verschwindet, sobald alle Schritte erledigt sind.
      </p>
    </section>
  );
}
