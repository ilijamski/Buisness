import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { clamp01, cn } from "@/lib/format";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-strong text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.4)] hover:bg-[#7667e6] active:bg-accent-strong",
  secondary: "border border-line-strong bg-white/[0.03] text-ink hover:bg-white/[0.07]",
  ghost: "text-ink-2 hover:bg-white/[0.06] hover:text-ink",
  danger: "border border-critical/40 bg-critical/10 text-danger hover:bg-critical/20",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] font-medium whitespace-nowrap transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-3.5 text-sm",
        buttonVariants[variant],
        className,
      )}
    />
  );
}

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-white/[0.07] hover:text-ink disabled:opacity-40",
        className,
      )}
    />
  );
}

export function Card({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section className={cn("card p-5", className)} style={style}>
      {children}
    </section>
  );
}

export function CardHeader({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-[13px] text-muted">{hint}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink md:text-[28px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-line bg-white/[0.03] text-ink-2">
        {icon}
      </div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-pretty text-muted">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Fortschrittsbalken; die Füllung wächst beim Erscheinen von links ein. */
export function ProgressBar({ value, color = "var(--color-accent)", className, label }: { value: number; color?: string; className?: string; label?: string }) {
  const v = clamp01(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 overflow-hidden rounded-full bg-white/[0.08]", className)}
    >
      <div
        className="h-full origin-left animate-grow-x rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${v * 100}%`, background: color }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  color = "var(--color-accent)",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const v = clamp01(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink tabular-nums">
        {children}
      </div>
    </div>
  );
}

export type BadgeTone = "neutral" | "strong" | "muted" | "critical" | "serious";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-line bg-white/[0.04] text-ink-2",
  strong: "border-line bg-white/[0.04] text-ink",
  muted: "border-line bg-white/[0.04] text-muted",
  critical: "border-critical/40 bg-critical/10 text-danger",
  serious: "border-serious/30 bg-serious/10 text-serious",
};

/** Kleines Etikett; die Farbgebung läuft ausschließlich über `tone`. */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-md border px-1.5 text-xs font-medium whitespace-nowrap",
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

/** Kennzahl-Kachel: Bezeichnung, große Zahl, optionale Zusatzzeile. */
export function StatTile({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col p-4 md:p-5">
      <div className="flex items-center justify-between gap-2 text-[13px] text-muted">
        <span className="truncate">{label}</span>
        {icon ? <span className="text-muted">{icon}</span> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink md:text-[28px]">{value}</div>
      {detail ? <div className="mt-1 text-[13px] text-muted">{detail}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] border border-line bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
            o.value === value ? "bg-white/[0.1] text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
