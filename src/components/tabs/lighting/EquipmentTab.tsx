"use client";

/**
 * Lighting Equipment tab — building context (sqft, electric rate, grid
 * subregion) + per-category fixture inventory with control reductions.
 * Extracted from `LightingCalculator.tsx` to match the in-unit HVAC tab
 * extraction pattern.
 */
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, NumberInput, SelectInput } from "@/components/ui/Field";
import { GRID_EF } from "@/lib/engineering/constants";
import {
  LIGHTING_CATEGORIES,
  LIGHTING_CATEGORY_HINTS,
  LIGHTING_CATEGORY_LABELS,
  type LightingCategory,
  type LightingCategoryConfig,
  type LightingInputs,
} from "@/lib/lighting/inputs";
import { Callout } from "@/components/methodology/Helpers";

interface Props {
  inputs: LightingInputs;
  update: <K extends keyof LightingInputs>(key: K, value: LightingInputs[K]) => void;
  updateCategory: (
    category: LightingCategory,
    field: keyof LightingCategoryConfig,
    value: number,
  ) => void;
  reset: () => void;
}

export function EquipmentTab({ inputs, update, updateCategory, reset }: Props) {
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
              background: "var(--surface-subtle, #F8FAFC)",
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
