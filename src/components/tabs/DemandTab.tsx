"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, NumberInput, SelectInput } from "@/components/ui/Field";
import { Grid } from "@/components/ui/Grid";
import { MetricCard } from "@/components/ui/MetricCard";
import { fmt } from "@/lib/utils";
import type { DhwInputs, DemandMethod } from "@/lib/calc/inputs";
import { UNIT_FIXTURE_MIX } from "@/lib/calc/demand";
import { WSFU } from "@/lib/engineering/constants";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import type { CalcResult } from "@/lib/calc/types";

interface Props {
  inputs: DhwInputs;
  update: <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => void;
  result: CalcResult;
}

export function DemandTab({ inputs, update, result }: Props) {
  const sys = SYSTEM_TYPES[inputs.systemType];
  const isCentral = sys.topology === "central";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ------------------------------------------------------------------ */}
      {/* 1. OVERVIEW — why this tab exists                                   */}
      {/* ------------------------------------------------------------------ */}
      <Card accent="var(--accent-blue)">
        <Overview>
          <strong>Demand</strong>{" "}is where we estimate how much hot water the building actually
          needs &mdash; expressed as peak&#8209;hour, peak&#8209;day, and average daily flow. Every
          downstream step depends on it: storage volume scales with peak hour, recovery scales with
          peak hour, and annual energy integrates against average daily flow.
          <FlowStrip
            steps={[
              { label: "Demand", active: true },
              { label: isCentral ? "Storage + Recovery" : "Tank / Tankless", active: false },
              { label: "Auto-Size", active: false },
              { label: "Energy Model", active: false },
            ]}
          />
        </Overview>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 2. METHOD PICKER                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>1. Choose the governing demand method</CardTitle>
        </CardHeader>
        <Prose>
          All three methods are computed in parallel. You pick one to <em>govern</em> downstream
          sizing. Each method answers the same question (&ldquo;what&rsquo;s peak-hour hot-water
          flow?&rdquo;) through a different lens:
        </Prose>
        <MethodExplainer method={inputs.demandMethod} />
        <div style={{ marginTop: 14 }}>
          <Grid cols={3}>
            <Field label="Method" hint="Governs storage/recovery sizing.">
              <SelectInput
                value={inputs.demandMethod}
                onChange={(v) => update("demandMethod", v)}
                options={[
                  { value: "ashrae", label: "ASHRAE Ch. 51 Table 7" },
                  { value: "hunter", label: "Hunter / ASPE Modified" },
                  { value: "occupancy", label: "Occupancy (gpcd)" },
                ]}
              />
            </Field>
            <Field label="Avg occupants / 1-BR" hint="Used by occupancy method only.">
              <NumberInput
                value={inputs.occupantsPerUnit.br1}
                onChange={(n) => update("occupantsPerUnit", { ...inputs.occupantsPerUnit, br1: n })}
                step={0.1}
              />
            </Field>
            <Field label="GPCD (hot water / person / day)" suffix="gal">
              <NumberInput value={inputs.gpcd} onChange={(n) => update("gpcd", n)} step={1} />
            </Field>
          </Grid>
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 3. SIDE-BY-SIDE METHOD COMPARISON — governing highlighted          */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>2. Compare all three methods</CardTitle>
        </CardHeader>
        <Prose>
          Peak-hour demand (GPH) predicted by each method for your current building. Why they
          differ: ASHRAE is a calibrated lookup; Hunter/ASPE is a fixture-unit probability curve;
          Occupancy is behavioral. For a well-specified building they should agree within ~20–30%.
        </Prose>
        <div style={{ marginTop: 12 }}>
          <Grid cols={3}>
            <MethodCard
              name="ASHRAE"
              method="ashrae"
              governing={inputs.demandMethod}
              value={result.demandASHRAE_MH}
              formula={`${inputs.occupancyProfile} × ${result.totalUnits} units`}
              accent="var(--accent-blue)"
            />
            <MethodCard
              name="Hunter / ASPE"
              method="hunter"
              governing={inputs.demandMethod}
              value={result.demandHunter_MH}
              formula={`${fmt(result.peakGPM_modified, 1)} GPM × 60 × ${(result.diversityFactor * 100).toFixed(0)}% div`}
              accent="var(--accent-violet)"
              scaleWarning={
                result.totalUnits < 10
                  ? `Unreliable below 10 apartments (you have ${result.totalUnits}). Hunter is calibrated for population-scale co-use — at this scale it typically overstates peak by 10–30×. Use ASHRAE or Occupancy as governing.`
                  : result.totalUnits < 30
                  ? `Marginal scale (${result.totalUnits} apts). Hunter may overstate peak by 2–3×; cross-check against ASHRAE before committing.`
                  : undefined
              }
            />
            <MethodCard
              name="Occupancy"
              method="occupancy"
              governing={inputs.demandMethod}
              value={result.demandOccupancy_MH}
              formula={`${result.totalOccupants.toFixed(0)} occ × ${inputs.gpcd} gpcd × 25%`}
              accent="var(--accent-emerald)"
            />
          </Grid>
        </div>
        <AgreementDiagnostic
          ashrae={result.demandASHRAE_MH}
          hunter={result.demandHunter_MH}
          occupancy={result.demandOccupancy_MH}
          occupancyProfile={inputs.occupancyProfile}
        />
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 4. HUNTER WSFU BREAKDOWN — transparency                             */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>3. Hunter/ASPE breakdown — fixture units</CardTitle>
        </CardHeader>
        <Prose>
          The Hunter method aggregates Water Supply Fixture Units (WSFU, IPC Table 604.3 hot
          column) and converts the sum to GPM via a piecewise curve fit, then applies a diversity
          factor. Here&rsquo;s exactly what the calculator assumes per unit type:
        </Prose>
        <WSFUTable />
        <Prose style={{ marginTop: 12 }}>
          Aggregate for your building:
        </Prose>
        <Grid cols={result.wsfuBreakdown.br0Count > 0 ? 5 : 4}>
          {result.wsfuBreakdown.br0Count > 0 && (
            <MiniStat
              label="Studio × count"
              value={`${fmt(result.wsfuBreakdown.br0, 2)} × ${result.wsfuBreakdown.br0Count}`}
              sub={`= ${fmt(result.wsfuBreakdown.br0 * result.wsfuBreakdown.br0Count, 1)} WSFU`}
            />
          )}
          <MiniStat
            label="1-BR × count"
            value={`${fmt(result.wsfuBreakdown.br1, 2)} × ${result.wsfuBreakdown.br1Count}`}
            sub={`= ${fmt(result.wsfuBreakdown.br1 * result.wsfuBreakdown.br1Count, 1)} WSFU`}
          />
          <MiniStat
            label="2-BR × count"
            value={`${fmt(result.wsfuBreakdown.br2, 2)} × ${result.wsfuBreakdown.br2Count}`}
            sub={`= ${fmt(result.wsfuBreakdown.br2 * result.wsfuBreakdown.br2Count, 1)} WSFU`}
          />
          <MiniStat
            label="3-BR × count"
            value={`${fmt(result.wsfuBreakdown.br3, 2)} × ${result.wsfuBreakdown.br3Count}`}
            sub={`= ${fmt(result.wsfuBreakdown.br3 * result.wsfuBreakdown.br3Count, 1)} WSFU`}
          />
          <MiniStat
            label="Total WSFU"
            value={fmt(result.hotWSFU, 1)}
            accent="var(--accent-violet)"
          />
        </Grid>
        <Prose style={{ marginTop: 12 }}>
          <strong>WSFU → GPM → peak hour:</strong>
        </Prose>
        <Grid cols={3}>
          <MiniStat
            label="GPM (Modified, low-flow)"
            value={fmt(result.peakGPM_modified, 1)}
            sub="ASPE fit — default for WaterSense fixtures"
            accent="var(--accent-violet)"
          />
          <MiniStat
            label="GPM (Classical 1940)"
            value={fmt(result.peakGPM_classical, 1)}
            sub="Conservative — legacy high-flow"
            accent="var(--accent-amber)"
          />
          <MiniStat
            label="Diversity factor"
            value={`${Math.round(result.diversityFactor * 100)}%`}
            sub={
              result.hotWSFU > 100
                ? "55% (WSFU > 100)"
                : result.hotWSFU > 30
                ? "65% (30 < WSFU ≤ 100)"
                : "80% (WSFU ≤ 30)"
            }
          />
        </Grid>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 5. GOVERNING RESULT + DOWNSTREAM USE                                */}
      {/* ------------------------------------------------------------------ */}
      <Card accent="var(--accent-emerald)">
        <CardHeader>
          <CardTitle>
            4. Governing demand &mdash; the numbers that drive sizing
          </CardTitle>
        </CardHeader>
        <Prose>
          You selected <strong>{methodLabel(inputs.demandMethod)}</strong>. These three values are
          the baton that the rest of the calculator runs with:
        </Prose>
        <Grid cols={3}>
          <MetricCard
            label="Peak hour"
            value={fmt(result.peakHourDemand)}
            unit="GPH"
            sub="Drives storage + recovery"
            accent="var(--accent-blue)"
          />
          <MetricCard
            label="Peak day"
            value={fmt(result.peakDayDemand)}
            unit="GPH"
            sub="Redundancy / DHW storage floor"
            accent="var(--accent-blue)"
          />
          <MetricCard
            label="Avg daily"
            value={fmt(result.avgDayDemand)}
            unit="GPH"
            sub="Drives annual energy model"
            accent="var(--accent-blue)"
          />
        </Grid>
        <div style={{ marginTop: 14 }}>
          <Prose>
            <strong>How these feed the next tabs:</strong>
          </Prose>
          <DownstreamList
            items={[
              {
                formula: `storage = peak_hour × 1.25 ÷ 0.75 usable = ${fmt(
                  (result.peakHourDemand * 1.25) / 0.75,
                )} gal`,
                tab: isCentral ? "Sizing" : "Auto-Size",
                purpose: "Sets central storage volume (ASHRAE method)",
              },
              {
                formula: `recovery = peak_hour × 0.30 × 8.33 × ΔT = ${fmt(
                  result.peakHourDemand * 0.30 * 8.33 * result.temperatureRise,
                )} BTU/hr`,
                tab: "Equipment / Auto-Size",
                purpose: "Required burner input (gas) or nameplate kW (electric)",
              },
              {
                formula: `annual_BTU = avg_daily × 365 × 8.33 × ΔT = ${fmt(
                  result.avgDayDemand * 365 * 8.33 * result.temperatureRise,
                )} BTU/yr`,
                tab: "Energy Model",
                purpose: "Annual gas therms / HPWH kWh",
              },
            ]}
          />
        </div>
      </Card>

    </div>
  );
}

// -----------------------------------------------------------------------------
// SUB-COMPONENTS (private to this tab)
// -----------------------------------------------------------------------------

/**
 * Live cross-method agreement check. Flags when the three demand methods
 * disagree by >30% and suggests which assumption to revisit based on which
 * method is the outlier relative to the mean of the other two.
 */
function AgreementDiagnostic({
  ashrae,
  hunter,
  occupancy,
  occupancyProfile,
}: {
  ashrae: number;
  hunter: number;
  occupancy: number;
  occupancyProfile: "low" | "medium" | "high";
}) {
  const methods = [
    { key: "ashrae" as const, name: "ASHRAE", value: ashrae, color: "var(--accent-blue)" },
    { key: "hunter" as const, name: "Hunter/ASPE", value: hunter, color: "var(--accent-violet)" },
    { key: "occupancy" as const, name: "Occupancy", value: occupancy, color: "var(--accent-emerald)" },
  ];
  const valid = methods.filter((m) => m.value > 0);
  if (valid.length < 2) return null;

  const max = Math.max(...valid.map((m) => m.value));
  const min = Math.min(...valid.map((m) => m.value));
  const spread = (max - min) / min; // percent, as a fraction

  // Identify the outlier: method with the largest distance from the mean of the other two.
  const outlierScore = valid.map((m) => {
    const others = valid.filter((x) => x.key !== m.key);
    const othersMean = others.reduce((s, x) => s + x.value, 0) / others.length;
    return { ...m, distance: m.value - othersMean, distancePct: (m.value - othersMean) / othersMean };
  });
  outlierScore.sort((a, b) => Math.abs(b.distance) - Math.abs(a.distance));
  const outlier = outlierScore[0];
  const outlierHigh = outlier.distance > 0;

  if (spread < 0.15) {
    return (
      <Callout tone="ok">
        <strong>Methods agree within {Math.round(spread * 100)}%.</strong> Your building&rsquo;s
        assumptions are internally consistent — downstream sizing is reliable regardless of which
        method you pick as governing.
      </Callout>
    );
  }
  if (spread < 0.30) {
    return (
      <Callout tone="info">
        <strong>Methods spread by {Math.round(spread * 100)}%.</strong> Within the normal
        20–30% range — different methods capture different aspects of the building. No action
        needed.
      </Callout>
    );
  }

  // Spread ≥30% — give a targeted hint.
  const hint = diagnose(outlier.key, outlierHigh, occupancyProfile);
  return (
    <Callout tone="warn">
      <strong>Methods disagree by {Math.round(spread * 100)}%.</strong> The{" "}
      <span style={{ color: outlier.color, fontWeight: 700 }}>{outlier.name}</span> method is{" "}
      {outlierHigh ? "above" : "below"} the other two by{" "}
      {Math.abs(Math.round(outlier.distancePct * 100))}%.
      <div style={{ marginTop: 8 }}>
        <strong>Likely cause:</strong> {hint.cause}
      </div>
      <div style={{ marginTop: 4 }}>
        <strong>Fix:</strong> {hint.fix}
      </div>
    </Callout>
  );
}

function diagnose(
  method: "ashrae" | "hunter" | "occupancy",
  high: boolean,
  profile: "low" | "medium" | "high",
): { cause: string; fix: string } {
  if (method === "hunter" && high) {
    return {
      cause:
        "The default fixture mix may be too rich for this building — the Hunter calc assumes full lavs/kitchen/shower per unit plus tubs, dishwashers, and washers in 2-BR+ units.",
      fix: "If the building has studios, elderly housing, or lacks in-unit washers/dishwashers, the real WSFU is lower than default. Consider the ASHRAE or Occupancy result instead, or note the over-prediction in your narrative.",
    };
  }
  if (method === "hunter" && !high) {
    return {
      cause:
        "The default fixture mix may be under-specified — e.g. you have a luxury building with multiple showers/tubs per unit beyond the defaults.",
      fix: "Consider increasing unit sizes or assumed occupancy; Hunter is likely conservative here. ASHRAE or Occupancy may be more representative.",
    };
  }
  if (method === "ashrae" && high) {
    return {
      cause: `The "${profile}" occupancy profile may be too aggressive for this population. ASHRAE's "high" assumes family/luxury use.`,
      fix: profile === "high"
        ? 'Try "Medium (market-rate)" or "Low (elderly/efficiency)" on the Building tab.'
        : profile === "medium"
        ? 'If this is elderly housing or single-occupant studios, try "Low".'
        : "Verify the profile matches your actual tenant base.",
    };
  }
  if (method === "ashrae" && !high) {
    return {
      cause: `The "${profile}" occupancy profile may be under-predicting for this building.`,
      fix: profile === "low"
        ? 'If this is a market-rate or family building, try "Medium" or "High".'
        : profile === "medium"
        ? 'For luxury or family-heavy buildings, try "High".'
        : "Verify the profile; you may be under-selling demand.",
    };
  }
  if (method === "occupancy" && high) {
    return {
      cause:
        "Your gpcd or occupants-per-unit may be too high. Default 20 gpcd is the US residential average; luxury buildings hit 25–30, efficiency studios run 12–15.",
      fix: "Check occupants/unit on the Demand tab (defaults 1.5 / 2.5 / 3.5 for 1/2/3-BR are US-average) and GPCD. Reduce either one to match.",
    };
  }
  // occupancy low
  return {
    cause:
      "Your gpcd or occupants-per-unit may be too conservative. Some populations (families with kids, heavy-laundry households) run meaningfully higher than defaults.",
    fix: "Increase occupants/unit or GPCD. If you've metered a comparable building, back-calc the gpcd and enter it directly.",
  };
}

function Callout({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "ok" | "info" | "warn";
}) {
  const styles = {
    ok: { bg: "var(--accent-emerald-bg)", border: "var(--accent-emerald)" },
    info: { bg: "var(--accent-blue-bg)", border: "var(--accent-blue)" },
    warn: { bg: "var(--accent-amber-bg)", border: "var(--accent-amber)" },
  }[tone];
  return (
    <div
      style={{
        marginTop: 14,
        padding: "10px 14px",
        background: styles.bg,
        borderLeft: `3px solid ${styles.border}`,
        borderRadius: 8,
        fontSize: 12,
        color: "var(--text-primary)",
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

function MethodExplainer({ method }: { method: DemandMethod }) {
  const entries: { id: DemandMethod; title: string; when: string; strengths: string; weaknesses: string }[] = [
    {
      id: "ashrae",
      title: "ASHRAE Ch. 51 Table 7 — tabular per-apartment",
      when: "Default for multifamily. Published peak/day/avg GPH per apartment, stratified by occupancy profile.",
      strengths: "Fast, code-aligned, calibrated to measured building data.",
      weaknesses: "Blind to fixture mix and local fixture flow rates.",
    },
    {
      id: "hunter",
      title: "Hunter / ASPE Modified — fixture-unit probability",
      when: "Best when you know actual fixture counts and low-flow fixture specs.",
      strengths: "Transparent, exposes diversity assumption, sensitive to fixture detail.",
      weaknesses: "Sensitive to unit-mix assumptions; can over-predict for low-occupancy bldgs.",
    },
    {
      id: "occupancy",
      title: "Occupancy / gpcd — behavioral",
      when: "Useful for retrofits where you can meter a peer building and back-calc gpcd.",
      strengths: "Simple, directly behavioral.",
      weaknesses: "Ignores fixture mix; peak assumed at 25% of daily (ASHRAE Fundamentals typical).",
    },
  ];
  const active = entries.find((e) => e.id === method)!;
  return (
    <div
      style={{
        marginTop: 10,
        padding: "12px 14px",
        background: "var(--accent-blue-bg)",
        borderLeft: "3px solid var(--accent-blue)",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-blue)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Currently: {active.title}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 6, lineHeight: 1.6 }}>
        <div><strong>When to use:</strong> {active.when}</div>
        <div style={{ marginTop: 4 }}><strong>Strengths:</strong> {active.strengths}</div>
        <div style={{ marginTop: 4 }}><strong>Weaknesses:</strong> {active.weaknesses}</div>
      </div>
    </div>
  );
}

function MethodCard({
  name,
  method,
  governing,
  value,
  formula,
  accent,
  scaleWarning,
}: {
  name: string;
  method: DemandMethod;
  governing: DemandMethod;
  value: number;
  formula: string;
  accent: string;
  /** Optional scale-validity warning shown below the formula (e.g. Hunter < 10 apts). */
  scaleWarning?: string;
}) {
  const isGov = method === governing;
  return (
    <div
      className="ve-card"
      style={{
        borderLeft: `3px solid ${accent}`,
        outline: isGov ? `2px solid ${accent}` : "none",
        outlineOffset: -1,
        position: "relative",
      }}
    >
      {isGov && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 10,
            fontSize: 9,
            fontWeight: 700,
            background: accent,
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Governing
        </div>
      )}
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
        {name}
      </p>
      <p style={{ marginTop: 4, fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
        {fmt(value)}
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginLeft: 4 }}>GPH</span>
      </p>
      <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{formula}</div>
      {scaleWarning && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 10px",
            background: "rgba(245,158,11,0.10)",
            borderLeft: "2px solid var(--accent-amber)",
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.45,
            color: "var(--accent-amber)",
            fontWeight: 600,
          }}
        >
          ⚠ {scaleWarning}
        </div>
      )}
    </div>
  );
}

function WSFUTable() {
  const rows: Array<[string, number, number, number, number]> = [
    ["Bathroom sink", UNIT_FIXTURE_MIX.br0.lavatory, UNIT_FIXTURE_MIX.br1.lavatory, UNIT_FIXTURE_MIX.br2.lavatory, UNIT_FIXTURE_MIX.br3.lavatory],
    ["Kitchen sink", UNIT_FIXTURE_MIX.br0.kitchen, UNIT_FIXTURE_MIX.br1.kitchen, UNIT_FIXTURE_MIX.br2.kitchen, UNIT_FIXTURE_MIX.br3.kitchen],
    ["Shower", UNIT_FIXTURE_MIX.br0.shower, UNIT_FIXTURE_MIX.br1.shower, UNIT_FIXTURE_MIX.br2.shower, UNIT_FIXTURE_MIX.br3.shower],
    ["Tub", UNIT_FIXTURE_MIX.br0.tub, UNIT_FIXTURE_MIX.br1.tub, UNIT_FIXTURE_MIX.br2.tub, UNIT_FIXTURE_MIX.br3.tub],
    ["Dishwasher", UNIT_FIXTURE_MIX.br0.dishwasher, UNIT_FIXTURE_MIX.br1.dishwasher, UNIT_FIXTURE_MIX.br2.dishwasher, UNIT_FIXTURE_MIX.br3.dishwasher],
    ["Clothes washer", UNIT_FIXTURE_MIX.br0.washer, UNIT_FIXTURE_MIX.br1.washer, UNIT_FIXTURE_MIX.br2.washer, UNIT_FIXTURE_MIX.br3.washer],
  ];
  const fixtureWSFU: Record<string, number> = {
    "Bathroom sink": WSFU.lavatory,
    "Kitchen sink": WSFU.kitchen,
    "Shower": WSFU.shower,
    "Tub": WSFU.tub,
    "Dishwasher": WSFU.dishwasher,
    "Clothes washer": WSFU.washer,
  };
  return (
    <div style={{ overflowX: "auto", marginTop: 10 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        <thead>
          <tr>
            <th style={th}>Fixture</th>
            <th style={th}>WSFU (hot)</th>
            <th style={th}>Per Studio</th>
            <th style={th}>Per 1-BR</th>
            <th style={th}>Per 2-BR</th>
            <th style={th}>Per 3-BR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, s, a, b, c]) => (
            <tr key={name} style={{ borderBottom: "1px solid var(--border-light)" }}>
              <td style={td}>{name}</td>
              <td style={td}>{fixtureWSFU[name]}</td>
              <td style={td}>{s}</td>
              <td style={td}>{a}</td>
              <td style={td}>{b}</td>
              <td style={td}>{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DownstreamList({
  items,
}: {
  items: Array<{ formula: string; tab: string; purpose: string }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 12px",
            background: "#F8FAFC",
            borderLeft: "3px solid var(--accent-emerald)",
            borderRadius: 6,
          }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", flex: 1 }}>
            {it.formula}
          </div>
          <ArrowRight size={14} color="var(--accent-emerald)" />
          <div style={{ fontSize: 11, textAlign: "right" }}>
            <div style={{ fontWeight: 700, color: "var(--accent-emerald)" }}>{it.tab} tab</div>
            <div style={{ color: "var(--text-muted)" }}>{it.purpose}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// FixtureGPMEditor has moved to BuildingTab — fixture flow rates are now edited
// on the Building & System tab alongside unit mix and climate inputs. The
// WSFU breakdown + downstream formulas on this tab continue to use those flows.

// -----------------------------------------------------------------------------
// PRESENTATION PRIMITIVES
// -----------------------------------------------------------------------------

function Overview({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7 }}>{children}</div>
  );
}

function Prose({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, ...style }}>
      {children}
    </div>
  );
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

function MiniStat({
  label,
  value,
  sub,
  accent = "var(--border-light)",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "#F8FAFC",
        border: "1px solid var(--border-light)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ marginTop: 2, fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{sub}</div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 10px",
  background: "var(--accent-blue-bg)",
  color: "var(--accent-blue)",
  fontWeight: 700,
  borderBottom: "1px solid var(--border-light)",
};
const td: React.CSSProperties = {
  padding: "6px 10px",
  color: "var(--text-primary)",
};

function methodLabel(m: DemandMethod): string {
  return m === "ashrae" ? "ASHRAE Ch. 51 Table 7" : m === "hunter" ? "Hunter / ASPE Modified" : "Occupancy (gpcd)";
}
