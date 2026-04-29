"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Info } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { MetricCard } from "@/components/ui/MetricCard";
import { fmt, fmtUSD } from "@/lib/utils";
import { SYSTEM_TYPES, type SystemTypeKey } from "@/lib/engineering/system-types";
import type { CalcResult, SizingRec } from "@/lib/calc/types";
import type { DhwInputs } from "@/lib/calc/inputs";

interface Props {
  result: CalcResult;
  inputs: DhwInputs;
  onApplyRecommended: () => void;
  onApplyLifecycle: () => void;
}

export function AutoSizeTab({ result, inputs, onApplyRecommended, onApplyLifecycle }: Props) {
  const a = result.autoSize;
  const sys = SYSTEM_TYPES[inputs.systemType];

  if (!a) {
    return (
      <Card>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Auto-sizing unavailable for this system type.
        </p>
      </Card>
    );
  }

  const isCentral = sys.topology === "central";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ------------------------------------------------------------------ */}
      {/* 1. OVERVIEW + FLOW STRIP                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card accent="var(--accent-blue)">
        <Overview>
          <strong>Auto-Size</strong> takes the governing demand from the previous tab and suggests
          equipment at three safety margins. Every recommendation must pass <em>demand
          adequacy</em> (FHR ≥ peak-hour, or BTU/hr ≥ design load) and every code constraint;
          beyond that, the three philosophies differ in how much headroom they build in and how
          they value operating cost.
        </Overview>
        <FlowStrip
          steps={[
            { label: "Demand", active: false },
            { label: "Auto-Size", active: true },
            { label: isCentral ? "Sizing + Equipment" : "In-Unit tab", active: false },
            { label: "Energy Model", active: false },
          ]}
        />
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 2. WHAT WE'RE SIZING — system-specific                              */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>1. What the sizer is picking</CardTitle>
        </CardHeader>
        <Prose style={{ marginBottom: 10 }}>
          For <strong>{sys.label}</strong>, the sizer optimizes over:
        </Prose>
        <WhatWereSizing systemType={inputs.systemType} />
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 3. DESIGN REQUIREMENTS                                              */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>2. Design requirements — what every recommendation must meet</CardTitle>
        </CardHeader>
        <Prose>
          These are hard minimums derived from the governing demand method. Any candidate
          equipment size that fails one of these is disqualified before margins or cost are
          considered.
        </Prose>
        <div style={{ marginTop: 12 }}>
          <Grid cols={3}>
            {a.reqPeakHourGPH != null && (
              <MetricCard
                label="Peak hour demand"
                value={fmt(a.reqPeakHourGPH)}
                unit="GPH"
                sub="Governs storage + recovery"
                accent="var(--accent-blue)"
              />
            )}
            {a.reqOutputMBH != null && (
              <MetricCard
                label="Design output"
                value={fmt(a.reqOutputMBH)}
                unit="MBH"
                sub={`Recovery + recirc loss, ${fmt(result.temperatureRise)}°F rise`}
                accent="var(--accent-blue)"
              />
            )}
            {a.reqOutputKW != null && (
              <MetricCard
                label="Design output"
                value={fmt(a.reqOutputKW, 1)}
                unit="kW"
                sub="Equivalent electrical"
                accent="var(--accent-blue)"
              />
            )}
            {a.reqFHR != null && (
              <MetricCard
                label="Per-unit FHR"
                value={fmt(a.reqFHR)}
                unit="GPH"
                sub="AHRI 1300 first-hour rating"
                accent="var(--accent-blue)"
              />
            )}
            {a.reqPeakGPM != null && (
              <MetricCard
                label="Peak instantaneous flow"
                value={fmt(a.reqPeakGPM, 1)}
                unit="GPM"
                sub={`At ${fmt(inputs.tanklessDesignRiseF)}°F design rise`}
                accent="var(--accent-blue)"
              />
            )}
            {a.reqInputMBH_derated != null && (
              <MetricCard
                label="Required input (derated)"
                value={fmt(a.reqInputMBH_derated)}
                unit="MBH"
                sub="Accounts for UEF < 1"
                accent="var(--accent-blue)"
              />
            )}
            {a.worstHeatingLoad != null && (
              <MetricCard
                label="Worst per-unit heating"
                value={fmt(a.worstHeatingLoad)}
                unit="BTU/hr"
                sub="Largest of 1/2/3-BR loads (combi)"
                accent="var(--accent-violet)"
              />
            )}
          </Grid>
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 4. THE THREE PHILOSOPHIES                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>3. Three sizing philosophies, explained</CardTitle>
        </CardHeader>
        <Prose style={{ marginBottom: 12 }}>
          Each recommendation takes the same requirements and applies a different sizing
          philosophy. All three pass demand + code; they differ in how conservative they are and
          whether they optimize for installed cost or lifetime cost.
        </Prose>
        <Grid cols={3}>
          <PhilosophyCard
            title="Minimum"
            accent="var(--accent-amber)"
            margin="1.00×"
            rule="Smallest standard size with no safety margin"
            wins="Lowest install cost"
            risks="No headroom for demand growth, fixture additions, cold-inlet surprises, or equipment degradation"
          />
          <PhilosophyCard
            title="Recommended"
            accent="var(--accent-blue)"
            margin={recommendedMarginLabel(inputs.systemType)}
            rule={recommendedRuleLabel(inputs.systemType)}
            wins="Industry-standard safety factor; most MEPs specify at this level"
            risks="Slightly higher capex; may still fall short on 15-yr total if opex dominates"
          />
          <PhilosophyCard
            title="Lifecycle optimal"
            accent="var(--accent-emerald)"
            margin="Optimized"
            rule="Iterates over all candidate sizes that pass demand, picks the size minimizing capex + 15 × annual energy cost"
            wins="Lowest 15-yr total cost"
            risks="May specify a larger tank than you&rsquo;d instinctively pick; capital cost model is illustrative, not RSMeans"
          />
        </Grid>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 5. THE THREE RECOMMENDATIONS                                        */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>4. Your three sized options</CardTitle>
        </CardHeader>
        <Grid cols={3}>
          <RecommendationCard
            title="Minimum"
            rec={a.minimum}
            accent="var(--accent-amber)"
            badge="1.00×"
            subtitle="No safety margin"
          />
          <RecommendationCard
            title="Recommended"
            rec={a.recommended}
            accent="var(--accent-blue)"
            badge={recommendedMarginLabel(inputs.systemType)}
            subtitle="Industry-standard headroom"
            action={{ label: "Apply recommended", onClick: onApplyRecommended }}
          />
          <RecommendationCard
            title="Lifecycle optimal"
            rec={a.lifecycle}
            accent="var(--accent-emerald)"
            badge="Optimized"
            subtitle="Lowest 15-yr total"
            action={{ label: "Apply lifecycle", onClick: onApplyLifecycle }}
            showLifecycle
          />
        </Grid>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 6. 15-YEAR COST COMPARISON CHART                                    */}
      {/* ------------------------------------------------------------------ */}
      <LifecycleComparisonCard min={a.minimum} rec={a.recommended} life={a.lifecycle} />

      {/* ------------------------------------------------------------------ */}
      {/* 7. DOWNSTREAM CALLOUT                                               */}
      {/* ------------------------------------------------------------------ */}
      <Card accent="var(--accent-emerald)">
        <CardHeader>
          <CardTitle>5. What &ldquo;Apply&rdquo; actually does</CardTitle>
        </CardHeader>
        <Prose>
          Clicking <strong>Apply recommended</strong> or <strong>Apply lifecycle</strong> writes
          the chosen equipment size back into your inputs — tank gallons, burner MBH, venting
          tier, or HPWH nameplate depending on system type. That triggers a full recalc: the
          <em> Sizing</em>, <em>Equipment</em>/<em>In-Unit</em>, <em>Energy Model</em>, and
          <em> Compliance</em> tabs all update immediately with the new equipment. You can then
          fine-tune on those tabs and come back here to see if your chosen size still matches a
          named philosophy.
        </Prose>
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            background: "var(--accent-emerald-bg)",
            borderLeft: "3px solid var(--accent-emerald)",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <Info size={12} style={{ verticalAlign: "-2px", marginRight: 6 }} color="var(--accent-emerald)" />
          Your current inputs may not match any of these recommendations. That&rsquo;s fine —
          these are starting points, not gates.
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 8. COST MODEL DISCLOSURE                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>6. Cost model caveats</CardTitle>
        </CardHeader>
        <Prose>
          The capital cost model is a simple USD 2024 rough-order-of-magnitude fit: a base
          appliance cost plus per-gallon or per-MBH/kW scaling, times unit count for in-unit
          systems. <strong>It is accurate enough to pick between philosophies but not to bid
          work.</strong> A real MEP submittal would use RSMeans, local labor multipliers, and
          vendor quotes.
        </Prose>
        <Prose style={{ marginTop: 8 }}>
          Annual energy cost uses the current utility rates on the <em>Building &amp; System</em>
          tab and the full monthly energy model (climate-adjusted COP, monthly inlet temps, HDD
          distribution). 15-year total = <code style={{ fontFamily: "var(--font-mono)" }}>capex + 15 × annual_cost</code>
          &mdash; no discount rate or escalation is applied; add one if you need NPV.
        </Prose>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUB-COMPONENTS
// -----------------------------------------------------------------------------

function WhatWereSizing({ systemType }: { systemType: SystemTypeKey }) {
  const rows = SIZED_VARIABLES[systemType];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: "flex",
            gap: 12,
            padding: "8px 14px",
            background: "#F8FAFC",
            border: "1px solid var(--border-light)",
            borderLeft: "3px solid var(--accent-blue)",
            borderRadius: 8,
          }}
        >
          <div style={{ minWidth: 160, fontSize: 12, fontWeight: 700, color: "var(--accent-blue)" }}>{r.label}</div>
          <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.55 }}>
            <div>{r.detail}</div>
            {r.constraint && (
              <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                {r.constraint}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PhilosophyCard({
  title,
  accent,
  margin,
  rule,
  wins,
  risks,
}: {
  title: string;
  accent: string;
  margin: string;
  rule: string;
  wins: string;
  risks: string;
}) {
  return (
    <div className="ve-card" style={{ borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: accent,
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {margin}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.55 }}>
        <div>{rule}</div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-light)", fontSize: 11, lineHeight: 1.55 }}>
        <div style={{ color: "var(--accent-emerald)" }}>
          <strong>Wins:</strong> <span style={{ color: "var(--text-primary)" }}>{wins}</span>
        </div>
        <div style={{ color: "var(--accent-amber)", marginTop: 4 }}>
          <strong>Risks:</strong> <span style={{ color: "var(--text-primary)" }}>{risks}</span>
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({
  title,
  rec,
  accent,
  badge,
  subtitle,
  action,
  showLifecycle,
}: {
  title: string;
  rec?: SizingRec | null;
  accent: string;
  badge: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
  showLifecycle?: boolean;
}) {
  if (!rec) {
    return (
      <div className="ve-card" style={{ borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Not available.</p>
      </div>
    );
  }
  return (
    <div className="ve-card" style={{ borderLeft: `3px solid ${accent}`, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: accent,
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {badge}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{subtitle}</div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 12 }}>
        {Object.entries(rec)
          .filter(([k]) => !["capCost", "annCost", "total15"].includes(k))
          .map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>{humanizeKey(k)}</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{formatRecVal(v)}</span>
            </div>
          ))}
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: 4 }}>
        <Row label="Install cost" value={fmtUSD(rec.capCost)} />
        <Row label="Annual energy" value={fmtUSD(rec.annCost) + "/yr"} />
        <Row
          label="15-yr total"
          value={fmtUSD(
            typeof rec.total15 === "number" ? rec.total15 : (rec.capCost ?? 0) + (rec.annCost ?? 0) * 15,
          )}
          strong={showLifecycle}
        />
      </div>
      {action && (
        <button className="ve-btn" style={{ marginTop: 12, width: "100%" }} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function LifecycleComparisonCard({
  min,
  rec,
  life,
}: {
  min?: SizingRec;
  rec?: SizingRec;
  life?: SizingRec | null;
}) {
  const rows = [
    { name: "Minimum", rec: min, color: "#F59E0B" },
    { name: "Recommended", rec: rec, color: "#1D4ED8" },
    { name: "Lifecycle", rec: life, color: "#059669" },
  ]
    .filter((r): r is { name: string; rec: SizingRec; color: string } => !!r.rec)
    .map((r) => ({
      name: r.name,
      Capex: Math.round(r.rec.capCost ?? 0),
      "15 yr Opex": Math.round((r.rec.annCost ?? 0) * 15),
      Total: Math.round(
        typeof r.rec.total15 === "number" ? r.rec.total15 : (r.rec.capCost ?? 0) + (r.rec.annCost ?? 0) * 15,
      ),
      color: r.color,
    }));

  if (rows.length === 0) return null;

  const best = rows.reduce((a, b) => (a.Total <= b.Total ? a : b));

  return (
    <Card>
      <CardHeader>
        <CardTitle>15-year cost comparison</CardTitle>
      </CardHeader>
      <Prose style={{ marginBottom: 12 }}>
        Stacked capital cost (at install) + 15 years of operating cost at current utility rates.
        Lowest total is highlighted.
      </Prose>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ left: 20, right: 20, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EF" />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              stroke="#6B7280"
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#6B7280" width={100} />
            <Tooltip
              wrapperStyle={{ fontSize: 12 }}
              formatter={(v) => (typeof v === "number" ? `$${v.toLocaleString()}` : String(v))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Capex" stackId="c" fill="#7DBBD3" />
            <Bar dataKey="15 yr Opex" stackId="c" fill="#F2A85B" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div
        style={{
          marginTop: 10,
          padding: "10px 14px",
          background: "var(--accent-emerald-bg)",
          borderLeft: "3px solid var(--accent-emerald)",
          borderRadius: 8,
          fontSize: 12,
          color: "var(--text-primary)",
        }}
      >
        Lowest 15-yr total: <strong>{best.name}</strong> at <strong>{fmtUSD(best.Total)}</strong>
        {"  "}(capex {fmtUSD(best.Capex)} + opex {fmtUSD(best["15 yr Opex"])})
      </div>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: strong ? 700 : 500, fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}

function Overview({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7 }}>{children}</div>;
}

function Prose({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, ...style }}>{children}</div>;
}

function FlowStrip({ steps }: { steps: Array<{ label: string; active: boolean }> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      {steps.map((s, i) => (
        <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              background: s.active ? "var(--accent-blue)" : "var(--accent-blue-bg)",
              color: s.active ? "#fff" : "var(--accent-blue)",
            }}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <ArrowRight size={14} color="var(--text-muted)" />}
        </span>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// STATIC DATA
// -----------------------------------------------------------------------------

interface SizedVariable { label: string; detail: string; constraint?: string }

const SIZED_VARIABLES: Record<SystemTypeKey, SizedVariable[]> = {
  central_gas: [
    { label: "Storage tank (gal)", detail: "From standard sizes 80 / 100 / 119 / 175 / 250 / 400 / 600 / 800 / 1000 / 1500 / 2000 gal.", constraint: "peak_hour × 1.25 ÷ 0.75" },
    { label: "Burner input (MBH)", detail: "From standard sizes 100 / 150 / 200 / 300 / 400 / 500 / 750 / 1000 / 1500 / 2000 MBH.", constraint: "recovery_BTUH ÷ gas_efficiency" },
  ],
  central_gas_tankless: [
    { label: "Module input (MBH)", detail: "From 200 / 400 / 600 / 1000 / 1500 / 2000 / 3000 / 4000 MBH. Modulating condensing tankless cascades.", constraint: "capacity_at_rise ≥ 1.5 × peak_GPM (ASHRAE Ch. 51 instantaneous)" },
  ],
  central_indirect: [
    { label: "Storage tank (gal)", detail: "Same standard sizes as central gas — indirect-fired or paired with plate HX.", constraint: "peak_hour × 1.25 ÷ 0.75" },
    { label: "Boiler input (MBH)", detail: "Same standard sizes as central gas. Sized for the combined gas η × HX effectiveness so the potable side meets recovery.", constraint: "recovery_BTUH ÷ (gas_efficiency × HX_effectiveness)" },
  ],
  central_hybrid: [
    { label: "Storage tank (gal)", detail: "Same standard sizes as central gas / central HPWH.", constraint: "peak_hour × 1.25 ÷ 0.75" },
    { label: "HPWH primary (kW)", detail: "From 15 / 20 / 30 / 40 / 60 / 80 / 120 / 160 / 200 / 300 kW. Carries the baseload share of the design load (split_ratio × total_kW), then derated for cold ambient capacity factor.", constraint: "(split_ratio × total_kW) ÷ COP ÷ capacity_factor" },
    { label: "Gas backup (MBH)", detail: "From 100 / 150 / 200 / 300 / 400 / 500 / 750 / 1000 / 1500 / 2000 MBH. Covers the remaining (1 − split_ratio) × total_BTUH for winter peaks and rapid recovery.", constraint: "(1 − split_ratio) × total_BTUH ÷ gas_efficiency" },
  ],
  central_steam_hx: [
    { label: "Storage tank (gal)", detail: "Same standard sizes as central gas — indirect-fired tank fed by the steam HX.", constraint: "peak_hour × 1.25 ÷ 0.75" },
    { label: "Steam HX rating (MBH)", detail: "Reuses the central-gas MBH ladder as a proxy for steam HX kBTU/hr output. Sized for the combined steam-source × HX effectiveness so the potable side meets recovery.", constraint: "recovery_BTUH ÷ (steam_source_eff × HX_effectiveness)" },
  ],
  central_resistance: [
    { label: "Storage tank (gal)", detail: "Same standard sizes as central gas.", constraint: "peak_hour × 1.25 ÷ 0.75" },
    { label: "Electric element (kW)", detail: "From 12 / 18 / 27 / 36 / 54 / 72 / 108 / 144 / 180 / 216 / 288 kW.", constraint: "total_BTUH ÷ 3412" },
  ],
  central_hpwh: [
    { label: "Primary storage (gal)", detail: "Same tank sizes as central gas.", constraint: "peak_hour × 1.25 ÷ 0.75" },
    { label: "HPWH nameplate (kW)", detail: "From 15 / 20 / 30 / 40 / 60 / 80 / 120 / 160 / 200 / 300 kW. Size must cover cold-ambient derating.", constraint: "total_kW ÷ COP ÷ capacity_factor" },
  ],
  inunit_gas_tank: [
    { label: "Per-unit tank (gal)", detail: "40 / 50 / 75 / 100 gal, sized to meet FHR.", constraint: "FHR ≥ peak_hour_per_apt" },
    { label: "Efficiency tier", detail: "Condensing (UEF 0.80–0.96, PVC direct-vent) vs non-condensing (UEF 0.60–0.70, Cat I atmospheric or Cat III power-vent). Federal UEF 0.81+ restricts atmospheric ≥50 gal for new construction." },
  ],
  inunit_gas_tankless: [
    { label: "Per-unit input (MBH)", detail: "150 / 180 / 199 MBH.", constraint: "capacity_at_rise ≥ peak_GPM (top-N fixtures × 85%)" },
  ],
  inunit_hpwh: [
    { label: "Per-unit tank (gal)", detail: "50 / 66 / 80 / 120 gal (AHRI 1300 / ENERGY STAR certified).", constraint: "FHR ≥ peak_hour_per_apt" },
  ],
  inunit_combi: [
    { label: "Per-unit tank (gal)", detail: "50 / 66 / 80 / 120 gal serving DHW + hydronic fan coil.", constraint: "FHR ≥ peak_hour_per_apt AND compressor_BTUH ≥ worst_heating - 3kW backup at recommended" },
  ],
  inunit_combi_gas: [
    { label: "Per-unit tank (gal)", detail: "40 / 50 / 75 / 100 gal serving DHW + hydronic fan coil.", constraint: "FHR ≥ peak_hour_per_apt AND input_MBH × UEF × 1000 ≥ worst_heating" },
    { label: "Efficiency tier", detail: "Condensing vs non-condensing." },
  ],
};

const HUMAN_KEYS: Record<string, string> = {
  tank: "Tank size (gal)",
  tankGal: "Tank size (gal)",
  cap: "Capacity",
  capUnit: "Cap unit",
  cap2: "Secondary capacity",
  cap2Unit: "Secondary cap unit",
  inputMBH: "Input (MBH)",
  subtype: "Venting",
  system: "System",
};

function humanizeKey(k: string): string {
  return HUMAN_KEYS[k] ?? k;
}

function formatRecVal(v: unknown): string {
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function recommendedMarginLabel(st: SystemTypeKey): string {
  switch (st) {
    case "central_gas": return "+25% MBH";
    case "central_gas_tankless": return "+25% peak GPM";
    case "central_indirect": return "+25% MBH (HX-derated)";
    case "central_hybrid": return "+25% HPWH + gas";
    case "central_steam_hx": return "+25% MBH (HX-derated)";
    case "central_resistance": return "+20% kW";
    case "central_hpwh": return "+25% nameplate";
    case "inunit_gas_tank": return "+15% FHR";
    case "inunit_gas_tankless": return "+15% capacity";
    case "inunit_hpwh": return "+15% FHR";
    case "inunit_combi": return "+15% FHR, ≤3kW backup";
    case "inunit_combi_gas": return "+15% FHR + heating";
  }
}

function recommendedRuleLabel(st: SystemTypeKey): string {
  switch (st) {
    case "central_gas": return "Smallest input MBH ≥ 1.25 × minimum (absorbs off-design + diversity error)";
    case "central_gas_tankless": return "Smallest module MBH whose capacity at design rise ≥ 1.25 × required peak GPM";
    case "central_indirect": return "Smallest boiler MBH ≥ 1.25 × minimum, where minimum derates by gas η × HX effectiveness";
    case "central_hybrid": return "HPWH nameplate sized to ≥ 1.25 × (split_ratio × total_kW) ÷ capacity_factor; gas backup MBH ≥ 1.25 × (1 − split_ratio) × total_BTUH ÷ gas_efficiency";
    case "central_steam_hx": return "Smallest steam HX MBH ≥ 1.25 × minimum, where minimum derates by steam_source_eff × HX_effectiveness";
    case "central_resistance": return "Smallest kW ≥ 1.20 × minimum";
    case "central_hpwh": return "Smallest nameplate ≥ 1.25 × minimum (absorbs cold-ambient derate)";
    case "inunit_gas_tank": return "Smallest tank whose condensing FHR ≥ 1.15 × peak-hour per unit";
    case "inunit_gas_tankless": return "Smallest input whose capacity at design rise ≥ 1.15 × peak GPM";
    case "inunit_hpwh": return "Smallest tank whose FHR ≥ 1.15 × peak-hour per unit";
    case "inunit_combi": return "Smallest tank whose FHR ≥ 1.15 × peak-hour AND resistance backup ≤ 3 kW";
    case "inunit_combi_gas": return "Smallest tank whose FHR ≥ 1.15 × peak-hour AND output covers 1.15 × worst heating load";
  }
}
