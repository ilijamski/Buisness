"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Da ist etwas schiefgelaufen</h1>
      <p className="max-w-sm text-sm text-muted">Deine Daten sind sicher. Lade die Seite neu – wenn der Fehler bleibt, versuche es in ein paar Minuten noch einmal.</p>
      <button onClick={reset} className="mt-3 inline-flex h-10 items-center rounded-[10px] bg-accent-strong px-4 text-sm font-medium text-white">
        Erneut versuchen
      </button>
    </main>
  );
}
