"use client";

import { CircleAlert, FileUp, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { DonutChart, LineChart } from "@/components/charts";
import { FormModal, Modal } from "@/components/ui/modal";
import { Button, Card, CardHeader, Dot, Field } from "@/components/ui/primitives";
import { useAction, useToast } from "@/components/ui/toast";
import { ASSET_CLASSES, assetClassMeta, slotVar, type AssetClass } from "@/lib/constants";
import { formatMedium, formatShort } from "@/lib/dates";
import { cn, formatMoney, formatNumber } from "@/lib/format";
import { centsToInput, parseCents } from "./money";
import { deleteHolding, importPortfolio, previewPortfolio, saveHolding, type PortfolioPreview } from "./portfolio";
import type { HoldingView } from "./queries";

const quantityFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 });
const parseQuantity = (raw: string) => {
  const s = raw.trim();
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

function HoldingDialog({ open, onClose, holding }: { open: boolean; onClose: () => void; holding?: HoldingView | null }) {
  const { run, pending } = useAction();
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={holding ? "Position bearbeiten" : "Neue Position"}
      pending={pending}
      submitLabel={holding ? "Speichern" : "Anlegen"}
      onDelete={holding ? () => run(() => deleteHolding({ id: holding.id }), { success: "Position gelöscht", onSuccess: onClose }) : undefined}
      onSubmit={(data) => {
        const cost = String(data.get("cost") ?? "").trim();
        run(
          () =>
            saveHolding({
              id: holding?.id,
              name: String(data.get("name")),
              isin: String(data.get("isin")),
              assetClass: data.get("assetClass") as AssetClass,
              quantity: parseQuantity(String(data.get("quantity"))),
              valueCents: parseCents(String(data.get("value"))),
              costCents: cost ? parseCents(cost) : null,
            }),
          { success: holding ? "Position gespeichert" : "Position angelegt", onSuccess: onClose },
        );
      }}
    >
      <Field label="Bezeichnung">
        <input name="name" className="field" required maxLength={200} autoFocus={!holding} defaultValue={holding?.name} placeholder="z. B. MSCI World ETF" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Anlageklasse">
          <select name="assetClass" className="field" defaultValue={holding?.assetClass ?? "etf"}>
            {ASSET_CLASSES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ISIN / Kürzel">
          <input name="isin" className="field uppercase" maxLength={12} defaultValue={holding?.isin} placeholder="Optional" />
        </Field>
        <Field label="Stückzahl">
          <input name="quantity" className="field tabular-nums" inputMode="decimal" defaultValue={holding?.quantity ? String(holding.quantity).replace(".", ",") : ""} placeholder="Optional" />
        </Field>
        <Field label="Aktueller Wert in €">
          <input name="value" className="field tabular-nums" inputMode="decimal" required defaultValue={holding ? centsToInput(holding.valueCents) : ""} placeholder="0,00" />
        </Field>
      </div>
      <Field label="Kaufwert in €" hint="Optional – damit siehst du Gewinn oder Verlust seit dem Kauf.">
        <input name="cost" className="field tabular-nums" inputMode="decimal" defaultValue={holding?.costCents ? centsToInput(holding.costCents) : ""} placeholder="0,00" />
      </Field>
    </FormModal>
  );
}

/** Depotübersicht hochladen: erst Vorschau, dann ersetzen. */
function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PortfolioPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const close = () => {
    setPreview(null);
    setError(null);
    onClose();
  };
  const check = () => {
    setPreview(null);
    setError(null);
    const data = form.current ? new FormData(form.current) : null;
    const file = data?.get("file");
    if (!data || !(file instanceof File) || !file.size) return;
    startTransition(async () => {
      try {
        const result = await previewPortfolio(data);
        if (result.ok) setPreview(result.data);
        else setError(result.error);
      } catch {
        setError("Die Datei konnte nicht hochgeladen werden. Ist sie größer als 2 MB?");
      }
    });
  };
  const submit = () => {
    if (!form.current) return;
    const data = new FormData(form.current);
    startTransition(async () => {
      try {
        const result = await importPortfolio(data);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(`Portfolio mit ${result.data.count} ${result.data.count === 1 ? "Position" : "Positionen"} übernommen`);
        close();
      } catch {
        setError("Das Hochladen ist fehlgeschlagen. Bitte versuche es erneut.");
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Portfolio hochladen"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={pending || !preview} onClick={submit}>
            {pending ? "Einen Moment …" : preview ? `${preview.count} ${preview.count === 1 ? "Position" : "Positionen"} übernehmen` : "Übernehmen"}
          </Button>
        </>
      }
    >
      <form ref={form} className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <p className="text-sm text-pretty text-muted">
          Exportiere bei deinem Broker oder deiner Bank die Depotübersicht (Bestand) als CSV-Datei und wähle sie hier aus. Erkannt werden Bezeichnung, ISIN,
          Stückzahl, Kurs bzw. Kurswert und – falls vorhanden – der Einstandswert.
        </p>
        <Field label="CSV-Datei">
          <input
            name="file"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={check}
            className="block w-full cursor-pointer rounded-[10px] border border-dashed border-line-strong bg-white/[0.03] p-3 text-sm text-ink-2 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/[0.1] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
          />
        </Field>
      </form>

      {pending && !preview ? <p className="mt-4 text-sm text-muted">Datei wird gelesen …</p> : null}
      {error ? (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-[10px] border border-critical/40 bg-critical/10 px-3 py-2.5 text-sm text-danger">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
      {preview ? (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="rounded-xl border border-line bg-white/[0.03] p-3 text-sm">
            <p className="font-medium text-ink">
              {preview.count} {preview.count === 1 ? "Position" : "Positionen"} · {formatMoney(preview.valueCents)}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {preview.costCents !== null ? `Kaufwert ${formatMoney(preview.costCents)} · ` : ""}
              {preview.skipped ? `${preview.skipped} Zeilen ohne Position übersprungen · ` : ""}
              Erkannte Spalten: {preview.columns.join(", ")}
            </p>
          </div>
          {preview.currentCount ? (
            <p className="flex items-start gap-2 rounded-[10px] border border-warn/30 bg-warn/10 px-3 py-2.5 text-[13px] text-ink-2">
              <CircleAlert size={15} className="mt-0.5 shrink-0 text-warn" />
              Dein bisheriges Portfolio ({preview.currentCount} {preview.currentCount === 1 ? "Position" : "Positionen"}, {formatMoney(preview.currentValueCents)}) wird
              durch diesen Stand ersetzt. Der Wertverlauf bleibt erhalten.
            </p>
          ) : null}
          <ul className="divide-y divide-line text-sm">
            {preview.sample.map((row, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{row.name}</span>
                  <span className="block text-xs text-muted">
                    {[row.isin, row.quantity ? `${quantityFormat.format(row.quantity)} Stück` : ""].filter(Boolean).join(" · ") || "–"}
                  </span>
                </span>
                <span className="shrink-0 text-ink-2 tabular-nums">{formatMoney(row.valueCents)}</span>
              </li>
            ))}
          </ul>
          {preview.count > preview.sample.length ? <p className="text-xs text-muted">… und {preview.count - preview.sample.length} weitere.</p> : null}
        </div>
      ) : null}
    </Modal>
  );
}

export function PortfolioCard({
  holdings,
  snapshots,
  cashCents,
  today,
}: {
  holdings: HoldingView[];
  snapshots: { date: string; valueCents: number }[];
  /** Summe aller Kontostände – für das Gesamtvermögen */
  cashCents: number;
  today: string;
}) {
  const [dialog, setDialog] = useState<{ holding: HoldingView | null } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const total = holdings.reduce((a, h) => a + h.valueCents, 0);
  // Gewinn/Verlust nur über Positionen mit bekanntem Kaufwert – sonst wäre die Zahl irreführend.
  const withCost = holdings.filter((h) => h.costCents !== null);
  const cost = withCost.reduce((a, h) => a + (h.costCents ?? 0), 0);
  const gain = withCost.reduce((a, h) => a + h.valueCents, 0) - cost;
  const slices = ASSET_CLASSES.map((c) => ({
    name: c.label,
    color: slotVar(c.color),
    value: holdings.filter((h) => assetClassMeta(h.assetClass).key === c.key).reduce((a, h) => a + h.valueCents, 0),
  })).filter((s) => s.value > 0);
  const lastUpdate = snapshots[snapshots.length - 1]?.date;

  return (
    <>
      <Card>
        <CardHeader
          title="Portfolio"
          hint={
            holdings.length
              ? `Gesamtvermögen mit Konten: ${formatMoney(total + cashCents)}${lastUpdate ? ` · Stand ${lastUpdate === today ? "heute" : formatMedium(lastUpdate)}` : ""}`
              : "Lade die Depotübersicht deines Brokers hoch oder trage Positionen von Hand ein."
          }
          action={
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <FileUp size={14} />
                Portfolio hochladen
              </Button>
              <Button size="sm" onClick={() => setDialog({ holding: null })}>
                <Plus size={14} />
                Position
              </Button>
            </div>
          }
        />
        {holdings.length ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="text-[13px] text-muted">Depotwert</p>
                <p className="mt-1 text-[28px] font-semibold tracking-tight text-ink tabular-nums">{formatMoney(total)}</p>
                {withCost.length ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                    {gain >= 0 ? <TrendingUp size={15} className="text-good" /> : <TrendingDown size={15} className="text-danger" />}
                    <span className="tabular-nums">
                      {gain >= 0 ? "+" : "−"} {formatMoney(Math.abs(gain))}
                      {cost > 0 ? ` (${gain >= 0 ? "+" : "−"}${formatNumber(Math.abs((gain / cost) * 100))} %)` : ""}
                    </span>
                    <span className="text-muted">
                      seit Kauf{withCost.length < holdings.length ? ` · ${withCost.length} von ${holdings.length} Positionen mit Kaufwert` : ""}
                    </span>
                  </p>
                ) : null}
                {snapshots.length >= 2 ? (
                  <div className="mt-5">
                    <p className="mb-2 text-[13px] text-muted">Wertentwicklung</p>
                    <LineChart
                      label="Liniendiagramm: Depotwert im Zeitverlauf"
                      format="money"
                      height={170}
                      series={[{ name: "Depotwert", color: "var(--color-s1)" }]}
                      data={snapshots.map((s) => ({ label: formatShort(s.date), title: formatMedium(s.date), values: [s.valueCents] }))}
                    />
                  </div>
                ) : (
                  <p className="mt-5 text-[13px] text-pretty text-muted">
                    Die Wertentwicklung erscheint, sobald es Stände von mindestens zwei Tagen gibt – lade dazu regelmäßig eine aktuelle Depotübersicht hoch.
                  </p>
                )}
              </div>
              <div>
                <p className="mb-3 text-[13px] text-muted">Aufteilung nach Anlageklasse</p>
                <DonutChart slices={slices} centerLabel="Depot" label="Ringdiagramm: Aufteilung des Portfolios nach Anlageklasse" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-medium">Position</th>
                    <th className="py-2 pr-3 text-right font-medium">Stück</th>
                    <th className="py-2 pr-3 text-right font-medium">Wert</th>
                    <th className="py-2 pr-3 text-right font-medium">Anteil</th>
                    <th className="py-2 text-right font-medium">Seit Kauf</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const meta = assetClassMeta(h.assetClass);
                    const diff = h.costCents !== null ? h.valueCents - h.costCents : null;
                    return (
                      <tr
                        key={h.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`${h.name} bearbeiten`}
                        onClick={() => setDialog({ holding: h })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDialog({ holding: h });
                          }
                        }}
                        className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-white/[0.04]"
                      >
                        <td className="max-w-0 py-2.5 pr-3">
                          <span className="block truncate text-ink">{h.name}</span>
                          <span className="flex items-center gap-1.5 text-xs text-muted">
                            <Dot color={slotVar(meta.color)} className="!size-1.5" />
                            {meta.label}
                            {h.isin ? ` · ${h.isin}` : ""}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right text-ink-2 tabular-nums">{h.quantity ? quantityFormat.format(h.quantity) : "–"}</td>
                        <td className="py-2.5 pr-3 text-right font-medium text-ink tabular-nums">{formatMoney(h.valueCents)}</td>
                        <td className="py-2.5 pr-3 text-right text-muted tabular-nums">{total ? `${formatNumber((h.valueCents / total) * 100)} %` : "–"}</td>
                        <td className={cn("py-2.5 text-right tabular-nums", diff === null ? "text-muted" : "text-ink-2")}>
                          {diff === null ? (
                            "–"
                          ) : (
                            <span className="inline-flex items-center justify-end gap-1">
                              {diff >= 0 ? <TrendingUp size={13} className="text-good" /> : <TrendingDown size={13} className="text-danger" />}
                              {diff >= 0 ? "+" : "−"} {formatMoney(Math.abs(diff))}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">Kurse werden nicht automatisch aktualisiert – die Werte entsprechen dem zuletzt hochgeladenen oder eingetragenen Stand.</p>
          </div>
        ) : null}
      </Card>

      <HoldingDialog key={dialog?.holding?.id ?? "new-holding"} open={dialog !== null} onClose={() => setDialog(null)} holding={dialog?.holding} />
      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
