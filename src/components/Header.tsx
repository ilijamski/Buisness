import Link from "next/link";
import { signOut } from "@/app/login/actions";
import type { Company, Profile } from "@/lib/types";

export function Header({
  profile,
  company,
}: {
  profile: Profile;
  company: Company | null;
}) {
  const links =
    profile.role === "admin"
      ? [
          { href: "/admin", label: "Übersicht" },
          { href: "/admin/fahrzeuge", label: "Fahrzeuge" },
          { href: "/admin/mitarbeiter", label: "Mitarbeiter" },
          { href: "/admin/einstellungen", label: "Einstellungen" },
        ]
      : [
          { href: "/mitarbeiter", label: "Meine Fahrzeuge" },
          { href: "/profil", label: "Mein Profil" },
        ];

  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold">Fuhrpark-Manager</p>
          <p className="text-xs text-muted">
            {company?.name ?? "Ohne Firma"} ·{" "}
            {profile.role === "admin" ? "Admin" : "Mitarbeiter"}
            {profile.employee_number !== null && ` · Nr. ${profile.employee_number}`}
          </p>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="rounded border border-border-strong px-2.5 py-1 text-xs font-medium hover:bg-page"
          >
            Abmelden
          </button>
        </form>
      </div>

      <nav className="mx-auto max-w-5xl overflow-x-auto px-4">
        <ul className="flex gap-4 text-sm">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="-mb-px inline-block border-b-2 border-transparent py-2 whitespace-nowrap hover:border-border-strong"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
