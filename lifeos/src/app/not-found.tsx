import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Diese Seite gibt es nicht</h1>
      <p className="max-w-sm text-sm text-muted">Vielleicht wurde der Eintrag gelöscht oder der Link ist nicht mehr aktuell.</p>
      <Link href="/dashboard" className="mt-3 inline-flex h-10 items-center rounded-[10px] bg-accent-strong px-4 text-sm font-medium text-white">
        Zum Dashboard
      </Link>
    </main>
  );
}
