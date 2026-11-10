import { cn } from "@/lib/format";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-ink", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--color-accent-strong)" />
        <circle cx="16" cy="16" r="7" fill="none" stroke="#fff" strokeWidth="2.6" />
        <circle cx="16" cy="16" r="2.2" fill="#fff" />
      </svg>
      LifeOS
    </span>
  );
}
