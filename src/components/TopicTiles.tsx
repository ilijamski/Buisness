import Link from "next/link";
import type { ReactNode } from "react";

export type Tile = {
  href: string;
  label: string;
  /** Eine Zeile, die sagt, was dahinter los ist — nicht was es ist. */
  status: string;
  icon: ReactNode;
  /** Hebt die Kachel hervor, wenn dort etwas liegen geblieben ist. */
  tone?: "neutral" | "warn" | "danger";
  /** Zahl in der Ecke, z. B. offene Mängel. Bei 0 wird nichts angezeigt. */
  count?: number;
};

const toneStyles = {
  neutral: "border-border",
  warn: "border-accent-bg bg-accent-soft/40",
  danger: "border-danger/30 bg-danger-soft/40",
} as const;

const badgeStyles = {
  neutral: "bg-page text-muted",
  warn: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
} as const;

/**
 * Themenbereiche als Kacheln.
 *
 * Der Grund für diese Seite: eine Übersicht, die alles auf einmal zeigt,
 * zwingt zum Scrollen und beantwortet trotzdem keine Frage. Wer wissen will,
 * was ansteht, tippt auf den Bereich — und sieht dort alles dazu, statt
 * überall ein bisschen. Die Statuszeile auf der Kachel trägt die eine
 * Information, für die man sonst hineingehen müsste.
 */
export function TopicTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {tiles.map((tile) => {
        const tone = tile.tone ?? "neutral";
        return (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className={`flex h-full flex-col gap-2 rounded border p-3 transition hover:border-border-strong hover:bg-page ${toneStyles[tone]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="h-6 w-6 text-muted">{tile.icon}</span>
                {tile.count !== undefined && tile.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${badgeStyles[tone]}`}
                  >
                    {tile.count}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{tile.label}</p>
                <p className="text-xs text-muted">{tile.status}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Symbole der Themenbereiche. Bewusst schlicht — sie sollen unterscheiden, nicht schmücken. */
export const TileIcons = {
  vehicles: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M2.5 7.5h11v8h-11z" />
      <path d="M13.5 10.5h4l3 3v2h-7z" />
      <circle cx="6.5" cy="17.5" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M4.5 6.5h9M4.5 12h9M4.5 17.5h6" />
      <path d="m16 9.5 2 2 4-4" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 16.8v.2" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3.5h6v1" />
      <path d="M8.5 10h7M8.5 14h5" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.5a3.25 3.25 0 0 1 0 6.5" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 20v-6M12.5 20V9M17 20v-8" />
    </svg>
  ),
  leaf: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M5 19c0-7 5-12 14-12 0 9-5 13-11 13H5z" />
      <path d="M8.5 15.5c2-3 4.5-5 8-6.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
    </svg>
  ),
  fuel: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M4.5 20V5.5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2V20" />
      <path d="M3.5 20h11" />
      <path d="M13.5 9h3l2 2v6a1.5 1.5 0 0 1-3 0v-3h-2" />
      <path d="M7 7.5h4" />
    </svg>
  ),
} as const;
