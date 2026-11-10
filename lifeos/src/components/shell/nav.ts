import {
  CalendarDays,
  ChartColumn,
  CircleCheck,
  FolderKanban,
  LayoutDashboard,
  NotebookPen,
  Repeat,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; group: "main" | "plan" | "system" };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main" },
  { href: "/aufgaben", label: "Aufgaben", icon: CircleCheck, group: "main" },
  { href: "/kalender", label: "Kalender", icon: CalendarDays, group: "main" },
  { href: "/projekte", label: "Projekte", icon: FolderKanban, group: "main" },
  { href: "/ziele", label: "Ziele", icon: Target, group: "plan" },
  { href: "/gewohnheiten", label: "Gewohnheiten", icon: Repeat, group: "plan" },
  { href: "/notizen", label: "Notizen", icon: NotebookPen, group: "plan" },
  { href: "/finanzen", label: "Finanzen", icon: Wallet, group: "plan" },
  { href: "/statistiken", label: "Statistiken", icon: ChartColumn, group: "system" },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings, group: "system" },
];

export const MOBILE_TABS = ["/dashboard", "/aufgaben", "/kalender", "/gewohnheiten"];
export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
