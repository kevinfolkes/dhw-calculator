"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { SelectInput } from "@/components/ui/Field";
import { listReports, type SavedReport } from "@/lib/reports/storage";
import { ENGINE_VERSION } from "@/lib/version";
import { fmt, fmtUSD } from "@/lib/utils";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";

interface Props {
  inputs: DhwInputs;
  result: CalcResult;
}

const NUM_SLOTS = 4;
const CURRENT_KEY = "__current__";
const NONE_KEY = "__none__";

type SlotPick = string; // CURRENT_KEY | NONE_KEY | SavedReport.id

interface ColumnData {
  key: string;
  label: string;
  inputs: DhwInputs;
  results: CalcResult;
  engineVersion: string;
  savedAt: string | null;
}

/**
 * Compare tab — side-by-side diff of up to 4 saved scenarios (plus the
 * current working scenario). Numeric rows highlight best/worst values; with
 * exactly two columns selected we surface a Δ column.
 */
export function CompareTab({ inputs, result }: Props) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [slots, setSlots] = useState<SlotPick[]>(() => [
    CURRENT_KEY,
    NONE_KEY,
    NONE_KEY,
    NONE_KEY,
  ]);

  useEffect(() => {
    setReports(listReports());
  }, []);

  const setSlot = (idx: number, value: SlotPick) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const slotOptions = useMemo(() => {
    const opts: Array<{ value: SlotPick; label: string }> = [
      { value: NONE_KEY, label: "— empty —" },
      { value: CURRENT_KEY, label: "Current scenario" },
    ];
    for (const r of reports) {
      opts.push({ value: r.id, label: r.name });
    }
    return opts;
  }, [reports]);

  const columns = useMemo<ColumnData[]>(() => {
    const cols: ColumnData[] = [];
    for (const slot of slots) {
      if (slot === NONE_KEY) continue;
      if (slot === CURRENT_KEY) {
        cols.push({
          key: CURRENT_KEY,
          label: "Current scenario",
          inputs,
          results: result,
          engineVersion: ENGINE_VERSION,
          savedAt: null,
        });
        continue;
      }
      const r = reports.find((x) => x.id === slot);
      if (!r) continue;
      cols.push({
        key: r.id,
        label: r.name,
        inputs: r.inputs,
        results: r.results,
        engineVersion: r.engineVersion,
        savedAt: r.updatedAt,
      });
    }
    return cols;
  }, [slots, reports, inputs, result]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Intro */}
      <Card accent="var(--accent-violet)">
        <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "var(--text-primary)" }}>
          <strong>Compare</strong> picks up to 4 scenarios and renders sizing, annual energy,
          lifecycle, and compliance side-by-side. With exactly 2 columns you also get a Δ column;
          with 3+ the best (green) and worst (red) numeric values are highlighted per row.
        </p>
      </Card>

      {/* Slot pickers */}
      <Card>
        <CardHeader>
          <CardTitle>Pick scenarios</CardTitle>
        </CardHeader>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${NUM_SLOTS}, 1fr)`,
            gap: 12,
          }}
        >
          {slots.map((slot, i) => (
            <div key={i}>
              <label className="ve-field-label">Slot {i + 1}</label>
              <SelectInput<SlotPick>
                value={slot}
                onChange={(v) => setSlot(i, v)}
                options={slotOptions}
              />
            </div>
          ))}
        </div>
      </Card>

      {columns.length < 2 ? (
        <Card>
          <div
            style={{
              padding: "20px 12px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            Pick at least 2 reports above to start comparing.
          </div>
        </Card>
      ) : (
        <ComparisonTable columns={columns} />
      )}
    </div>
  );
}

// ─── Comparison table ──────────────────────────────────────────────────────

type RowDirection = "lower" | "higher" | "neutral";

interface MetricRow {
  label: string;
  unit?: string;
  digits?: number;
  /** lower-better (cost / energy / CO₂), higher-better (COP), or neutral. */
  direction: RowDirection;
  values: Array<number | null>;
  /** When true, render numeric values as USD. */
  currency?: boolean;
}

interface SectionDef {
  title: string;
  rows: MetricRow[];
}

function ComparisonTable({ columns }: { columns: ColumnData[] }) {
  const showDelta = columns.length === 2;

  const sections = useMemo<SectionDef[]>(
    () => buildSections(columns),
    [columns],
  );

  // Grid: 1 fixed metric col + N data cols (+ 1 Δ col when exactly 2 columns).
  const dataCols = columns.length + (showDelta ? 1 : 0);
  const gridTemplate = `minmax(220px, 1.4fr) repeat(${dataCols}, minmax(140px, 1fr))`;

  return (
    <Card>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 480 + dataCols * 160 }}>
          {/* Header rows: name, system, saved date, engine version */}
          <HeaderBlock columns={columns} showDelta={showDelta} gridTemplate={gridTemplate} />

          {sections.map((section) => (
            <SectionBlock
              key={section.title}
              section={section}
              columnCount={columns.length}
              showDelta={showDelta}
              gridTemplate={gridTemplate}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function HeaderBlock({
  columns,
  showDelta,
  gridTemplate,
}: {
  columns: ColumnData[];
  showDelta: boolean;
  gridTemplate: string;
}) {
  const cellStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
  };
  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 700,
    color: "var(--text-primary)",
  };
  const labelStyle: React.CSSProperties = {
    ...cellStyle,
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    background: "transparent",
    position: "sticky",
    left: 0,
    zIndex: 1,
  };
  const stickyHeaderStyle: React.CSSProperties = {
    ...headerCellStyle,
    background: "#fff",
    position: "sticky",
    left: 0,
    zIndex: 1,
    borderRight: "1px solid var(--border-light)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          background: "var(--accent-blue-bg)",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <div style={stickyHeaderStyle}>Report</div>
        {columns.map((c) => (
          <div key={c.key} style={headerCellStyle}>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{c.label}</div>
          </div>
        ))}
        {showDelta && <div style={{ ...headerCellStyle, color: "var(--accent-violet)" }}>Δ</div>}
      </div>

      <Row gridTemplate={gridTemplate}>
        <div style={labelStyle}>System type</div>
        {columns.map((c) => (
          <div key={c.key} style={cellStyle}>
            {SYSTEM_TYPES[c.inputs.systemType]?.label ?? c.inputs.systemType}
          </div>
        ))}
        {showDelta && <div style={cellStyle} />}
      </Row>
      <Row gridTemplate={gridTemplate}>
        <div style={labelStyle}>Saved</div>
        {columns.map((c) => (
          <div key={c.key} style={{ ...cellStyle, color: "var(--text-secondary)" }}>
            {c.savedAt ? new Date(c.savedAt).toLocaleDateString() : "live"}
          </div>
        ))}
        {showDelta && <div style={cellStyle} />}
      </Row>
      <Row gridTemplate={gridTemplate}>
        <div style={labelStyle}>Engine version</div>
        {columns.map((c) => {
          const stale = c.engineVersion !== ENGINE_VERSION;
          return (
            <div key={c.key} style={cellStyle}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: stale ? "var(--accent-amber-bg)" : "var(--accent-blue-bg)",
                  color: stale ? "var(--accent-amber)" : "var(--accent-blue)",
                }}
              >
                v{c.engineVersion}
                {stale ? " (stale)" : ""}
              </span>
            </div>
          );
        })}
        {showDelta && <div style={cellStyle} />}
      </Row>
    </div>
  );
}

function SectionBlock({
  section,
  columnCount,
  showDelta,
  gridTemplate,
}: {
  section: SectionDef;
  columnCount: number;
  showDelta: boolean;
  gridTemplate: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          background: "var(--accent-violet-bg)",
          borderTop: "1px solid var(--border-light)",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent-violet)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            position: "sticky",
            left: 0,
            background: "var(--accent-violet-bg)",
            zIndex: 1,
          }}
        >
          {section.title}
        </div>
        {Array.from({ length: columnCount + (showDelta ? 1 : 0) }).map((_, i) => (
          <div key={i} />
        ))}
      </div>
      {section.rows.map((row) => (
        <MetricRowView
          key={row.label}
          row={row}
          columnCount={columnCount}
          showDelta={showDelta}
          gridTemplate={gridTemplate}
        />
      ))}
    </div>
  );
}

function MetricRowView({
  row,
  columnCount,
  showDelta,
  gridTemplate,
}: {
  row: MetricRow;
  columnCount: number;
  showDelta: boolean;
  gridTemplate: string;
}) {
  const numeric = row.values.filter((v): v is number => v != null && Number.isFinite(v));
  let bestVal: number | null = null;
  let worstVal: number | null = null;
  if (numeric.length >= 2 && row.direction !== "neutral") {
    const lo = Math.min(...numeric);
    const hi = Math.max(...numeric);
    if (lo !== hi) {
      bestVal = row.direction === "lower" ? lo : hi;
      worstVal = row.direction === "lower" ? hi : lo;
    }
  }

  // Highlight only when 3+ columns; with 2 the Δ column carries the diff.
  const highlight = columnCount >= 3;

  const renderValue = (v: number | null) => {
    if (v == null || !Number.isFinite(v)) return "—";
    if (row.currency) return fmtUSD(v, row.digits ?? 0);
    const formatted = fmt(v, row.digits ?? 0);
    return row.unit ? (
      <>
        {formatted}
        <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 4 }}>
          {row.unit}
        </span>
      </>
    ) : (
      formatted
    );
  };

  const cellBase: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: 12,
    color: "var(--text-primary)",
    fontVariantNumeric: "tabular-nums",
    borderBottom: "1px solid var(--border-light)",
  };

  const labelStyle: React.CSSProperties = {
    ...cellBase,
    fontWeight: 600,
    color: "var(--text-secondary)",
    background: "#fff",
    position: "sticky",
    left: 0,
    zIndex: 1,
    borderRight: "1px solid var(--border-light)",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
      <div style={labelStyle}>{row.label}</div>
      {row.values.map((v, i) => {
        const isBest = highlight && bestVal != null && v === bestVal;
        const isWorst = highlight && worstVal != null && v === worstVal;
        const tinted: React.CSSProperties = isBest
          ? { background: "var(--accent-emerald-bg)", color: "var(--accent-emerald)" }
          : isWorst
          ? { background: "var(--accent-red-bg)", color: "var(--accent-red)" }
          : {};
        return (
          <div key={i} style={{ ...cellBase, fontWeight: 600, ...tinted }}>
            {renderValue(v)}
          </div>
        );
      })}
      {showDelta && <DeltaCell row={row} />}
    </div>
  );
}

function DeltaCell({ row }: { row: MetricRow }) {
  const [a, b] = row.values;
  const cellBase: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    borderBottom: "1px solid var(--border-light)",
  };
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return <div style={cellBase}>—</div>;
  }
  const diff = b - a;
  if (diff === 0) {
    return <div style={{ ...cellBase, color: "var(--text-muted)" }}>0</div>;
  }
  // For a "lower-better" row, b<a (negative diff) is good for slot 2.
  let color = "var(--text-secondary)";
  if (row.direction === "lower") color = diff < 0 ? "var(--accent-emerald)" : "var(--accent-red)";
  if (row.direction === "higher") color = diff > 0 ? "var(--accent-emerald)" : "var(--accent-red)";
  const sign = diff > 0 ? "+" : "";
  const formatted = row.currency ? fmtUSD(diff, row.digits ?? 0) : fmt(diff, row.digits ?? 0);
  return (
    <div style={{ ...cellBase, color }}>
      {sign}
      {formatted}
      {row.unit && !row.currency && (
        <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 4 }}>
          {row.unit}
        </span>
      )}
    </div>
  );
}

function Row({
  children,
  gridTemplate,
}: {
  children: React.ReactNode;
  gridTemplate: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: gridTemplate,
        borderBottom: "1px solid var(--border-light)",
      }}
    >
      {children}
    </div>
  );
}

// ─── Section/row builders ──────────────────────────────────────────────────

function buildSections(columns: ColumnData[]): SectionDef[] {
  const get = <T extends number>(fn: (c: ColumnData) => T | null | undefined) =>
    columns.map((c) => {
      const v = fn(c);
      return v == null || !Number.isFinite(v) ? null : (v as number);
    });

  return [
    {
      title: "Sizing",
      rows: [
        {
          label: "Peak hour demand",
          unit: "GPH",
          digits: 0,
          direction: "neutral",
          values: get((c) => c.results.peakHourDemand),
        },
        {
          label: "Storage volume (usable)",
          unit: "gal",
          digits: 0,
          direction: "neutral",
          values: get((c) => c.results.storageVolGal),
        },
        {
          label: "First-hour rating (combi)",
          unit: "GPH",
          digits: 0,
          direction: "higher",
          values: get((c) => c.results.combi?.fhr ?? null),
        },
        {
          label: "Recovery",
          unit: "GPH",
          digits: 0,
          direction: "neutral",
          values: get((c) => c.results.recoveryGPH),
        },
        {
          label: "Recovery",
          unit: "kW",
          digits: 1,
          direction: "neutral",
          values: get((c) => c.results.recoveryKW),
        },
        {
          label: "HPWH nameplate",
          unit: "kW",
          digits: 1,
          direction: "neutral",
          values: get((c) => c.results.hpwhNameplateKW),
        },
      ],
    },
    {
      title: "Annual energy & cost",
      rows: [
        {
          label: "Annual gas",
          unit: "therms",
          digits: 0,
          direction: "lower",
          values: get((c) => c.results.annualGasTherms),
        },
        {
          label: "Annual electric",
          unit: "kWh",
          digits: 0,
          direction: "lower",
          values: get((c) => totalAnnualKWh(c.results)),
        },
        {
          label: "Annual cost",
          digits: 0,
          direction: "lower",
          currency: true,
          values: get((c) => totalAnnualCost(c.results)),
        },
        {
          label: "Annual CO₂",
          unit: "lb",
          digits: 0,
          direction: "lower",
          values: get((c) => totalAnnualCarbon(c.results)),
        },
        {
          label: "Annual COP / UEF",
          digits: 2,
          direction: "higher",
          values: get((c) => bestEfficiency(c)),
        },
      ],
    },
    {
      title: "Lifecycle",
      rows: [
        {
          label: "Auto-size capCost",
          digits: 0,
          direction: "lower",
          currency: true,
          values: get((c) => numericOrNull(c.results.autoSize?.recommended?.capCost)),
        },
        {
          label: "Auto-size annual",
          digits: 0,
          direction: "lower",
          currency: true,
          values: get((c) => numericOrNull(c.results.autoSize?.recommended?.annCost)),
        },
        {
          label: "Auto-size 15-yr lifecycle",
          digits: 0,
          direction: "lower",
          currency: true,
          values: get((c) => numericOrNull(c.results.autoSize?.recommended?.total15)),
        },
        {
          label: "Lifecycle-optimal capCost",
          digits: 0,
          direction: "lower",
          currency: true,
          values: get((c) => numericOrNull(c.results.autoSize?.lifecycle?.capCost)),
        },
      ],
    },
    {
      title: "Compliance",
      rows: [
        {
          label: "Failures",
          digits: 0,
          direction: "lower",
          values: get((c) => c.results.flags.filter((f) => f.level === "error").length),
        },
        {
          label: "Warnings",
          digits: 0,
          direction: "lower",
          values: get((c) => c.results.flags.filter((f) => f.level === "warn").length),
        },
        {
          label: "Info notes",
          digits: 0,
          direction: "neutral",
          values: get((c) => c.results.flags.filter((f) => f.level === "info").length),
        },
      ],
    },
  ];
}

function totalAnnualKWh(r: CalcResult): number {
  // Combi systems express kWh through `combi.combiTotalAnnualKWh`; central HPWH
  // uses `annualHPWHKWh_total`. Resistance + HPWH may both contribute. Sum
  // anything we have so the comparison is fair across system types.
  const central = (r.annualHPWHKWh_total ?? 0) + (r.annualResistanceKWh ?? 0);
  const combi = r.combi?.combiTotalAnnualKWh ?? 0;
  return central + combi;
}

function totalAnnualCost(r: CalcResult): number {
  const gas = r.annualGasCost ?? 0;
  const elec = (r.annualHPWHCost ?? 0) + (r.annualResistanceCost ?? 0);
  const combi = r.combi?.combiTotalAnnualCost ?? 0;
  // monthly model already rolls combi cost into combiTotalAnnualCost; for
  // central systems the `annual*Cost` fields are the canonical numbers.
  return gas + elec + combi;
}

function totalAnnualCarbon(r: CalcResult): number {
  const gas = r.annualGasCarbon ?? 0;
  const elec = (r.annualHPWHCarbon ?? 0) + (r.annualResistanceCarbon ?? 0);
  const combi = r.combi?.combiTotalAnnualCarbon ?? 0;
  return gas + elec + combi;
}

/** Pick the most relevant efficiency metric for the column's system type. */
function bestEfficiency(c: ColumnData): number | null {
  const sys = SYSTEM_TYPES[c.inputs.systemType];
  if (sys?.tech === "hpwh") {
    const cop = c.results.annualCOP || c.results.combi?.seasonalCOP_dhw;
    return Number.isFinite(cop) && cop > 0 ? cop : null;
  }
  if (sys?.tech === "gas") {
    const uef = c.results.inUnitGas?.gasTankUEF;
    if (Number.isFinite(uef) && uef > 0) return uef;
    if (Number.isFinite(c.inputs.gasEfficiency) && c.inputs.gasEfficiency > 0) {
      return c.inputs.gasEfficiency;
    }
  }
  if (sys?.tech === "resistance") return 1.0;
  return null;
}

function numericOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
