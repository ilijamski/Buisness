"use client";

import { CornerDownLeft, Ellipsis, LogOut, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { logout } from "@/features/auth/actions";
import { saveTask } from "@/features/tasks/actions";
import { cn } from "@/lib/format";
import { Modal } from "../ui/modal";
import { useAction } from "../ui/toast";
import { Logo } from "./logo";
import { isActive, MOBILE_TABS, NAV, type NavItem } from "./nav";

type ShellUser = { name: string; email: string };
const GROUP_LABEL: Record<NavItem["group"], string | null> = { main: null, plan: "Leben", system: "Auswertung" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Meldet die Zeitzone des Browsers per Cookie, damit der Server "heute" richtig berechnet. */
function TimezoneSync() {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    const value = encodeURIComponent(tz);
    if (document.cookie.split("; ").includes(`lifeos_tz=${value}`)) return;
    document.cookie = `lifeos_tz=${value}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}

function Sidebar({ user, onSearch }: { user: ShellUser; onSearch: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/60 md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" aria-label="LifeOS – zum Dashboard">
          <Logo />
        </Link>
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={onSearch}
          className="flex h-9 w-full items-center gap-2 rounded-[10px] border border-line bg-white/[0.03] px-2.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink-2"
        >
          <Search size={15} />
          Suchen oder anlegen
          <kbd className="ml-auto rounded border border-line px-1 font-mono text-[10px] text-muted">⌘K</kbd>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Hauptnavigation">
        {(["main", "plan", "system"] as const).map((group) => (
          <div key={group} className="mb-4">
            {GROUP_LABEL[group] ? (
              <p className="mb-1 px-2.5 text-[11px] font-medium tracking-wider text-muted uppercase">{GROUP_LABEL[group]}</p>
            ) : null}
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === group).map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-sm transition-colors",
                        active ? "bg-white/[0.07] font-medium text-ink" : "text-ink-2 hover:bg-white/[0.04] hover:text-ink",
                      )}
                    >
                      <Icon size={17} className={cn("transition-colors", active ? "text-accent" : "text-muted group-hover:text-ink-2")} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2.5 border-t border-line p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
          <span className="block truncate text-xs text-muted">{user.email}</span>
        </span>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Abmelden"
            title="Abmelden"
            className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}

function MobileNav({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const tabs = NAV.filter((n) => MOBILE_TABS.includes(n.href));
  const rest = NAV.filter((n) => !MOBILE_TABS.includes(n.href));
  const restActive = rest.some((n) => isActive(pathname, n.href));
  const tabClass = (active: boolean) =>
    cn("flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors", active ? "text-ink" : "text-muted");

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-xl md:hidden">
        <Link href="/dashboard" aria-label="LifeOS – zum Dashboard">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={onSearch}
          aria-label="Suchen oder anlegen"
          className="flex size-10 items-center justify-center rounded-[10px] text-ink-2 hover:bg-white/[0.07]"
        >
          <Search size={19} />
        </button>
      </header>

      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <Icon size={21} className={active ? "text-accent" : undefined} />
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} className={tabClass(restActive)}>
          <Ellipsis size={21} className={restActive ? "text-accent" : undefined} />
          Mehr
        </button>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="Alle Bereiche">
        <ul className="grid grid-cols-3 gap-2">
          {rest.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMore(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border px-2 py-4 text-xs font-medium transition-colors",
                    active ? "border-accent/40 bg-accent-soft text-ink" : "border-line bg-white/[0.03] text-ink-2",
                  )}
                >
                  <Icon size={20} className={active ? "text-accent" : "text-muted"} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <form action={logout} className="mt-4">
          <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm text-ink-2">
            <LogOut size={16} />
            Abmelden
          </button>
        </form>
      </Modal>
    </>
  );
}

/** Befehlspalette (⌘K): zu Bereichen springen oder direkt eine Aufgabe anlegen. */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const { run, pending } = useAction();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const close = () => {
    setQuery("");
    setIndex(0);
    onClose();
  };

  const q = query.trim();
  const items = useMemo(() => {
    const pages = NAV.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())).map((n) => ({
      key: n.href,
      label: n.label,
      hint: "Öffnen",
      icon: n.icon,
      run: () => router.push(n.href),
    }));
    if (!q) return pages;
    return [
      ...pages,
      {
        key: "new-task",
        label: `Aufgabe anlegen: „${q}“`,
        hint: "Neu",
        icon: Plus,
        run: () => run(() => saveTask({ title: q, notes: "" }), { success: "Aufgabe angelegt" }),
      },
    ];
  }, [q, router, run]);
  const selected = Math.min(index, items.length - 1);

  const choose = (i: number) => {
    const item = items[i];
    if (!item || pending) return;
    item.run();
    close();
  };

  return (
    <dialog
      ref={ref}
      aria-label="Befehlspalette"
      className="modal m-0 mx-auto mt-[12dvh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-raised p-0 text-ink shadow-2xl shadow-black/70"
      onClose={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      {open ? (
        <div>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search size={17} className="shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((selected + 1) % items.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((selected - 1 + items.length) % items.length);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(selected);
                }
              }}
              maxLength={200}
              placeholder="Bereich suchen oder neue Aufgabe eintippen …"
              aria-label="Suchen oder Aufgabe anlegen"
              className="h-13 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
          <ul className="max-h-[50dvh] overflow-y-auto p-2" role="listbox">
            {items.map((item, i) => (
              <li key={item.key} role="option" aria-selected={i === selected}>
                <button
                  type="button"
                  onClick={() => choose(i)}
                  onPointerMove={() => setIndex(i)}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm transition-colors",
                    i === selected ? "bg-white/[0.08] text-ink" : "text-ink-2",
                  )}
                >
                  <item.icon size={16} className={i === selected ? "text-accent" : "text-muted"} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {i === selected ? <CornerDownLeft size={14} className="text-muted" /> : <span className="text-xs text-muted">{item.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </dialog>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <TimezoneSync />
      <Sidebar user={user} onSearch={() => setPaletteOpen(true)} />
      <MobileNav onSearch={() => setPaletteOpen(true)} />
      <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-12 md:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-8 md:pt-10">{children}</div>
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
