import Link from "next/link";
import type { ReactNode } from "react";
import { Notice } from "@/components/ui";

/**
 * Rahmen für die Rechtstexte. Bewusst ohne Header/Bottom-Nav, damit die
 * Seiten auch vor dem Login (Registrierung) erreichbar sind.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <div>
        <Link href="/einstellungen" className="text-sm text-accent underline">
          ← Zurück
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{title}</h1>
        {updated && <p className="text-xs text-muted">Stand: {updated}</p>}
      </div>

      <Notice kind="info">
        <strong className="text-fg">Vorlage.</strong> Dieser Text beschreibt, wie die
        App technisch mit Daten umgeht. Die mit <code>[…]</code> markierten Angaben
        musst du als Betreiber ergänzen. Vor dem produktiven Einsatz sollte eine
        rechtskundige Person den Text prüfen — dies ist keine Rechtsberatung.
      </Notice>

      <article className="space-y-5 rounded border border-border bg-bg p-5 text-sm leading-relaxed">
        {children}
      </article>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-accent-soft px-1 py-0.5 font-mono text-xs text-accent">
      [{children}]
    </span>
  );
}
