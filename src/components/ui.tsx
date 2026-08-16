import type { ReactNode } from "react";

export function Card({
  title,
  action,
  children,
  className = "",
  id,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sprungziel für Verweise wie /fahrzeuge/123#erfassen. */
  id?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-4 rounded border border-border bg-bg ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {/* data-compact-target: greift die Dichte-Einstellung aus den Präferenzen ab. */}
      <div className="p-4" data-compact-target>
        {children}
      </div>
    </section>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary: "bg-primary text-primary-fg hover:bg-primary-hover border-primary",
    secondary: "bg-bg text-fg hover:bg-page border-border-strong",
    danger: "bg-bg text-danger hover:bg-danger-soft border-border-strong",
  }[variant];

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Notice({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "border-danger/30 bg-danger-soft text-danger",
    success: "border-ok/30 bg-ok-soft text-ok",
    info: "border-border bg-page text-muted",
  }[kind];

  return (
    <p className={`rounded border px-3 py-2 text-sm ${styles}`}>{children}</p>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "danger" | "ok";
}) {
  const styles = {
    neutral: "border-border bg-page text-muted",
    warn: "border-accent-bg bg-accent-soft text-accent",
    danger: "border-danger/30 bg-danger-soft text-danger",
    ok: "border-ok/30 bg-ok-soft text-ok",
  }[tone];

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${styles}`}
    >
      {children}
    </span>
  );
}

/** Schlichte Beschreibungsliste für Stammdaten. */
export function DataList({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Keine Angaben hinterlegt.</p>;
  }
  return (
    <dl className="divide-y divide-border text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
          <dt className="text-muted">{item.label}</dt>
          <dd className="text-right font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-muted">{children}</p>;
}
