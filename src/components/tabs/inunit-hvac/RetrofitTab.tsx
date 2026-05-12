"use client";

/**
 * In-unit HVAC Retrofit comparison tab — two-column current-vs-proposed
 * widget with a smart preset that picks the right proposed archetype based
 * on the current scenario's climate + system type. Split out of
 * `InUnitHvacCalculator.tsx` so the shell stays focused on routing.
 */
import { useState } from "react";
import { runCalc } from "@/lib/inunit-hvac/pipeline";
import {
  DEFAULT_HP_RETROFIT,
  DEFAULT_CCHP_RETROFIT,
  DEFAULT_CENTRAL_HP_RETROFIT,
  INUNIT_HVAC_SYSTEM_SPECS,
  type InUnitHvacInputs,
  type InUnitHvacSystemType,
} from "@/lib/inunit-hvac/inputs";
import type { InUnitHvacResult } from "@/lib/inunit-hvac/types";
import { Field, SelectInput } from "@/components/ui/Field";
import { RetrofitComparison } from "@/components/RetrofitComparison";
import { type RetrofitMetrics } from "@/components/SavingsStrip";
import { saveScenarios } from "@/lib/reports/storage";
import { ENGINE_VERSIONS } from "@/lib/version";

interface Props {
  currentInputs: InUnitHvacInputs;
  onChangeCurrent: (next: InUnitHvacInputs) => void;
}

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

export function RetrofitTab({ currentInputs, onChangeCurrent }: Props) {
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
 *  the Equipment tab but tighter — system selector + 4 numeric inputs per
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

  const systemOptions = (
    Object.keys(INUNIT_HVAC_SYSTEM_SPECS) as InUnitHvacSystemType[]
  ).map((k) => ({ value: k, label: INUNIT_HVAC_SYSTEM_SPECS[k].label }));

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
