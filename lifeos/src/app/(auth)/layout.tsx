import { ChartColumn, CircleCheck, Target } from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/shell/logo";
import { getUser } from "@/lib/auth/session";

const points = [
  { icon: CircleCheck, title: "Alles an einem Ort", text: "Aufgaben, Termine, Notizen, Finanzen und Projekte – ohne zwischen Apps zu wechseln." },
  { icon: Target, title: "Ziele, die vorankommen", text: "Fortschritt und Gewohnheiten sichtbar machen, Tag für Tag." },
  { icon: ChartColumn, title: "Jede Woche ein Bericht", text: "Sieh auf einen Blick, was gut lief und wo du nachsteuern kannst." },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getUser()) redirect("/dashboard");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="animate-rise">{children}</div>
        </div>
        <p className="text-xs text-muted">Deine Daten gehören dir – Export und Löschung jederzeit in den Einstellungen.</p>
      </main>
      <aside className="relative hidden overflow-hidden border-l border-line bg-surface lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(106 91 220 / 0.55), transparent 65%)" }}
        />
        <div className="relative max-w-md">
          <p className="text-[32px] leading-[1.15] font-semibold tracking-tight text-balance text-ink">
            Dein Leben, übersichtlich wie ein gutes Dashboard.
          </p>
          <ul className="stagger mt-10 space-y-6">
            {points.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-white/[0.04] text-accent">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-[15px] font-medium text-ink">{title}</span>
                  <span className="mt-0.5 block text-sm text-pretty text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
