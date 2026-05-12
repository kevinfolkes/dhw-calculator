"use client";

/**
 * InUnitHvacCalculator — multifamily in-unit HVAC end-use modeler. Mirrors
 * the `LightingCalculator` shape (TopTabNav + tab content), with engineering
 * adapted for per-apartment cooling + heating equipment.
 *
 * Tabs:
 *   1. Equipment    — current-state input form (system type, climate, per-apt specs)
 *   2. Energy       — annual + monthly rollup, cooling vs heating split chart
 *   3. Retrofit     — current-vs-proposed comparison with HP + CCHP presets
 *   4. Methodology  — sources + EFLH math walkthrough (long-form, separate file)
 */
import { useMemo, useState } from "react";
import {
  AirVent,
  BarChart3,
  Book,
  LayoutGrid,
  RotateCcw,
  Sigma,
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
import { runCalc } from "@/lib/inunit-hvac/pipeline";
import {
  DEFAULT_HP_RETROFIT,
  DEFAULT_CCHP_RETROFIT,
  DEFAULT_CENTRAL_HP_RETROFIT,
  INUNIT_HVAC_SYSTEM_SPECS,
  type CoolingEffMetric,
  type HeatingEffMetric,
  type InUnitHvacInputs,
  type InUnitHvacSystemType,
} from "@/lib/inunit-hvac/inputs";
import type { InUnitHvacResult } from "@/lib/inunit-hvac/types";
import { useInUnitHvacInputs } from "@/hooks/useInUnitHvacInputs";
import { saveScenarios } from "@/lib/reports/storage";
import { ENGINE_VERSIONS } from "@/lib/version";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, NumberInput, SelectInput } from "@/components/ui/Field";
import { fmt, fmtUSD } from "@/lib/utils";
import { CLIMATE_DESIGN, GRID_EF } from "@/lib/engineering/constants";
import { COOLING_EFLH_BY_CZ, HEATING_EFLH_BY_CZ } from "@/lib/inunit-hvac/pipeline";
import { RetrofitComparison } from "@/components/RetrofitComparison";
import { type RetrofitMetrics } from "@/components/SavingsStrip";
import { MethodologyTab } from "@/components/tabs/inunit-hvac/MethodologyTab";
import { OverviewTab } from "@/components/tabs/inunit-hvac/OverviewTab";
import { CalculationsTab } from "@/components/tabs/inunit-hvac/CalculationsTab";
import { Callout } from "@/components/methodology/Helpers";
import { TopTabNav } from "@/components/TopTabNav";

/** Cooling = cool tone, heating = warm tone. Toned to fit the editorial
 *  palette so the chart reads as part of the page rather than a dashboard
 *  widget grafted on. */
const ENDUSE_COLORS: Record<"cooling" | "heating", string> = {
  cooling: "#1E3A5F", // brand navy
  heating: "#B45309", // ochre / amber
};

type TabId =
  | "overview"
  | "equipment"
  | "energy"
  | "retrofit"
  | "calculations"
  | "methodology";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

// Tab order mirrors the DHW calculator: Overview → input tabs → energy →
// calculations → methodology. Overview is the landing page (system-type
// picker + how-to); Calculations is the step-by-step worked example that
// substitutes current inputs into every formula the engine runs.
const TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "equipment", label: "Equipment", icon: Sliders },
  { id: "energy", label: "Energy & cost", icon: BarChart3 },
  { id: "retrofit", label: "Retrofit comparison", icon: Wand2 },
  { id: "calculations", label: "Calculations", icon: Sigma },
  { id: "methodology", label: "Methodology", icon: Book },
];

/** Pull the rollup metrics RetrofitComparison/SavingsStrip needs out of an
 *  InUnitHvacResult. In-unit HVAC is pure-electric so therms is always 0. */
function extractMetrics(result: InUnitHvacResult): RetrofitMetrics {
  return {
    kwh: result.totalAnnualKWh,
    therms: 0,
    cost: result.totalAnnualCost,
    carbon: result.totalAnnualCarbon,
  };
}

export default function InUnitHvacCalculator() {
  const { inputs, setInputs, update, switchSystemType, reset } = useInUnitHvacInputs();
  const [tab, setTab] = useState<TabId>("overview");

  const result = useMemo(() => runCalc(inputs), [inputs]);

  return (
    <div style={{ background: "var(--background)" }}>
      <TopTabNav<TabId>
        label={{
          icon: AirVent,
          text: "In-unit HVAC Calculator",
          iconColor: "var(--accent-blue)",
        }}
        tabs={TABS}
        active={tab}
        onSelect={setTab}
        trailing={
          <span>
            {fmt(result.totalAnnualKWh, 0)} kWh · {fmtUSD(result.totalAnnualCost, 0)}/yr ·{" "}
            {fmt(result.totalAnnualCarbon, 0)} lb CO₂
          </span>
        }
      />

      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "32px 32px 80px",
        }}
        className="animate-fade-in"
        key={tab}
      >
        {tab === "overview" && (
          <OverviewTab inputs={inputs} switchSystemType={switchSystemType} />
        )}
        {tab === "equipment" && (
          <EquipmentTab
            inputs={inputs}
            update={update}
            switchSystemType={switchSystemType}
            reset={reset}
          />
        )}
        {tab === "energy" && <EnergyTab inputs={inputs} result={result} />}
        {tab === "retrofit" && (
          <RetrofitTab currentInputs={inputs} onChangeCurrent={setInputs} />
        )}
        {tab === "calculations" && <CalculationsTab inputs={inputs} result={result} />}
        {tab === "methodology" && <MethodologyTab />}
      </main>
    </div>
  );
}

// ─── Equipment tab ─────────────────────────────────────────────────────────

function EquipmentTab({
  inputs,
  update,
  switchSystemType,
  reset,
}: {
  inputs: InUnitHvacInputs;
  update: <K extends keyof InUnitHvacInputs>(key: K, value: InUnitHvacInputs[K]) => void;
  switchSystemType: (s: InUnitHvacSystemType) => void;
  reset: () => void;
}) {
  const climateOptions = Object.keys(CLIMATE_DESIGN).map((k) => ({ value: k, label: k }));
  const gridOptions = Object.keys(GRID_EF).map((g) => ({ value: g, label: g }));
  const systemOptions = (Object.keys(INUNIT_HVAC_SYSTEM_SPECS) as InUnitHvacSystemType[]).map(
    (k) => ({ value: k, label: INUNIT_HVAC_SYSTEM_SPECS[k].label }),
  );

  const spec = INUNIT_HVAC_SYSTEM_SPECS[inputs.systemType];

  // Cooling metric options depend on system type — PTAC/PTHP/window AC are
  // EER-rated; mini-splits are SEER2-rated.
  const coolingMetricOptions: Array<{ value: CoolingEffMetric; label: string }> = [
    { value: "SEER2", label: "SEER2 (BTU/Wh, seasonal)" },
    { value: "EER", label: "EER (BTU/Wh, steady-state)" },
  ];

  const heatingMetricOptions: Array<{ value: HeatingEffMetric; label: string }> = [
    { value: "HSPF2", label: "HSPF2 (BTU/Wh, seasonal HP)" },
    { value: "COP", label: "COP (dimensionless HP)" },
    { value: "resistance", label: "Resistance (COP 1.0)" },
  ];

  // Default EFLH lookup — surfaced as helper text below the override fields.
  const defaultCoolingEflh = COOLING_EFLH_BY_CZ[inputs.climateZone] ?? 1000;
  const defaultHeatingEflh = HEATING_EFLH_BY_CZ[inputs.climateZone] ?? 1500;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
            In-unit HVAC equipment
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              margin: "4px 0 0",
              maxWidth: 720,
              lineHeight: 1.6,
            }}
          >
            Configure the per-apartment cooling and heating equipment installed
            in each unit. Defaults describe a typical 60-unit mid-rise running
            <strong> PTAC + electric resistance heat</strong> in CZ4A (NYC) —
            the most common pre-retrofit baseline in U.S. multifamily housing
            built between 1970 and 2010.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
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
          <RotateCcw size={11} />
          Reset to defaults
        </button>
      </div>

      {/* Building context */}
      <Card>
        <CardHeader>
          <CardTitle>Building &amp; climate</CardTitle>
        </CardHeader>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <Field
            label="Apartment count"
            hint="Number of units sharing this equipment spec. Whole-building rollup multiplies through."
          >
            <NumberInput
              value={inputs.apartmentCount}
              onChange={(v) => update("apartmentCount", v)}
              min={1}
              step={1}
            />
          </Field>
          <Field label="Climate zone" hint="Drives cooling/heating EFLH lookup.">
            <SelectInput
              value={inputs.climateZone}
              onChange={(v) => update("climateZone", v as typeof inputs.climateZone)}
              options={climateOptions}
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

      {/* Why per-apt sizing — explains the multifamily abstraction */}
      <Card accent="var(--accent-blue)">
        <CardHeader>
          <CardTitle>How in-unit HVAC differs from central plants</CardTitle>
        </CardHeader>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-primary)", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0 }}>
            Each apartment runs its <strong>own</strong> cooling and heating
            equipment. The whole-building load = per-apartment load ×{" "}
            <strong>apartment count</strong>. This calculator assumes every
            apartment shares the same equipment spec — typical in MF buildings
            where developers fit out every unit identically. For
            mixed-equipment buildings (e.g., legacy PTACs in some units, mini-
            split retrofits in others), run the calc twice and add the
            rollups, or split the proposed retrofit into phases.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Per-apartment loads</strong> are typically:
          </p>
          <ul style={{ margin: "0 0 0 20px", lineHeight: 1.65 }}>
            <li>Studio / 1BR (≤ 600 sf): cooling 6–9k BTU/h, heating 9–12k BTU/h</li>
            <li>2BR (~900 sf): cooling 9–12k BTU/h, heating 12–18k BTU/h</li>
            <li>3BR (~1200 sf): cooling 12–18k BTU/h, heating 18–24k BTU/h</li>
            <li>Open-plan / luxury (1500+ sf): up to 24k BTU/h per apartment</li>
          </ul>
          <p style={{ margin: 0 }}>
            For accurate sizing run a Manual J calc for each unit type. The
            climate-zone EFLH lookup handles seasonal weighting; you don&apos;t
            need to enter monthly profile data unless you have metered hours.
          </p>
        </div>
      </Card>

      {/* System type selector */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment archetype</CardTitle>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "4px 0 0", lineHeight: 1.5 }}>
            Picks the per-apt cooling + heating combo. Switching archetypes
            replaces capacity / efficiency / metric defaults with the values
            typical for that combo.
          </p>
        </CardHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="System archetype" hint={spec.reference}>
            <SelectInput
              value={inputs.systemType}
              onChange={(v) => switchSystemType(v as InUnitHvacSystemType)}
              options={systemOptions}
            />
          </Field>
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              margin: 0,
              padding: "10px 12px",
              borderRadius: 6,
              background: "var(--surface-subtle, #F8FAFC)",
              border: "1px solid var(--border-light)",
            }}
          >
            {spec.description}
          </p>
        </div>
      </Card>

      {/* Cooling spec */}
      <Card>
        <CardHeader>
          <CardTitle>Cooling — per apartment</CardTitle>
        </CardHeader>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          <Field
            label="Cooling capacity (BTU/h)"
            hint="Per-apt design capacity at AHRI rating point. 12k = 1 ton refrigeration."
          >
            <NumberInput
              value={inputs.coolingCapacityBtuh}
              onChange={(v) => update("coolingCapacityBtuh", v)}
              min={0}
              step={500}
            />
          </Field>
          <Field
            label="Cooling efficiency"
            hint={
              inputs.coolingEfficiencyMetric === "SEER2"
                ? "Seasonal BTU/Wh — 14 = federal min, 16 = ENERGY STAR, 22+ = premium"
                : "Steady-state BTU/Wh — 9.5 = PTAC code min, 11 = high-eff PTHP"
            }
          >
            <NumberInput
              value={inputs.coolingEfficiency}
              onChange={(v) => update("coolingEfficiency", v)}
              min={0}
              step={0.5}
            />
          </Field>
          <Field label="Metric" hint="SEER2 for split / mini-split, EER for PTAC / window AC.">
            <SelectInput
              value={inputs.coolingEfficiencyMetric}
              onChange={(v) =>
                update("coolingEfficiencyMetric", v as CoolingEffMetric)
              }
              options={coolingMetricOptions}
            />
          </Field>
          <Field
            label={`Cooling EFLH override (default ${defaultCoolingEflh})`}
            hint="0 = use climate-zone default. Override only if you have metered data."
          >
            <NumberInput
              value={inputs.coolingEflhOverride}
              onChange={(v) => update("coolingEflhOverride", v)}
              min={0}
              max={5000}
              step={50}
            />
          </Field>
        </div>
      </Card>

      {/* Heating spec */}
      <Card>
        <CardHeader>
          <CardTitle>Heating — per apartment</CardTitle>
        </CardHeader>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          <Field
            label="Heating capacity (BTU/h)"
            hint="Per-apt design heating output. For HPs, this is the AHRI 47°F rating."
          >
            <NumberInput
              value={inputs.heatingCapacityBtuh}
              onChange={(v) => update("heatingCapacityBtuh", v)}
              min={0}
              step={500}
            />
          </Field>
          <Field
            label="Heating efficiency"
            hint={
              inputs.heatingEfficiencyMetric === "HSPF2"
                ? "Seasonal BTU/Wh — 8.5 = ENERGY STAR, 10+ = NEEP cold-climate"
                : inputs.heatingEfficiencyMetric === "COP"
                ? "Dimensionless output/input — 3.0 = PTHP code min, 4.0 = premium"
                : "Resistance (always treated as COP 1.0)"
            }
          >
            <NumberInput
              value={inputs.heatingEfficiency}
              onChange={(v) => update("heatingEfficiency", v)}
              min={0}
              step={0.1}
            />
          </Field>
          <Field
            label="Metric"
            hint="HSPF2 for mini-split, COP for PTHP, resistance for baseboards."
          >
            <SelectInput
              value={inputs.heatingEfficiencyMetric}
              onChange={(v) =>
                update("heatingEfficiencyMetric", v as HeatingEffMetric)
              }
              options={heatingMetricOptions}
            />
          </Field>
          <Field
            label={`Heating EFLH override (default ${defaultHeatingEflh})`}
            hint="0 = use climate-zone default. Override only if you have metered data."
          >
            <NumberInput
              value={inputs.heatingEflhOverride}
              onChange={(v) => update("heatingEflhOverride", v)}
              min={0}
              max={6000}
              step={50}
            />
          </Field>
        </div>
        <Callout tone="info">
          <strong>Heat pumps in cold climates.</strong> The HSPF2 rating
          assumes DOE Region IV (moderate climate, ~46°F average winter
          ambient). In CZ5+ a standard HSPF2 8.5 mini-split loses ~50% of its
          capacity at 5°F and drops to an effective seasonal COP near 1.5.
          Use a NEEP-listed cold-climate HP (HSPF2 ≥ 10.0, capacity retention
          ≥ 70% at 5°F) — pick &quot;Cold-climate ductless heat pump&quot; in
          the system selector.
        </Callout>
      </Card>
    </div>
  );
}

// ─── Energy tab ────────────────────────────────────────────────────────────

/** Build the per-end-use monthly data the recharts BarChart expects.
 *  Each row is `{ month, cooling: kWh, heating: kWh }`. */
function buildMonthlyEnduseData(result: InUnitHvacResult) {
  return result.monthly.monthly.map((m) => ({
    month: m.month,
    cooling: +m.coolingKWh.toFixed(0),
    heating: +m.heatingKWh.toFixed(0),
    _totalCost: +m.totalCost.toFixed(0),
    _totalCarbon: +m.totalCarbon.toFixed(0),
  }));
}

/** Custom tooltip that shows per-end-use kWh + the month's total cost +
 *  carbon, since the stacked bars only encode kWh visually. */
function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: Record<string, number | string>;
  }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce(
    (s, p) => s + (typeof p.value === "number" ? p.value : 0),
    0,
  );
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
        .reverse()
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

function EnergyTab({
  inputs,
  result,
}: {
  inputs: InUnitHvacInputs;
  result: InUnitHvacResult;
}) {
  const monthlyData = useMemo(() => buildMonthlyEnduseData(result), [result]);
  const showCooling = result.cooling.buildingKWh > 0;
  const showHeating = result.heating.buildingKWh > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
        Annual energy &amp; cost
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <MetricBig
          label="Annual electricity"
          value={`${fmt(result.totalAnnualKWh, 0)} kWh`}
        />
        <MetricBig label="Annual cost" value={fmtUSD(result.totalAnnualCost, 0)} />
        <MetricBig
          label="Annual carbon"
          value={`${fmt(result.totalAnnualCarbon, 0)} lb CO₂e`}
        />
        <MetricBig
          label="Connected cooling"
          value={`${result.totalConnectedTons.toFixed(1)} tons`}
        />
        <MetricBig label="Apartments" value={fmt(result.apartmentCount, 0)} />
      </div>

      {/* Monthly stacked chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly energy by end-use (kWh)</CardTitle>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              margin: "4px 0 0",
              lineHeight: 1.5,
            }}
          >
            Cooling kWh distributes across the year by climate-zone CDD share
            (peaks Jul/Aug); heating kWh by HDD share (peaks Dec/Jan). The
            shape changes dramatically by climate — try Miami vs Minneapolis
            to see.
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
              {showCooling && (
                <Bar dataKey="cooling" name="Cooling" fill={ENDUSE_COLORS.cooling} stackId="e" />
              )}
              {showHeating && (
                <Bar dataKey="heating" name="Heating" fill={ENDUSE_COLORS.heating} stackId="e" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-end-use breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>By end-use</CardTitle>
        </CardHeader>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--accent-blue-bg)", color: "var(--text-secondary)" }}>
                <th style={th}>End-use</th>
                <th style={thNum}>Capacity (BTU/h)</th>
                <th style={thNum}>EFLH (hr/yr)</th>
                <th style={thNum}>Eff (rated)</th>
                <th style={thNum}>Eff COP</th>
                <th style={thNum}>kWh/apt</th>
                <th style={thNum}>kWh/yr</th>
                <th style={thNum}>$/yr</th>
                <th style={thNum}>lb CO₂/yr</th>
              </tr>
            </thead>
            <tbody>
              <EndUseRow
                label="Cooling"
                metricLabel={inputs.coolingEfficiencyMetric}
                row={result.cooling}
              />
              <EndUseRow
                label="Heating"
                metricLabel={inputs.heatingEfficiencyMetric}
                row={result.heating}
              />
              <tr style={{ background: "var(--accent-blue-bg)", fontWeight: 700 }}>
                <td style={td}>Total</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>
                  {fmt(
                    (result.cooling.perAptKWh ?? 0) + (result.heating.perAptKWh ?? 0),
                    0,
                  )}
                </td>
                <td style={tdNum}>{fmt(result.totalAnnualKWh, 0)}</td>
                <td style={tdNum}>{fmtUSD(result.totalAnnualCost, 0)}</td>
                <td style={tdNum}>{fmt(result.totalAnnualCarbon, 0)}</td>
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

function EndUseRow({
  label,
  metricLabel,
  row,
}: {
  label: string;
  metricLabel: string;
  row: InUnitHvacResult["cooling"];
}) {
  return (
    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
      <td style={td}>{label}</td>
      <td style={tdNum}>{fmt(row.capacityBtuh, 0)}</td>
      <td style={tdNum}>{fmt(row.eflhHours, 0)}</td>
      <td style={tdNum}>
        {row.ratedEfficiency.toFixed(1)} <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{metricLabel}</span>
      </td>
      <td style={tdNum}>{row.effectiveCOP.toFixed(2)}</td>
      <td style={tdNum}>{fmt(row.perAptKWh, 0)}</td>
      <td style={tdNum}>{fmt(row.buildingKWh, 0)}</td>
      <td style={tdNum}>{fmtUSD(row.buildingCost, 0)}</td>
      <td style={tdNum}>{fmt(row.buildingCarbon, 0)}</td>
    </tr>
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
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Retrofit tab ──────────────────────────────────────────────────────────

/** Build a recommended "proposed" retrofit given the current scenario. The
 *  preset adapts to the current archetype to keep the comparison meaningful:
 *
 *   - If the current is a ducted central split (HP or AC+resistance), the
 *     proposed is a higher-efficiency ducted central HP — preserving the
 *     duct system + outdoor-unit pad. Handles the vintage-comparison case
 *     where the user has, say, a 2014 central HP and wants to model a 2024
 *     replacement of the same format.
 *   - If the climate is cold (CZ5A+), promote the NEEP cold-climate ductless
 *     mini-split (CCHP).
 *   - Otherwise, the standard ENERGY STAR ductless mini-split HP.
 *
 *  All variants inherit climate / apartment count / rate / grid context
 *  from the current scenario so comparisons are honest. */
function recommendedProposed(current: InUnitHvacInputs): InUnitHvacInputs {
  const sharedContext = {
    climateZone: current.climateZone,
    apartmentCount: current.apartmentCount,
    elecRate: current.elecRate,
    gridSubregion: current.gridSubregion,
  };
  const isCentralSplit =
    current.systemType === "central_split_hp" ||
    current.systemType === "central_split_ac_resist";
  if (isCentralSplit) {
    return { ...DEFAULT_CENTRAL_HP_RETROFIT, ...sharedContext };
  }
  const isCold =
    current.climateZone.startsWith("5") ||
    current.climateZone.startsWith("6") ||
    current.climateZone.startsWith("7");
  if (isCold) {
    return { ...DEFAULT_CCHP_RETROFIT, ...sharedContext };
  }
  return { ...DEFAULT_HP_RETROFIT, ...sharedContext };
}

function RetrofitTab({
  currentInputs,
  onChangeCurrent,
}: {
  currentInputs: InUnitHvacInputs;
  onChangeCurrent: (next: InUnitHvacInputs) => void;
}) {
  const isCentralSplit =
    currentInputs.systemType === "central_split_hp" ||
    currentInputs.systemType === "central_split_ac_resist";
  const isCold =
    currentInputs.climateZone.startsWith("5") ||
    currentInputs.climateZone.startsWith("6") ||
    currentInputs.climateZone.startsWith("7");

  const presetLabel = isCentralSplit
    ? "Apply higher-eff central HP"
    : isCold
    ? "Apply cold-climate HP"
    : "Apply standard HP";

  const [proposedInputs, setProposedInputs] = useState<InUnitHvacInputs>(
    recommendedProposed(currentInputs),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
        Current vs proposed retrofit
      </h1>
      <RetrofitComparison<InUnitHvacInputs, InUnitHvacResult>
        currentInputs={currentInputs}
        proposedInputs={proposedInputs}
        onChangeCurrent={onChangeCurrent}
        onChangeProposed={setProposedInputs}
        runCalc={runCalc}
        extractMetrics={extractMetrics}
        proposedPreset={{
          label: presetLabel,
          inputs: recommendedProposed(currentInputs),
        }}
        renderInputs={(inputs, onChange) => (
          <CompactInputs inputs={inputs} onChange={onChange} />
        )}
        onSave={(name, scenarios) => {
          saveScenarios(name, "inunit_hvac", scenarios);
        }}
      />
      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Engine v{ENGINE_VERSIONS.inunit_hvac} · saved retrofits appear in the
        Reports library tagged with the in-unit HVAC domain.
      </div>
    </div>
  );
}

/** Compact input form for the retrofit two-column layout. Same fields as
 *  the Equipment tab but tighter — system selector + 6 numeric inputs per
 *  side, no descriptive callouts. */
function CompactInputs({
  inputs,
  onChange,
}: {
  inputs: InUnitHvacInputs;
  onChange: (next: InUnitHvacInputs) => void;
}) {
  function patch<K extends keyof InUnitHvacInputs>(key: K, value: InUnitHvacInputs[K]) {
    onChange({ ...inputs, [key]: value });
  }

  function pickSystemType(systemType: InUnitHvacSystemType) {
    const spec = INUNIT_HVAC_SYSTEM_SPECS[systemType];
    onChange({
      ...inputs,
      systemType,
      coolingCapacityBtuh: spec.coolingBtuh,
      coolingEfficiency: spec.coolingEff,
      coolingEfficiencyMetric: spec.coolingMetric,
      heatingCapacityBtuh: spec.heatingBtuh,
      heatingEfficiency: spec.heatingEff,
      heatingEfficiencyMetric: spec.heatingMetric,
    });
  }

  const systemOptions = (Object.keys(INUNIT_HVAC_SYSTEM_SPECS) as InUnitHvacSystemType[]).map(
    (k) => ({ value: k, label: INUNIT_HVAC_SYSTEM_SPECS[k].label }),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Field label="System archetype">
        <SelectInput
          value={inputs.systemType}
          onChange={(v) => pickSystemType(v as InUnitHvacSystemType)}
          options={systemOptions}
        />
      </Field>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          paddingTop: 4,
          borderTop: "1px dashed var(--border-light)",
        }}
      >
        <CompactNumber
          label="Cool BTU/h"
          value={inputs.coolingCapacityBtuh}
          onChange={(v) => patch("coolingCapacityBtuh", v)}
          step={500}
        />
        <CompactNumber
          label={`Cool ${inputs.coolingEfficiencyMetric}`}
          value={inputs.coolingEfficiency}
          onChange={(v) => patch("coolingEfficiency", v)}
          step={0.5}
        />
        <CompactNumber
          label="Heat BTU/h"
          value={inputs.heatingCapacityBtuh}
          onChange={(v) => patch("heatingCapacityBtuh", v)}
          step={500}
        />
        <CompactNumber
          label={
            inputs.heatingEfficiencyMetric === "resistance"
              ? "Heat (resist)"
              : `Heat ${inputs.heatingEfficiencyMetric}`
          }
          value={inputs.heatingEfficiency}
          onChange={(v) => patch("heatingEfficiency", v)}
          step={0.1}
          disabled={inputs.heatingEfficiencyMetric === "resistance"}
        />
      </div>
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
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 9.5,
          color: "var(--text-muted)",
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
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
        disabled={disabled}
        style={{ padding: "4px 6px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}
      />
    </div>
  );
}
