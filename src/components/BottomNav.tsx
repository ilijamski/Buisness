"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Weitere Pfade, die diesen Bereich aktiv markieren. */
  match?: string[];
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Icons = {
  overview: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M2.5 7.5h11v8h-11z" />
      <path d="M13.5 10.5h4l3 3v2h-7z" />
      <circle cx="6.5" cy="17.5" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.5a3.25 3.25 0 0 1 0 6.5" />
      <path d="M17.5 14.8c2 .7 3.5 2.4 3.5 4.7" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      <path d="M8 13h3v3H8z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
    </svg>
  ),
};

function itemsFor(role: Role): NavItem[] {
  if (role === "admin") {
    return [
      { href: "/admin", label: "Übersicht", icon: Icons.overview },
      {
        href: "/admin/fahrzeuge",
        label: "Fahrzeuge",
        icon: Icons.truck,
        match: ["/fahrzeuge"],
      },
      { href: "/admin/fristen", label: "Fristen", icon: Icons.calendar },
      { href: "/admin/mitarbeiter", label: "Team", icon: Icons.team },
      {
        href: "/einstellungen",
        label: "Mehr",
        icon: Icons.settings,
        match: ["/admin/module", "/rechtliches"],
      },
    ];
  }

  return [
    {
      href: "/mitarbeiter",
      label: "Fahrzeuge",
      icon: Icons.truck,
      match: ["/fahrzeuge"],
    },
    { href: "/profil", label: "Profil", icon: Icons.profile },
    {
      href: "/einstellungen",
      label: "Mehr",
      icon: Icons.settings,
      match: ["/rechtliches"],
    },
  ];
}

function isActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  if (item.match?.some((prefix) => pathname.startsWith(prefix))) return true;
  // Unterseiten zählen zum Bereich, "/admin" aber nicht für jede Adminseite.
  return item.href !== "/admin" && pathname.startsWith(`${item.href}/`);
}

/**
 * Feste Leiste am unteren Rand für den Bereichswechsel.
 * Auf großen Bildschirmen übernimmt die Navigation im Header.
 */
export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = itemsFor(role);

  return (
    <nav
      aria-label="Bereiche"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[0.6875rem] ${
                  active ? "font-medium text-fg" : "text-muted"
                }`}
              >
                <span className={`h-6 w-6 ${active ? "" : "opacity-70"}`}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
