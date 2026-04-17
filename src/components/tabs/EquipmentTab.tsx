"use client";

import { Info } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { MetricCard } from "@/components/ui/MetricCard";
import { fmt, fmtUSD } from "@/lib/utils";
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";

interface Props {
  inputs: DhwInputs;
  update: <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => void;
  result: CalcResult;
}

// `update` is kept in the props signature so the parent calling convention is
// identical to the other input-bearing tabs, even though this tab is now
// output-only. Makes future re-introduction of an input trivial.
export function EquipmentTab({ inputs, result }: Props) {
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
