"use client";

/**
 * LightingCalculator — multifamily lighting end-use modeler. Mirrors the
 * `DhwCalculator` shape:
 *   - Internal tab nav in a navy left sidebar
 *   - Each tab is a focused part of the calculator
 *   - Pure pipeline (`runCalc`) recomputes results on every input change
 *   - Save/load via the shared multi-domain Reports library
 *
 * Tabs:
 *   1. Equipment    — current-state input form (counts, watts, hours per category)
 *   2. Energy       — annual + monthly rollup, per-category breakdown
 *   3. Retrofit     — current-vs-proposed comparison with savings + payback
 *   4. Methodology  — sources + LPD compliance walkthrough
 */
import { useMemo, useState } from "react";
import {
  BarChart3,
  Book,
  Building2,
  Lightbulb,
  Sliders,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { runCalc } from "@/lib/lighting/pipeline";
import {
  DEFAULT_INPUTS,
  DEFAULT_LED_RETROFIT,
  LIGHTING_CATEGORIES,
  LIGHTING_CATEGORY_HINTS,
  LIGHTING_CATEGORY_LABELS,
  type LightingCategory,
  type LightingCategoryConfig,
  type LightingInputs,
} from "@/lib/lighting/inputs";
import type { LightingResult } from "@/lib/lighting/types";
import { useLightingInputs } from "@/hooks/useLightingInputs";
import { saveScenarios } from "@/lib/reports/storage";
import { ENGINE_VERSIONS } from "@/lib/version";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, NumberInput, SelectInput } from "@/components/ui/Field";
import { fmt, fmtUSD } from "@/lib/utils";
import { GRID_EF, MONTHS, MONTH_DAYS } from "@/lib/engineering/constants";
import { RetrofitComparison } from "@/components/RetrofitComparison";
import { type RetrofitMetrics } from "@/components/SavingsStrip";
import { MethodologyTab } from "@/components/tabs/lighting/MethodologyTab";
import { Callout } from "@/components/methodology/Helpers";
import { TopTabNav } from "@/components/TopTabNav";
import { LIGHTING_CATEGORY_COLORS as CATEGORY_COLORS } from "@/lib/chart-palette";

type TabId = "equipment" | "energy" | "retrofit" | "methodology";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: "equipment", label: "Equipment", icon: Sliders },
  { id: "energy", label: "Energy & cost", icon: BarChart3 },
  { id: "retrofit", label: "Retrofit comparison", icon: Wand2 },
  { id: "methodology", label: "Methodology", icon: Book },
];

// Sidebar removed; tabs now live in TopTabNav above the main content.

/** Pull the rollup metrics RetrofitComparison/SavingsStrip needs out of a
 *  LightingResult. Lighting is pure-electric so therms is always 0. */
function extractMetrics(result: LightingResult): RetrofitMetrics {
  return {
    kwh: result.annualKWh,
    therms: 0,
    cost: result.annualCost,
    carbon: result.annualCarbon,
  };
}

export default function LightingCalculator() {
  const { inputs, setInputs, update, updateCategory, reset } = useLightingInputs();
  const [tab, setTab] = useState<TabId>("equipment");

  const result = useMemo(() => runCalc(inputs), [inputs]);

  return (
    <div style={{ background: "var(--background)" }}>
      <TopTabNav<TabId>
        label={{
          icon: Lightbulb,
          text: "Lighting Calculator",
          iconColor: "var(--accent-amber)",
        }}
        tabs={TABS}
        active={tab}
        onSelect={setTab}
        trailing={
          <span>
            {fmt(result.annualKWh, 0)} kWh · {fmtUSD(result.annualCost, 0)}/yr ·{" "}
            {fmt(result.annualCarbon, 0)} lb CO₂
          </span>
        }
      />

      {/* MAIN CONTENT — full-width centered */}
      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "32px 32px 80px",
        }}
        className="animate-fade-in"
        key={tab}
      >
        {tab === "equipment" && (
          <EquipmentTab inputs={inputs} update={update} updateCategory={updateCategory} reset={reset} />
        )}
        {tab === "energy" && <EnergyTab result={result} />}
        {tab === "retrofit" && (
          <RetrofitTab
            currentInputs={inputs}
            onChangeCurrent={setInputs}
          />
        )}
        {tab === "methodology" && <MethodologyTab />}
      </main>
    </div>
  );
}

// ─── Equipment tab ─────────────────────────────────────────────────────────

function EquipmentTab({
  inputs,
  update,
  updateCategory,
  reset,
}: {
  inputs: LightingInputs;
  update: <K extends keyof LightingInputs>(key: K, value: LightingInputs[K]) => void;
  updateCategory: (
    category: LightingCategory,
    field: keyof LightingCategoryConfig,
    value: number,
  ) => void;
  reset: () => void;
}) {
  const gridOptions = Object.keys(GRID_EF).map((g) => ({ value: g, label: g }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
            Lighting equipment inventory
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0", maxWidth: 720, lineHeight: 1.6 }}>
            Configure each lighting category in your building. The defaults
            describe a typical 60-unit mid-rise with INCANDESCENT / fluorescent
            incumbent equipment — replace with your actual fixture inventory.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-light)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reset to defaults
        </button>
      </div>

      {/* Building context */}
      <Card>
        <CardHeader>
          <CardTitle>Building context</CardTitle>
        </CardHeader>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <Field label="Total building sqft" hint="Conditioned + non-conditioned interior area. Drives LPD calc.">
            <NumberInput
              value={inputs.totalBuildingSqft}
              onChange={(v) => update("totalBuildingSqft", v)}
              min={0}
              step={1000}
            />
          </Field>
          <Field label="Electric rate ($/kWh)" hint="Site rate including demand riders if applicable.">
            <NumberInput
              value={inputs.elecRate}
              onChange={(v) => update("elecRate", v)}
              min={0}
              step={0.01}
            />
          </Field>
          <Field label="Grid subregion" hint="EPA eGRID emission factor for carbon math.">
            <SelectInput
              value={inputs.gridSubregion}
              onChange={(v) => update("gridSubregion", v as typeof inputs.gridSubregion)}
              options={gridOptions}
            />
          </Field>
        </div>
      </Card>

      {/* How controls work — explains occupancy + daylight reductions */}
      <Card accent="var(--accent-blue)">
        <CardHeader>
          <CardTitle>How controls reduce energy</CardTitle>
        </CardHeader>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-primary)", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0 }}>
            The two control fields on each category — <strong>Occupancy
            reduction</strong> and <strong>Daylight credit</strong> — both
            shave hours off the nominal operating schedule. Each is a
            decimal between 0 and 1 representing the <em>fraction of base
            operating hours saved</em>:
          </p>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              background: "#F8FAFC",
              border: "1px solid var(--border-light)",
              borderLeft: "3px solid var(--accent-blue)",
              padding: "8px 12px",
              borderRadius: 6,
              whiteSpace: "pre-wrap",
            }}
          >{`effectiveHours = hoursPerDay × 365
                 × (1 − occupancyReduction)
                 × (1 − daylightCredit)`}</div>
          <p style={{ margin: 0 }}>
            <strong>Occupancy reduction</strong> models occupancy / vacancy
            sensors that dim or shut off fixtures when no one is present.
            Field-measured savings (per ACEEE + utility-program data) are
            typically:
          </p>
          <ul style={{ margin: "0 0 0 20px", lineHeight: 1.65 }}>
            <li><strong>0.30</strong> in corridors (≈ 30% of hours saved — partial dim during low-traffic periods)</li>
            <li><strong>0.40–0.60</strong> in stairwells (bi-level w/ step-dim required by ASHRAE 90.1 §9.4.1.1.e)</li>
            <li><strong>0.30–0.50</strong> in common areas like lobbies, mail rooms, gyms</li>
            <li><strong>0.40–0.60</strong> in garage / parking decks (bi-level w/ photocell + occupancy)</li>
            <li><strong>0</strong> on exterior site fixtures (always-on dusk-to-dawn — controls don&apos;t apply)</li>
            <li><strong>0</strong> in-unit (occupant-driven; no central control)</li>
          </ul>
          <p style={{ margin: 0 }}>
            <strong>Daylight credit</strong> models daylight harvesting
            (photocells dimming fixtures when sufficient daylight is
            present). Only set this if the daylight reduction is{" "}
            <em>not already</em> baked into your hours-per-day. Most
            exterior schedules are already daylight-aware (12 hr/day
            implies dusk-to-dawn), so leave at <strong>0</strong> unless
            you have separate daylight sensors on perimeter common-area
            fixtures or skylights in garages.
          </p>
          <Callout tone="warn">
            <strong>Multiplicative, not additive.</strong> A 30% occupancy
            reduction combined with a 20% daylight credit yields{" "}
            <strong>(1 − 0.30) × (1 − 0.20) = 0.56</strong> — i.e. 44%
            combined savings, not 50%. This avoids double-counting hours
            where both controls are active simultaneously, matching IES +
            ASHRAE 90.1 §G3.1 conventions.
          </Callout>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
            Defaults below leave both reductions at <strong>0</strong>{" "}
            (incumbent baseline with no controls). Apply the LED retrofit
            preset on the Retrofit Comparison tab to see code-compliant
            control values populated automatically.
          </p>
        </div>
      </Card>

      {/* Per-category configuration */}
      {LIGHTING_CATEGORIES.map((cat) => (
        <CategoryCard
          key={cat}
          category={cat}
          config={inputs.categories[cat]}
          onChange={(field, value) => updateCategory(cat, field, value)}
        />
      ))}
    </div>
  );
}

function CategoryCard({
  category,
  config,
  onChange,
}: {
  category: LightingCategory;
  config: LightingCategoryConfig;
  onChange: (field: keyof LightingCategoryConfig, value: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{LIGHTING_CATEGORY_LABELS[category]}</CardTitle>
        <p
          style={{
            fontSize: 11.5,
            color: "var(--text-muted)",
            margin: "4px 0 0",
            lineHeight: 1.5,
          }}
        >
          {LIGHTING_CATEGORY_HINTS[category]}
        </p>
      </CardHeader>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        <Field label="Fixture count" hint="Total fixtures across the entire building (not per-floor).">
          <NumberInput value={config.count} onChange={(v) => onChange("count", v)} min={0} step={1} />
        </Field>
        <Field
          label="Watts per fixture"
          hint="Input wattage at the meter (includes driver / ballast). Use nameplate W, not lamp-only."
        >
          <NumberInput
            value={config.wattsPerFixture}
            onChange={(v) => onChange("wattsPerFixture", v)}
            min={0}
            step={1}
          />
        </Field>
        <Field
          label="Hours per day"
          hint="Operating hours BEFORE controls. 24 = always-on; 12 = dusk-to-dawn."
        >
          <NumberInput
            value={config.hoursPerDay}
            onChange={(v) => onChange("hoursPerDay", v)}
            min={0}
            max={24}
            step={0.5}
          />
        </Field>
        <Field
          label="Occupancy reduction (0–1)"
          hint="Fraction of hours saved by occupancy / vacancy sensors. 0 = no controls; 0.30 = 30% saved."
        >
          <NumberInput
            value={config.occupancySensorReduction}
            onChange={(v) => onChange("occupancySensorReduction", v)}
            min={0}
            max={1}
            step={0.05}
          />
        </Field>
        <Field
          label="Daylight credit (0–1)"
          hint="Extra fraction saved by daylight harvesting. Leave 0 if your hours/day already reflects photocell."
        >
          <NumberInput
            value={config.daylightCredit}
            onChange={(v) => onChange("daylightCredit", v)}
            min={0}
            max={1}
            step={0.05}
          />
        </Field>
      </div>
    </Card>
  );
}

// ─── Energy tab ────────────────────────────────────────────────────────────

/** Build the per-category monthly data the recharts BarChart expects. Each
 *  row is `{ month, [categoryKey]: kWh, ... }`. Lighting load is uniform
 *  across the year, so each month gets `daysInMonth / 365` of each
 *  category's annual kWh — December (31 days) is the tallest bar by ~10%
 *  vs February (28 days). */
function buildMonthlyCategoryData(result: LightingResult) {
  return MONTHS.map((monthName, m) => {
    const dayShare = MONTH_DAYS[m] / 365;
    const row: Record<string, string | number> = { month: monthName };
    for (const cat of result.categories) {
      row[cat.category] = +(cat.annualKWh * dayShare).toFixed(1);
    }
    row._totalCost = +(result.annualCost * dayShare).toFixed(0);
    row._totalCarbon = +(result.annualCarbon * dayShare).toFixed(0);
    return row;
  });
}

/** Custom tooltip that shows per-category kWh + the month's total cost +
 *  carbon, since the stacked bars only encode kWh visually. */
function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: Record<string, number | string> }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((s, p) => s + (typeof p.value === "number" ? p.value : 0), 0);
  const costRaw = payload[0]?.payload?._totalCost;
  const carbonRaw = payload[0]?.payload?._totalCarbon;
  const monthCost = typeof costRaw === "number" ? costRaw : 0;
  const monthCarbon = typeof carbonRaw === "number" ? carbonRaw : 0;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border-light)",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload
        .slice()
        .reverse() // top-to-bottom matches the stack
        .filter((p) => typeof p.value === "number" && p.value > 0)
        .map((p) => (
          <div
            key={p.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 2,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: p.color,
                  display: "inline-block",
                }}
              />
              {p.name}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              {fmt(p.value as number, 0)} kWh
            </span>
          </div>
        ))}
      <div
        style={{
          borderTop: "1px solid var(--border-light)",
          marginTop: 6,
          paddingTop: 6,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Total</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmt(total, 0)} kWh
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "var(--text-secondary)",
            fontWeight: 500,
          }}
        >
          <span>Cost / Carbon</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtUSD(monthCost, 0)} · {fmt(monthCarbon, 0)} lb
          </span>
        </div>
      </div>
    </div>
  );
}

function EnergyTab({ result }: { result: LightingResult }) {
  // Build chart data once per render — recharts is stateless and the
  // monthly values are derived from `result` directly.
  const monthlyData = useMemo(() => buildMonthlyCategoryData(result), [result]);

  // Categories present in the result with non-zero contribution — chart
  // hides the others so the legend stays clean (e.g., garage/parking when
  // count is 0).
  const visibleCategories = result.categories.filter((c) => c.annualKWh > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
        Annual energy &amp; cost
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <MetricBig label="Annual electricity" value={`${fmt(result.annualKWh, 0)} kWh`} />
        <MetricBig label="Annual cost" value={fmtUSD(result.annualCost, 0)} />
        <MetricBig label="Annual carbon" value={`${fmt(result.annualCarbon, 0)} lb CO₂e`} />
        <MetricBig label="LPD (W/ft²)" value={result.lpdWattsPerSqft.toFixed(2)} />
        <MetricBig label="Total connected W" value={fmt(result.totalConnectedWatts, 0)} />
      </div>

      {/* Monthly breakdown — stacked bar by category */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly energy by category (kWh)</CardTitle>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0", lineHeight: 1.5 }}>
            Lighting load is climate-insensitive — each month&apos;s share is
            its day-count fraction of the annual total ({"≈ daysInMonth / 365"}).
            December (31 days) is ~10% taller than February (28 days). The
            stack shows which category dominates the load.
          </p>
        </CardHeader>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EF" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6B7280" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#6B7280"
                label={{
                  value: "kWh",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: "#6B7280" },
                }}
              />
              <Tooltip wrapperStyle={{ fontSize: 12 }} content={<MonthlyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
              {visibleCategories.map((cat) => (
                <Bar
                  key={cat.category}
                  dataKey={cat.category}
                  name={LIGHTING_CATEGORY_LABELS[cat.category]}
                  fill={CATEGORY_COLORS[cat.category]}
                  stackId="e"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--accent-blue-bg)", color: "var(--text-secondary)" }}>
                <th style={th}>Category</th>
                <th style={thNum}>Connected W</th>
                <th style={thNum}>Annual hr</th>
                <th style={thNum}>kWh/yr</th>
                <th style={thNum}>$/yr</th>
                <th style={thNum}>lb CO₂/yr</th>
              </tr>
            </thead>
            <tbody>
              {result.categories.map((c) => (
                <tr key={c.category} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={td}>{LIGHTING_CATEGORY_LABELS[c.category]}</td>
                  <td style={tdNum}>{fmt(c.connectedWatts, 0)}</td>
                  <td style={tdNum}>{fmt(c.annualHours, 0)}</td>
                  <td style={tdNum}>{fmt(c.annualKWh, 0)}</td>
                  <td style={tdNum}>{fmtUSD(c.annualCost, 0)}</td>
                  <td style={tdNum}>{fmt(c.annualCarbon, 0)}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--accent-blue-bg)", fontWeight: 700 }}>
                <td style={td}>Total</td>
                <td style={tdNum}>{fmt(result.totalConnectedWatts, 0)}</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>{fmt(result.annualKWh, 0)}</td>
                <td style={tdNum}>{fmtUSD(result.annualCost, 0)}</td>
                <td style={tdNum}>{fmt(result.annualCarbon, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {result.flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Flags &amp; advisories</CardTitle>
          </CardHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.flags.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor:
                    f.level === "error"
                      ? "var(--accent-red)"
                      : f.level === "warn"
                      ? "var(--accent-amber)"
                      : f.level === "ok"
                      ? "var(--accent-emerald)"
                      : "var(--border-light)",
                  background:
                    f.level === "error"
                      ? "var(--accent-red-bg)"
                      : f.level === "warn"
                      ? "var(--accent-amber-bg)"
                      : f.level === "ok"
                      ? "var(--accent-emerald-bg)"
                      : "var(--surface-subtle, rgba(0,0,0,0.02))",
                  fontSize: 12.5,
                  lineHeight: 1.55,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>
                  {f.code}
                </div>
                <div style={{ marginTop: 4, color: "var(--text-primary)" }}>{f.msg}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 700,
  borderBottom: "1px solid var(--border-light)",
};
const thNum: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "8px 10px", color: "var(--text-primary)" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function MetricBig({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        background: "var(--card-bg, #fff)",
        border: "1px solid var(--border-light)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

// ─── Retrofit tab ──────────────────────────────────────────────────────────

function RetrofitTab({
  currentInputs,
  onChangeCurrent,
}: {
  currentInputs: LightingInputs;
  onChangeCurrent: (next: LightingInputs) => void;
}) {
  // Proposed inputs are local to this tab — they don't write to the same
  // localStorage key as the Equipment-tab inputs. That way the user can
  // experiment with multiple proposed scenarios without losing their
  // current-state baseline.
  const [proposedInputs, setProposedInputs] = useState<LightingInputs>(DEFAULT_LED_RETROFIT);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
        Current vs proposed retrofit
      </h1>
      <RetrofitComparison<LightingInputs, LightingResult>
        currentInputs={currentInputs}
        proposedInputs={proposedInputs}
        onChangeCurrent={onChangeCurrent}
        onChangeProposed={setProposedInputs}
        runCalc={runCalc}
        extractMetrics={extractMetrics}
        proposedPreset={{ label: "Apply LED + sensors", inputs: DEFAULT_LED_RETROFIT }}
        renderInputs={(inputs, onChange) => (
          <CompactInputs inputs={inputs} onChange={onChange} />
        )}
        onSave={(name, scenarios) => {
          saveScenarios(name, "lighting", scenarios);
        }}
      />
      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Engine v{ENGINE_VERSIONS.lighting} · saved retrofits appear in the
        Reports library tagged with the lighting domain.
      </div>
    </div>
  );
}

/** Compact input form used inside the retrofit tab — same fields as the
 *  Equipment tab but tighter (one row per category) so the two columns
 *  fit side-by-side without scrolling. */
function CompactInputs({
  inputs,
  onChange,
}: {
  inputs: LightingInputs;
  onChange: (next: LightingInputs) => void;
}) {
  function patchCategory(
    cat: LightingCategory,
    field: keyof LightingCategoryConfig,
    value: number,
  ) {
    onChange({
      ...inputs,
      categories: {
        ...inputs.categories,
        [cat]: { ...inputs.categories[cat], [field]: value },
      },
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {LIGHTING_CATEGORIES.map((cat) => {
        const c = inputs.categories[cat];
        return (
          <div
            key={cat}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr repeat(4, 1fr)",
              gap: 6,
              alignItems: "center",
              padding: "6px 4px",
              borderBottom: "1px dashed var(--border-light)",
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)" }}>
              {LIGHTING_CATEGORY_LABELS[cat]}
            </div>
            <CompactNumber
              label="N"
              value={c.count}
              onChange={(v) => patchCategory(cat, "count", v)}
              step={1}
            />
            <CompactNumber
              label="W"
              value={c.wattsPerFixture}
              onChange={(v) => patchCategory(cat, "wattsPerFixture", v)}
              step={1}
            />
            <CompactNumber
              label="hr/d"
              value={c.hoursPerDay}
              onChange={(v) => patchCategory(cat, "hoursPerDay", v)}
              step={0.5}
              max={24}
            />
            <CompactNumber
              label="occ"
              value={c.occupancySensorReduction}
              onChange={(v) => patchCategory(cat, "occupancySensorReduction", v)}
              step={0.05}
              max={1}
            />
          </div>
        );
      })}
    </div>
  );
}

function CompactNumber({
  label,
  value,
  onChange,
  step,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
        {label}
      </span>
      <input
        type="number"
        className="ve-input"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        min={min}
        max={max}
        style={{ flex: 1, padding: "4px 6px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}
      />
    </div>
  );
}

// MethodologyTab moved to its own file (`src/components/tabs/lighting/
// MethodologyTab.tsx`) so the long-form reference content has room to
// grow without bloating this calculator shell file.
