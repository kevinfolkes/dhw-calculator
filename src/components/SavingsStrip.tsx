"use client";

/**
 * SavingsStrip — domain-agnostic savings rollup display. Takes a "current"
 * and "proposed" set of metrics and renders the energy / cost / carbon
 * deltas plus simple payback (when capex deltas are available).
 *
 * Used by the RetrofitComparison widget.
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { fmt, fmtUSD } from "@/lib/utils";

/** The minimum-viable rollup the strip needs to render. Both DHW and
 *  Lighting calculators export `extractMetrics(result)` helpers that
 *  produce this shape from their domain results. Site-energy units (kWh
 *  vs therms) are kept separate so each row makes sense — adding them as
 *  one "energy" number would conflate fuel switching gracelessly. */
export interface RetrofitMetrics {
  /** Annual electricity (kWh). Always populated; 0 for pure-gas systems. */
  kwh: number;
  /** Annual gas (therms). Always populated; 0 for pure-electric systems. */
  therms: number;
  /** Annual cost ($). Always populated. */
  cost: number;
  /** Annual carbon (lb CO₂e). Always populated. */
  carbon: number;
  /** Capital expenditure ($). Optional — drives the simple payback row when
   *  both current and proposed carry it. */
  capex?: number;
}

export function SavingsStrip({
  current,
  proposed,
}: {
  current: RetrofitMetrics;
  proposed: RetrofitMetrics;
}) {
  const kwhDelta = proposed.kwh - current.kwh;
  const thermsDelta = proposed.therms - current.therms;
  const costDelta = proposed.cost - current.cost;
  const carbonDelta = proposed.carbon - current.carbon;
  const capexDelta =
    typeof proposed.capex === "number" && typeof current.capex === "number"
      ? proposed.capex - current.capex
      : null;

  // Simple payback (years) = capex delta / annual cost savings, only when
  // both numbers point in the right direction (proposed costs MORE upfront
  // and saves money operationally).
  let payback: number | null = null;
  if (capexDelta !== null && capexDelta > 0 && costDelta < 0) {
    payback = capexDelta / -costDelta;
  }

  return (
    <Card accent="var(--accent-emerald)">
      <CardHeader>
        <CardTitle>Savings (proposed vs current)</CardTitle>
      </CardHeader>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <DeltaCell
          label="Electricity"
          unit="kWh/yr"
          delta={kwhDelta}
          baseline={current.kwh}
          digits={0}
          lowerIsBetter
        />
        <DeltaCell
          label="Gas"
          unit="therms/yr"
          delta={thermsDelta}
          baseline={current.therms}
          digits={0}
          lowerIsBetter
        />
        <DeltaCell
          label="Cost"
          unit="$/yr"
          delta={costDelta}
          baseline={current.cost}
          digits={0}
          lowerIsBetter
          currency
        />
        <DeltaCell
          label="Carbon"
          unit="lb CO₂e/yr"
          delta={carbonDelta}
          baseline={current.carbon}
          digits={0}
          lowerIsBetter
        />
        {capexDelta !== null && (
          <DeltaCell
            label="Capex Δ"
            unit="$"
            delta={capexDelta}
            baseline={current.capex ?? 0}
            digits={0}
            // Higher capex is "worse" but it's the cost of the retrofit, not
            // a operating expense — we still highlight in red when proposed
            // costs more upfront, blue when it costs less (rare).
            lowerIsBetter
            currency
          />
        )}
        {payback !== null && (
          <PaybackCell years={payback} />
        )}
      </div>
    </Card>
  );
}

function DeltaCell({
  label,
  unit,
  delta,
  baseline,
  digits,
  lowerIsBetter,
  currency,
}: {
  label: string;
  unit: string;
  delta: number;
  baseline: number;
  digits: number;
  lowerIsBetter: boolean;
  currency?: boolean;
}) {
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const positive =
    (lowerIsBetter && delta < 0) || (!lowerIsBetter && delta > 0);
  const negative =
    (lowerIsBetter && delta > 0) || (!lowerIsBetter && delta < 0);
  const color = positive
    ? "var(--accent-emerald)"
    : negative
    ? "var(--accent-red)"
    : "var(--text-muted)";
  const bg = positive
    ? "var(--accent-emerald-bg)"
    : negative
    ? "var(--accent-red-bg)"
    : "var(--surface-subtle, rgba(0,0,0,0.03))";
  const pct =
    baseline !== 0 && Number.isFinite(baseline)
      ? `${((delta / baseline) * 100).toFixed(1)}%`
      : "n/a";

  const formatted = currency ? fmtUSD(Math.abs(delta), digits) : fmt(Math.abs(delta), digits);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        borderRadius: 8,
        background: bg,
        border: `1px solid ${color === "var(--text-muted)" ? "var(--border-light)" : color}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color,
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <Icon size={14} />
        {delta === 0 ? "0" : `${delta > 0 ? "+" : "−"}${formatted}`}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginLeft: 4,
            textTransform: "none",
          }}
        >
          {unit}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
        {pct} vs current
      </div>
    </div>
  );
}

function PaybackCell({ years }: { years: number }) {
  const display =
    years > 30 ? "> 30 yr" : years < 1 ? `${(years * 12).toFixed(1)} mo` : `${years.toFixed(1)} yr`;
  const tone =
    years <= 5
      ? "var(--accent-emerald)"
      : years <= 15
      ? "var(--accent-blue)"
      : "var(--accent-amber)";
  const bg =
    years <= 5
      ? "var(--accent-emerald-bg)"
      : years <= 15
      ? "var(--accent-blue-bg)"
      : "var(--accent-amber-bg)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        borderRadius: 8,
        background: bg,
        border: `1px solid ${tone}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        Simple payback
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: tone,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {display}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
        capex Δ ÷ annual savings
      </div>
    </div>
  );
}
