import { signOut } from "@/app/login/actions";
import type { Profile } from "@/lib/types";

export function Header({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-bg">
            F
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-fg">Fuhrpark-Manager</p>
            <p className="text-xs leading-tight text-muted">
              {profile.role === "admin" ? "Admin" : "Mitarbeiter"} · {profile.email}
            </p>
          </div>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent hover:text-fg"
          >
            Abmelden
          </button>
        </form>
      </div>
    </header>
  );
}
