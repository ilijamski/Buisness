"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn, formatMoney, formatMoneyRound, formatNumber } from "@/lib/format";

/* ---------- Gemeinsames ---------- */

export type ValueFormat = "number" | "money" | "percent";
const formatters: Record<ValueFormat, { full: (n: number) => string; tick: (n: number) => string }> = {
  number: { full: formatNumber, tick: formatNumber },
  money: { full: formatMoney, tick: formatMoneyRound },
  percent: { full: (n) => `${Math.round(n)} %`, tick: (n) => `${Math.round(n)} %` },
};

export type Series = { name: string; color: string };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Runde Achsenschritte (1 / 2 / 2,5 / 5 × 10ⁿ) für etwa vier Gitterlinien. */
function niceScale(max: number, format: ValueFormat) {
  if (format === "percent") return { top: 100, ticks: [0, 25, 50, 75, 100] };
  const unit = format === "money" ? 100 : 1;
  const m = Math.max(max / unit, 1);
  const rough = m / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max([1, 2, 2.5, 5, 10].find((s) => s * pow >= rough)! * pow, format === "number" ? 1 : 0.01);
  const count = Math.ceil(m / step);
  return { top: count * step * unit, ticks: Array.from({ length: count + 1 }, (_, i) => i * step * unit) };
}

function Tooltip({ x, width, title, rows }: { x: number; width: number; title: string; rows: { name?: string; color?: string; value: string }[] }) {
  const flip = x > width / 2;
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 min-w-28 rounded-lg border border-line-strong bg-raised px-2.5 py-2 text-xs shadow-xl shadow-black/50"
      style={flip ? { right: width - x + 12 } : { left: x + 12 }}
    >
      <div className="mb-1 font-medium whitespace-nowrap text-ink">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4 whitespace-nowrap text-ink-2">
          <span className="flex items-center gap-1.5">
            {r.color ? <span className="size-2 rounded-full" style={{ background: r.color }} /> : null}
            {r.name}
          </span>
          <span className="font-medium text-ink tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ series, className }: { series: Series[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2", className)}>
      {series.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

function ChartFrame({ height, label, children }: { height: number; label: string; children: (width: number) => ReactNode }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  return (
    <div ref={ref} className="relative w-full" style={{ height }} role="img" aria-label={label}>
      {width > 0 ? children(width) : null}
    </div>
  );
}

const PAD = { top: 8, right: 4, bottom: 22 };

function Grid({ ticks, top, width, left, plotH, format }: { ticks: number[]; top: number; width: number; left: number; plotH: number; format: ValueFormat }) {
  return (
    <g>
      {ticks.map((t) => {
        const y = PAD.top + plotH - (t / top) * plotH;
        return (
          <g key={t}>
            <line x1={left} x2={width - PAD.right} y1={y} y2={y} stroke={t === 0 ? "rgb(255 255 255 / 0.16)" : "rgb(255 255 255 / 0.06)"} />
            <text x={left - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-muted text-[11px] tabular-nums">
              {formatters[format].tick(t)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Schätzt die Breite der Achsenbeschriftung, damit nichts abgeschnitten wird. */
const axisWidth = (ticks: number[], format: ValueFormat) =>
  Math.max(...ticks.map((t) => formatters[format].tick(t).length)) * 6.4 + 12;

/** Nur so viele X-Beschriftungen zeigen, wie nebeneinander passen. */
const labelEvery = (count: number, plotW: number, minGap = 44) => Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotW / minGap))));

/* ---------- Säulendiagramm ---------- */

export type BarDatum = { label: string; title?: string; values: number[] };

export function BarChart({
  data,
  series,
  format = "number",
  height = 220,
  label,
  highlight,
}: {
  data: BarDatum[];
  series: Series[];
  format?: ValueFormat;
  height?: number;
  label: string;
  /** Index einer hervorgehobenen Säulengruppe (z. B. heute) */
  highlight?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { top, ticks } = niceScale(Math.max(0, ...data.flatMap((d) => d.values)), format);
  const left = axisWidth(ticks, format);

  return (
    <ChartFrame height={height} label={label}>
      {(width) => {
        const plotW = width - left - PAD.right;
        const plotH = height - PAD.top - PAD.bottom;
        const band = plotW / data.length;
        const n = series.length;
        const gap = 2;
        const barW = Math.max(3, Math.min(24, (band * 0.7 - gap * (n - 1)) / n));
        const groupW = barW * n + gap * (n - 1);
        const every = labelEvery(data.length, plotW);
        const hovered = hover !== null ? data[hover] : null;
        return (
          <>
            <svg width={width} height={height} className="overflow-visible">
              <Grid ticks={ticks} top={top} width={width} left={left} plotH={plotH} format={format} />
              {data.map((d, i) => {
                const x0 = left + band * i + (band - groupW) / 2;
                return (
                  <g key={i}>
                    {hover === i ? <rect x={left + band * i} y={PAD.top} width={band} height={plotH} fill="rgb(255 255 255 / 0.04)" rx={6} /> : null}
                    {d.values.map((v, s) => {
                      const h = top ? (v / top) * plotH : 0;
                      if (h <= 0) return null;
                      const x = x0 + s * (barW + gap);
                      const y = PAD.top + plotH - h;
                      const r = Math.min(4, barW / 2, h);
                      return (
                        <path
                          key={s}
                          d={`M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},${-r}h${barW - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y + h}Z`}
                          fill={series[s].color}
                          opacity={hover === null || hover === i ? 1 : 0.45}
                          className="animate-grow-y transition-opacity duration-150"
                          style={{ transformBox: "fill-box", transformOrigin: "bottom", animationDelay: `${i * 25}ms` }}
                        />
                      );
                    })}
                    {i % every === 0 || i === highlight ? (
                      <text
                        x={left + band * i + band / 2}
                        y={height - 5}
                        textAnchor="middle"
                        className={cn("text-[11px]", i === highlight ? "fill-ink font-medium" : "fill-muted")}
                      >
                        {d.label}
                      </text>
                    ) : null}
                    <rect
                      x={left + band * i}
                      y={0}
                      width={band}
                      height={height}
                      fill="transparent"
                      onPointerEnter={() => setHover(i)}
                      onPointerMove={() => setHover(i)}
                      onPointerLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}
            </svg>
            {hovered && hover !== null ? (
              <Tooltip
                x={left + band * hover + band / 2}
                width={width}
                title={hovered.title ?? hovered.label}
                rows={hovered.values.map((v, s) => ({
                  name: n > 1 ? series[s].name : undefined,
                  color: n > 1 ? series[s].color : undefined,
                  value: formatters[format].full(v),
                }))}
              />
            ) : null}
          </>
        );
      }}
    </ChartFrame>
  );
}

/* ---------- Liniendiagramm ---------- */

export function LineChart({
  data,
  series,
  format = "number",
  height = 220,
  label,
}: {
  data: BarDatum[];
  series: Series[];
  format?: ValueFormat;
  height?: number;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { top, ticks } = niceScale(Math.max(0, ...data.flatMap((d) => d.values)), format);
  const left = axisWidth(ticks, format);

  return (
    <ChartFrame height={height} label={label}>
      {(width) => {
        const plotW = width - left - PAD.right - 6;
        const plotH = height - PAD.top - PAD.bottom;
        const step = data.length > 1 ? plotW / (data.length - 1) : 0;
        const px = (i: number) => left + (data.length > 1 ? i * step : plotW / 2);
        const py = (v: number) => PAD.top + plotH - (top ? (v / top) * plotH : 0);
        const every = labelEvery(data.length, plotW, 52);
        const last = data.length - 1;
        const hovered = hover !== null ? data[hover] : null;
        return (
          <>
            <svg
              width={width}
              height={height}
              className="overflow-visible"
              onPointerMove={(e) => {
                const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
                setHover(Math.max(0, Math.min(last, Math.round((x - left) / (step || 1)))));
              }}
              onPointerLeave={() => setHover(null)}
            >
              <Grid ticks={ticks} top={top} width={width} left={left} plotH={plotH} format={format} />
              {hover !== null ? <line x1={px(hover)} x2={px(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="rgb(255 255 255 / 0.22)" /> : null}
              {series.map((s, si) => {
                const line = data.map((d, i) => `${i ? "L" : "M"}${px(i)},${py(d.values[si])}`).join("");
                return (
                  <g key={s.name} className="animate-fade">
                    {series.length === 1 ? (
                      <path d={`${line}L${px(last)},${PAD.top + plotH}L${px(0)},${PAD.top + plotH}Z`} fill={s.color} opacity={0.1} />
                    ) : null}
                    <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    <circle
                      cx={px(hover ?? last)}
                      cy={py(data[hover ?? last].values[si])}
                      r={4.5}
                      fill={s.color}
                      stroke="var(--color-surface)"
                      strokeWidth={2}
                    />
                  </g>
                );
              })}
              {data.map((d, i) =>
                (last - i) % every === 0 ? (
                  <text key={i} x={px(i)} y={height - 5} textAnchor={i === last ? "end" : "middle"} className="fill-muted text-[11px]">
                    {d.label}
                  </text>
                ) : null,
              )}
            </svg>
            {hovered && hover !== null ? (
              <Tooltip
                x={px(hover)}
                width={width}
                title={hovered.title ?? hovered.label}
                rows={hovered.values.map((v, s) => ({
                  name: series.length > 1 ? series[s].name : undefined,
                  color: series.length > 1 ? series[s].color : undefined,
                  value: formatters[format].full(v),
                }))}
              />
            ) : null}
          </>
        );
      }}
    </ChartFrame>
  );
}

/* ---------- Ringdiagramm mit Legende ---------- */

export type Slice = { name: string; color: string; value: number };

export function DonutChart({ slices, format = "money", centerLabel, label }: { slices: Slice[]; format?: ValueFormat; centerLabel: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const size = 168;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2.5 : 0;
  const active = hover !== null ? slices[hover] : null;
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((a, s) => a + s.value, 0));

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth={stroke} />
          {slices.map((s, i) => {
            const len = (s.value / total) * c;
            const dash = Math.max(len - gap, 0.5);
            return (
              <circle
                key={s.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === i ? stroke + 4 : stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-((starts[i] / total) * c + gap / 2)}
                opacity={hover === null || hover === i ? 1 : 0.4}
                className="transition-[opacity,stroke-width] duration-150"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="max-w-full truncate text-xs text-muted">{active ? active.name : centerLabel}</span>
          <span className="text-lg font-semibold tracking-tight text-ink">
            {formatters[format].tick(active ? active.value : total)}
          </span>
          {active ? <span className="text-xs text-muted">{Math.round((active.value / total) * 100)} %</span> : null}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-0.5">
        {slices.map((s, i) => (
          <li
            key={s.name}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors",
              hover === i && "bg-white/[0.05]",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-ink-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
              <span className="text-xs text-muted">{Math.round((s.value / total) * 100)} %</span>
              <span className="font-medium text-ink">{formatters[format].full(s.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Heatmap (Wochen × Wochentage) ---------- */

export type HeatCell = { date: string; title: string; value: number; future?: boolean };
/** Einfarbige Abstufung hell → kräftig; Stufe 0 ist die leere Zelle. */
const HEAT = ["rgb(255 255 255 / 0.05)", "#184f95", "#256abf", "#3987e5", "#86b6ef"];

export function Heatmap({ cells, max, unit, label }: { cells: HeatCell[]; max: number; unit: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const weeks = Math.ceil(cells.length / 7);
  const days = ["Mo", "", "Mi", "", "Fr", "", "So"];
  const level = (v: number) => (v <= 0 || max <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((v / max) * 4))));
  const active = hover !== null ? cells[hover] : null;

  return (
    <div role="img" aria-label={label}>
      <div className="flex gap-2">
        <div className="grid shrink-0 grid-rows-7 gap-[3px] text-[10px] leading-none text-muted">
          {days.map((d, i) => (
            <span key={i} className="flex items-center">
              {d}
            </span>
          ))}
        </div>
        <div
          className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
          onPointerLeave={() => setHover(null)}
        >
          {cells.map((cell, i) => (
            <div
              key={cell.date}
              onPointerEnter={() => setHover(i)}
              className={cn(
                "aspect-square max-h-5 min-h-2.5 w-full rounded-[3px] transition-[outline-color] outline-1 outline-transparent",
                hover === i && "outline-white/60",
                cell.future && "opacity-30",
              )}
              style={{ background: HEAT[cell.future ? 0 : level(cell.value)] }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex min-h-5 items-center justify-between gap-3 text-xs text-muted">
        <span className="truncate text-ink-2">
          {active ? `${active.title}: ${active.future ? "–" : `${active.value} ${unit}`}` : "Fahre über ein Feld, um den Tag zu sehen."}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          weniger
          {HEAT.map((color) => (
            <span key={color} className="size-2.5 rounded-[3px]" style={{ background: color }} />
          ))}
          mehr
        </span>
      </div>
    </div>
  );
}
