"use client";

/**
 * Lighting Retrofit comparison tab — two-column current-vs-proposed widget
 * with the "Apply LED + sensors" preset. Extracted from
 * `LightingCalculator.tsx` to match the in-unit HVAC tab extraction pattern.
 */
import { useState } from "react";
import { runCalc } from "@/lib/lighting/pipeline";
import {
  DEFAULT_LED_RETROFIT,
  LIGHTING_CATEGORIES,
  LIGHTING_CATEGORY_LABELS,
  type LightingCategory,
  type LightingCategoryConfig,
  type LightingInputs,
} from "@/lib/lighting/inputs";
import type { LightingResult } from "@/lib/lighting/types";
import { RetrofitComparison } from "@/components/RetrofitComparison";
import { type RetrofitMetrics } from "@/components/SavingsStrip";
import { saveScenarios } from "@/lib/reports/storage";
import { ENGINE_VERSIONS } from "@/lib/version";

interface Props {
  currentInputs: LightingInputs;
  onChangeCurrent: (next: LightingInputs) => void;
}

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

export function RetrofitTab({ currentInputs, onChangeCurrent }: Props) {
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
