"use client";

import { Info } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, NumberInput, SelectInput } from "@/components/ui/Field";
import { Grid } from "@/components/ui/Grid";
import { MetricCard } from "@/components/ui/MetricCard";
import { fmt, fmtUSD } from "@/lib/utils";
import {
  CENTRAL_GAS_TANKLESS_INPUT_MBH,
  type CentralGasTanklessInput,
} from "@/lib/engineering/constants";
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";

interface Props {
  inputs: DhwInputs;
  update: <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => void;
  result: CalcResult;
}

/**
 * Equipment tab — side-by-side gas / resistance / HPWH comparison at the
 * design load, plus system-type-specific tunables for the two central
 * non-storage / indirect topologies (`central_gas_tankless` and
 * `central_indirect`) which need their own inputs not shared with the
 * baseline central gas plant.
 */
export function EquipmentTab({ inputs, update, result }: Props) {
  const isCentralTankless = inputs.systemType === "central_gas_tankless";
  const isCentralIndirect = inputs.systemType === "central_indirect";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card accent="var(--accent-blue)">
        <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, margin: 0 }}>
          <strong>Equipment</strong> shows the three candidate heat sources side-by-side at the
          design load computed on the Sizing tab. Adjust gas efficiency, HPWH refrigerant, HPWH
          design ambient, or swing-tank enable on the <em>Building &amp; System</em> tab — all
          equipment parameters live there now so the data flow stays one-directional.
        </p>
      </Card>

      {isCentralTankless && (
        <Card accent="#e8975c">
          <CardHeader>
            <CardTitle>Central Tankless Module</CardTitle>
          </CardHeader>
          <Grid cols={2}>
            <Field
              label="Module input rating"
              suffix="MBH"
              hint="Per-module input. Cascades of small modules give better turndown; one large module saves footprint. UEF reuses the gas efficiency input on the Building tab (default 0.92 for condensing central tankless)."
            >
              <SelectInput<CentralGasTanklessInput>
                value={inputs.centralGasTanklessInput}
                onChange={(v) => update("centralGasTanklessInput", v)}
                options={CENTRAL_GAS_TANKLESS_INPUT_MBH.map((m) => ({
                  value: m,
                  label: `${m} MBH`,
                }))}
              />
            </Field>
            <MetricCard
              label="Capacity at design rise"
              value={fmt(result.centralTanklessCapacityGPM, 1)}
              unit="GPM"
              sub={`required ${fmt(result.centralTanklessPeakGPMRequired, 1)} GPM (peak hour ÷ 60 × 1.5)`}
              accent={result.centralTanklessMetsDemand ? "var(--accent-emerald)" : "var(--accent-red)"}
            />
          </Grid>
        </Card>
      )}

      {isCentralIndirect && (
        <Card accent="#d8924e">
          <CardHeader>
            <CardTitle>Indirect Heat-Exchanger Effectiveness</CardTitle>
          </CardHeader>
          <Grid cols={2}>
            <Field
              label="HX effectiveness"
              hint="Heat-exchanger transfer efficiency from boiler loop to potable side. Plate HX 0.92–0.95; older copper-coil indirect tank 0.85–0.90. Combined system efficiency = gas efficiency × HX effectiveness."
            >
              <NumberInput
                value={inputs.indirectHXEffectiveness}
                onChange={(n) => update("indirectHXEffectiveness", n)}
                step={0.01}
                min={0.8}
                max={0.99}
              />
            </Field>
            <MetricCard
              label="Combined system efficiency"
              value={`${(result.effectiveGasEfficiency * 100).toFixed(1)}%`}
              sub={`gas η ${(inputs.gasEfficiency * 100).toFixed(0)}% × HX ${(inputs.indirectHXEffectiveness * 100).toFixed(0)}%`}
              accent="#d8924e"
            />
          </Grid>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Technology comparison at design load</CardTitle>
        </CardHeader>
        <Grid cols={3}>
          <MetricCard
            label="Gas (condensing)"
            value={fmt(result.gasInputBTUH / 1000)}
            unit="MBH input"
            sub={`η ${(inputs.gasEfficiency * 100).toFixed(0)}%`}
            accent="#F59E0B"
          />
          <MetricCard
            label="Electric resistance"
            value={fmt(result.resistanceInputKW, 1)}
            unit="kW"
            sub="1:1 efficiency"
            accent="#7DBBD3"
          />
          <MetricCard
            label={`HPWH (${inputs.hpwhRefrigerant})`}
            value={fmt(result.hpwhNameplateKW, 1)}
            unit="kW nameplate"
            sub={`COP ${result.cop.toFixed(2)}, derate ${(result.capFactor * 100).toFixed(0)}%`}
            accent="#7DD3A3"
          />
        </Grid>
        <div
          style={{
            marginTop: 12,
            padding: "8px 14px",
            background: "var(--accent-blue-bg)",
            borderLeft: "3px solid var(--accent-blue)",
            borderRadius: 8,
            fontSize: 11,
            color: "var(--text-primary)",
          }}
        >
          <Info size={12} style={{ verticalAlign: "-2px", marginRight: 6 }} color="var(--accent-blue)" />
          Gas input = design load ÷ efficiency · Resistance = design load ÷ 3412 · HPWH nameplate
          = design load ÷ COP ÷ capacity_factor.
          {inputs.swingTankEnabled && " Swing tank enabled — adds ~{result.swingTankKW.toFixed(1)} kW resistance boost for recirc + Legionella."}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annual operating cost</CardTitle>
        </CardHeader>
        <Grid cols={3}>
          <MetricCard
            label="Gas"
            value={fmtUSD(result.annualGasCost)}
            unit="/yr"
            sub={`${fmt(result.annualGasTherms)} therms`}
            accent="#F59E0B"
          />
          <MetricCard
            label="Resistance"
            value={fmtUSD(result.annualResistanceCost)}
            unit="/yr"
            sub={`${fmt(result.annualResistanceKWh)} kWh`}
            accent="#7DBBD3"
          />
          <MetricCard
            label="HPWH"
            value={fmtUSD(result.annualHPWHCost)}
            unit="/yr"
            sub={`${fmt(result.annualHPWHKWh_total)} kWh, COP ${result.annualCOP.toFixed(2)}`}
            accent="#7DD3A3"
          />
        </Grid>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annual carbon (lb CO₂e)</CardTitle>
        </CardHeader>
        <Grid cols={3}>
          <MetricCard label="Gas" value={fmt(result.annualGasCarbon)} accent="#F59E0B" />
          <MetricCard label="Resistance" value={fmt(result.annualResistanceCarbon)} accent="#7DBBD3" />
          <MetricCard label="HPWH" value={fmt(result.annualHPWHCarbon)} accent="#7DD3A3" />
        </Grid>
      </Card>
    </div>
  );
}
