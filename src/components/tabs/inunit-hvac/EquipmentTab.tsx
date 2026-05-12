"use client";

/**
 * In-unit HVAC Equipment tab — building context (apartment count, climate
 * zone, electric rate, grid subregion) + per-apartment cooling and heating
 * equipment configuration. Split out of `InUnitHvacCalculator.tsx` so the
 * shell stays narrow and each tab is independently readable.
 */
import { RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, NumberInput, SelectInput } from "@/components/ui/Field";
import { CLIMATE_DESIGN, GRID_EF } from "@/lib/engineering/constants";
import {
  COOLING_EFLH_BY_CZ,
  HEATING_EFLH_BY_CZ,
} from "@/lib/inunit-hvac/pipeline";
import {
  INUNIT_HVAC_SYSTEM_SPECS,
  type CoolingEffMetric,
  type HeatingEffMetric,
  type InUnitHvacInputs,
  type InUnitHvacSystemType,
} from "@/lib/inunit-hvac/inputs";
import { Callout } from "@/components/methodology/Helpers";

interface Props {
  inputs: InUnitHvacInputs;
  update: <K extends keyof InUnitHvacInputs>(
    key: K,
    value: InUnitHvacInputs[K],
  ) => void;
  switchSystemType: (s: InUnitHvacSystemType) => void;
  reset: () => void;
}

export function EquipmentTab({ inputs, update, switchSystemType, reset }: Props) {
  const climateOptions = Object.keys(CLIMATE_DESIGN).map((k) => ({ value: k, label: k }));
  const gridOptions = Object.keys(GRID_EF).map((g) => ({ value: g, label: g }));
  const systemOptions = (
    Object.keys(INUNIT_HVAC_SYSTEM_SPECS) as InUnitHvacSystemType[]
  ).map((k) => ({ value: k, label: INUNIT_HVAC_SYSTEM_SPECS[k].label }));

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
