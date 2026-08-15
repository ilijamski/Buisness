import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { OfflineStatus } from "@/components/OfflineStatus";
import type { Company, Profile } from "@/lib/types";

function linksFor(role: Profile["role"]) {
  return role === "admin"
    ? [
        { href: "/admin", label: "Übersicht" },
        { href: "/admin/fahrzeuge", label: "Fahrzeuge" },
        { href: "/admin/mitarbeiter", label: "Team" },
        { href: "/admin/module", label: "Module" },
        { href: "/abo", label: "Abo" },
        { href: "/einstellungen", label: "Einstellungen" },
      ]
    : [
        { href: "/mitarbeiter", label: "Meine Fahrzeuge" },
        { href: "/profil", label: "Profil" },
        { href: "/einstellungen", label: "Einstellungen" },
      ];
}

export function Header({
  profile,
  company,
}: {
  profile: Profile;
  company: Company | null;
}) {
  return (
    <>
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {company?.name ?? "Fuhrpark-Manager"}
            </p>
            <p className="truncate text-xs text-muted">
              {profile.role === "admin" ? "Admin" : "Mitarbeiter"}
              {profile.employee_number !== null && ` · Nr. ${profile.employee_number}`}
            </p>
          </div>
        </div>

        {/* Auf kleinen Screens navigiert die untere Leiste. */}
        <nav className="mx-auto hidden max-w-5xl px-4 md:block">
          <ul className="flex gap-4 text-sm">
            {linksFor(profile.role).map((link) => (
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

      <BottomNav role={profile.role} />
      <OfflineStatus />
    </>
  );
}
