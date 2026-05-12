"use client";

import { Card } from "@/components/ui/Card";
import {
  Callout,
  Em,
  Formula,
  KVList,
  Prose,
  Result,
  Step,
  Sub,
} from "@/components/calculations/Helpers";
import { fmt, fmtUSD } from "@/lib/utils";
import {
  CLIMATE_DESIGN,
  GRID_EF,
  MONTH_DAYS,
  MONTHLY_HDD_FRAC,
  MONTHS,
} from "@/lib/engineering/constants";
import {
  archetypeForClimateZone,
  COOLING_EFLH_BY_CZ,
  HEATING_EFLH_BY_CZ,
  MONTHLY_CDD_FRAC,
} from "@/lib/inunit-hvac/pipeline";
import { INUNIT_HVAC_SYSTEM_SPECS, type InUnitHvacInputs } from "@/lib/inunit-hvac/inputs";
import type { InUnitHvacResult } from "@/lib/inunit-hvac/types";

interface Props {
  inputs: InUnitHvacInputs;
  result: InUnitHvacResult;
}

/**
 * Step-by-step worked example of the in-unit HVAC pipeline. Mirrors the DHW
 * CalculationsTab pattern: every formula the engine runs is shown with the
 * user's current inputs substituted in, so an MEP reviewer can trace any
 * output back to its inputs and verify against ASHRAE / AHRI references
 * without leaving the app. The Methodology tab documents the formulas in
 * abstract; this tab shows them plugged in.
 */
export function CalculationsTab({ inputs, result }: Props) {
  const sysSpec = INUNIT_HVAC_SYSTEM_SPECS[inputs.systemType];
  const archetype = archetypeForClimateZone(inputs.climateZone);
  const climate = CLIMATE_DESIGN[inputs.climateZone];

  // EFLH defaults vs override — drives the math + the inline display.
  const defaultCoolingEflh = COOLING_EFLH_BY_CZ[inputs.climateZone] ?? 0;
  const defaultHeatingEflh = HEATING_EFLH_BY_CZ[inputs.climateZone] ?? 0;
  const usedCoolingEflh = result.cooling.eflhHours;
  const usedHeatingEflh = result.heating.eflhHours;
  const coolingEflhSource = inputs.coolingEflhOverride > 0 ? "override" : "lookup";
  const heatingEflhSource = inputs.heatingEflhOverride > 0 ? "override" : "lookup";

  // Cooling math display — branch by metric (BTU/Wh vs dimensionless).
  const coolingFormula =
    inputs.coolingEfficiencyMetric === "SEER2" || inputs.coolingEfficiencyMetric === "EER"
      ? "kWh = (capacity × EFLH) ÷ (rating × 1000)"
      : "kWh = (capacity × EFLH) ÷ (COP × 3412)";
  const coolingDivisor =
    inputs.coolingEfficiencyMetric === "SEER2" || inputs.coolingEfficiencyMetric === "EER"
      ? inputs.coolingEfficiency * 1000
      : inputs.coolingEfficiency * 3412;
  const coolingDivisorLabel =
    inputs.coolingEfficiencyMetric === "SEER2" || inputs.coolingEfficiencyMetric === "EER"
      ? `${inputs.coolingEfficiency} × 1000`
      : `${inputs.coolingEfficiency} × 3412`;

  // Heating math display — branch by metric (BTU/Wh vs COP vs resistance).
  const heatingFormula =
    inputs.heatingEfficiencyMetric === "HSPF2"
      ? "kWh = (capacity × EFLH) ÷ (HSPF2 × 1000)"
      : inputs.heatingEfficiencyMetric === "COP"
      ? "kWh = (capacity × EFLH) ÷ (COP × 3412)"
      : "kWh = (capacity × EFLH) ÷ 3412   (COP fixed at 1.0)";
  const heatingDivisor =
    inputs.heatingEfficiencyMetric === "HSPF2"
      ? inputs.heatingEfficiency * 1000
      : inputs.heatingEfficiencyMetric === "COP"
      ? inputs.heatingEfficiency * 3412
      : 3412;
  const heatingDivisorLabel =
    inputs.heatingEfficiencyMetric === "HSPF2"
      ? `${inputs.heatingEfficiency} × 1000`
      : inputs.heatingEfficiencyMetric === "COP"
      ? `${inputs.heatingEfficiency} × 3412`
      : `3412 (resistance, COP 1.0)`;

  const emissionFactor =
    inputs.gridSubregion === "Custom"
      ? inputs.customEF
      : (GRID_EF[inputs.gridSubregion] ?? inputs.customEF);

  const cdd = normalizedFractions(MONTHLY_CDD_FRAC[archetype]);
  const hdd = normalizedFractions(MONTHLY_HDD_FRAC[archetype]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* INTRO */}
      <Card accent="var(--accent-blue)">
        <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "var(--text-primary)" }}>
          <strong>Calculations</strong> is a worked example. Every formula the engine runs is
          shown below with your current inputs substituted in — so you can trace any output
          back to its inputs, verify the math against ASHRAE / AHRI references, or hand-check
          a specific result before signing a design. The <strong>Methodology</strong> tab
          documents the formulas in abstract; this tab shows them plugged in.
        </p>
      </Card>

      {/* 01 BUILDING + ARCHETYPE */}
      <Step n={1} title="Building totals + archetype">
        <Prose>
          The building is described by an apartment count and a climate zone. Every
          apartment is assumed to share the same equipment spec. The whole-building rollup
          is per-apartment × apartment count.
        </Prose>
        <KVList
          rows={[
            ["Apartment count", `${fmt(result.apartmentCount, 0)} units`],
            ["Climate zone", inputs.climateZone],
            ["Climate archetype", archetype],
            [
              "Heating design DB (99.6%)",
              climate ? `${climate.heatDB}°F` : "(unknown)",
            ],
            [
              "Annual avg ambient",
              climate ? `${climate.avgAnnual}°F` : "(unknown)",
            ],
            ["System archetype", sysSpec.label],
            ["Reference", sysSpec.reference],
          ]}
        />
      </Step>

      {/* 02 EFLH LOOKUP */}
      <Step
        n={2}
        title="Climate zone → EFLH lookup"
        subtitle="ASHRAE 90.1-2022 Appendix G3.1.3.10 + DOE Building America"
      >
        <Prose>
          Equivalent Full-Load Hours (EFLH) is the number of hours equipment would need to
          run at 100% capacity to deliver the year&apos;s actual cooling or heating output.
          The EFLH lookup is keyed by climate zone; user overrides win when non-zero.
        </Prose>
        <Formula>
          eflh<sub>cool</sub> = override<sub>cool</sub> &gt; 0 ? override<sub>cool</sub> :
          COOLING_EFLH_BY_CZ[climateZone]
        </Formula>
        <Sub>
          override<sub>cool</sub> = {fmt(inputs.coolingEflhOverride, 0)} hr; lookup ={" "}
          {fmt(defaultCoolingEflh, 0)} hr → uses {coolingEflhSource}{" "}
          → <Result>{fmt(usedCoolingEflh, 0)} hr</Result>
        </Sub>
        <Formula>
          eflh<sub>heat</sub> = override<sub>heat</sub> &gt; 0 ? override<sub>heat</sub> :
          HEATING_EFLH_BY_CZ[climateZone]
        </Formula>
        <Sub>
          override<sub>heat</sub> = {fmt(inputs.heatingEflhOverride, 0)} hr; lookup ={" "}
          {fmt(defaultHeatingEflh, 0)} hr → uses {heatingEflhSource}{" "}
          → <Result>{fmt(usedHeatingEflh, 0)} hr</Result>
        </Sub>
      </Step>

      {/* 03 COOLING MATH */}
      <Step n={3} title="Cooling — per-apartment annual kWh" subtitle="AHRI 210/240 or 310/380">
        <Prose>
          Per-apartment cooling energy is rated capacity × EFLH ÷ efficiency. SEER2, EER,
          and HSPF2 are BTU per Wh ratings — capacity × hours ÷ rating gives Wh, then ÷
          1000 gives kWh. COP is dimensionless (output ÷ input), so we divide by{" "}
          <Em>COP × 3412</Em> to convert BTU output into kWh input.
        </Prose>
        <Formula>{coolingFormula}</Formula>
        <Sub>
          ({fmt(inputs.coolingCapacityBtuh, 0)} × {fmt(usedCoolingEflh, 0)}) ÷ ({coolingDivisorLabel})
          = ({fmt(inputs.coolingCapacityBtuh * usedCoolingEflh, 0)}) ÷ ({fmt(coolingDivisor, 0)})
          = <Result>{fmt(result.cooling.perAptKWh, 0)} kWh / apt</Result>
        </Sub>
        <KVList
          rows={[
            ["Capacity (per apt)", `${fmt(inputs.coolingCapacityBtuh, 0)} BTU/h`],
            ["Rated efficiency", `${inputs.coolingEfficiency} ${inputs.coolingEfficiencyMetric}`],
            ["Effective COP (display)", result.cooling.effectiveCOP.toFixed(2)],
            ["EFLH used", `${fmt(usedCoolingEflh, 0)} hr/yr`],
            ["Per-apt annual kWh", `${fmt(result.cooling.perAptKWh, 0)} kWh`],
          ]}
        />
      </Step>

      {/* 04 HEATING MATH */}
      <Step n={4} title="Heating — per-apartment annual kWh" subtitle="AHRI 210/240, 310/380, or resistance">
        <Prose>
          Per-apartment heating energy uses the same form as cooling, with the metric
          determining whether we divide by <Em>rating × 1000</Em> (HSPF2 — BTU/Wh) or{" "}
          <Em>COP × 3412</Em> (PTHP rated as dimensionless COP) or just <Em>3412</Em>{" "}
          (electric resistance, COP fixed at 1.0 by physics).
        </Prose>
        <Formula>{heatingFormula}</Formula>
        <Sub>
          ({fmt(inputs.heatingCapacityBtuh, 0)} × {fmt(usedHeatingEflh, 0)}) ÷ ({heatingDivisorLabel})
          = ({fmt(inputs.heatingCapacityBtuh * usedHeatingEflh, 0)}) ÷ ({fmt(heatingDivisor, 0)})
          = <Result>{fmt(result.heating.perAptKWh, 0)} kWh / apt</Result>
        </Sub>
        <KVList
          rows={[
            ["Capacity (per apt)", `${fmt(inputs.heatingCapacityBtuh, 0)} BTU/h`],
            [
              "Rated efficiency",
              inputs.heatingEfficiencyMetric === "resistance"
                ? "resistance (COP 1.0)"
                : `${inputs.heatingEfficiency} ${inputs.heatingEfficiencyMetric}`,
            ],
            ["Effective COP (display)", result.heating.effectiveCOP.toFixed(2)],
            ["EFLH used", `${fmt(usedHeatingEflh, 0)} hr/yr`],
            ["Per-apt annual kWh", `${fmt(result.heating.perAptKWh, 0)} kWh`],
          ]}
        />
        {inputs.heatingEfficiencyMetric === "resistance" &&
          (archetype === "cold" || archetype === "very_cold") && (
            <Callout tone="warn">
              Resistance heat in {inputs.climateZone}: a heat-pump retrofit cuts the per-apt{" "}
              {fmt(result.heating.perAptKWh, 0)} kWh heating load by 50–70% — the dominant
              savings driver in any cold-climate retrofit. See the Retrofit Comparison tab.
            </Callout>
          )}
      </Step>

      {/* 05 BUILDING ROLLUP */}
      <Step n={5} title="Whole-building rollup" subtitle="Per-apt × apartment count">
        <Prose>
          Whole-building energy is a flat multiplier — every apartment is assumed to share
          the same equipment spec.
        </Prose>
        <Formula>kWh<sub>building</sub> = kWh<sub>apt</sub> × apartmentCount</Formula>
        <Sub>
          Cooling: {fmt(result.cooling.perAptKWh, 0)} × {fmt(result.apartmentCount, 0)} ={" "}
          <Result>{fmt(result.cooling.buildingKWh, 0)} kWh</Result>
        </Sub>
        <Sub>
          Heating: {fmt(result.heating.perAptKWh, 0)} × {fmt(result.apartmentCount, 0)} ={" "}
          <Result>{fmt(result.heating.buildingKWh, 0)} kWh</Result>
        </Sub>
        <Sub>
          Total: {fmt(result.cooling.buildingKWh, 0)} + {fmt(result.heating.buildingKWh, 0)}{" "}
          = <Result>{fmt(result.totalAnnualKWh, 0)} kWh / yr</Result>
        </Sub>
      </Step>

      {/* 06 COST */}
      <Step n={6} title="Annual cost" subtitle="Site electricity rate × kWh">
        <Prose>
          Cost is energy-only (no demand charges). For tenant-billed in-unit HVAC, the
          per-apt cost is what residents see; for centrally-billed buildings the rollup is
          what shows on the master meter.
        </Prose>
        <Formula>$<sub>annual</sub> = kWh<sub>building</sub> × elecRate</Formula>
        <Sub>
          {fmt(result.totalAnnualKWh, 0)} kWh × ${inputs.elecRate.toFixed(3)} /kWh ={" "}
          <Result>{fmtUSD(result.totalAnnualCost, 0)}</Result>
        </Sub>
        <Sub>
          Per apartment: {fmtUSD(result.totalAnnualCost / Math.max(1, result.apartmentCount), 0)}{" "}
          / yr
        </Sub>
      </Step>

      {/* 07 CARBON */}
      <Step n={7} title="Annual carbon" subtitle="EPA eGRID 2022 subregion factors">
        <Prose>
          Grid carbon math uses the user-selected eGRID 2022 subregion. In-unit HVAC is
          pure-electric; no on-site combustion to account for.
        </Prose>
        <KVList
          rows={[
            ["Grid subregion", inputs.gridSubregion],
            [
              "Emission factor",
              `${emissionFactor.toFixed(2)} lb CO₂e / kWh${
                inputs.gridSubregion === "Custom" ? " (user override)" : ""
              }`,
            ],
          ]}
        />
        <Formula>
          carbon<sub>annual</sub> = kWh<sub>building</sub> × emissionFactor
        </Formula>
        <Sub>
          {fmt(result.totalAnnualKWh, 0)} × {emissionFactor.toFixed(2)} ={" "}
          <Result>{fmt(result.totalAnnualCarbon, 0)} lb CO₂e / yr</Result>
        </Sub>
      </Step>

      {/* 08 CONNECTED TONS */}
      <Step n={8} title="Connected cooling tons" subtitle="Sanity-check rollup">
        <Prose>
          The connected-tons rollup converts whole-building cooling capacity into
          refrigeration tons (1 ton = 12,000 BTU/h). Useful for fitting against central-
          plant alternatives or estimating outdoor-condenser footprint requirements.
        </Prose>
        <Formula>tons = (capacity<sub>cool</sub> × apartmentCount) ÷ 12,000</Formula>
        <Sub>
          ({fmt(inputs.coolingCapacityBtuh, 0)} × {fmt(result.apartmentCount, 0)}) ÷ 12,000 ={" "}
          <Result>{result.totalConnectedTons.toFixed(1)} tons</Result>
        </Sub>
      </Step>

      {/* 09 MONTHLY DISTRIBUTION */}
      <Step
        n={9}
        title="Monthly distribution"
        subtitle="Cooling ↔ CDD share, heating ↔ HDD share by climate archetype"
      >
        <Prose>
          The annual rollup splits across months by climate-zone heating-degree-day (HDD)
          and cooling-degree-day (CDD) shares. Both fraction arrays are normalized so the
          monthly rollup matches the annual exactly. Climate archetype{" "}
          <Em>{archetype}</Em> drives the shape — cold/very-cold archetypes concentrate
          heating in Dec–Feb; hot/mixed archetypes spread cooling across May–Sep.
        </Prose>
        <Formula>
          coolingKWh<sub>month</sub> = cooling<sub>buildingKWh</sub> × CDD<sub>frac</sub>[m]
        </Formula>
        <Formula>
          heatingKWh<sub>month</sub> = heating<sub>buildingKWh</sub> × HDD<sub>frac</sub>[m]
        </Formula>
        <div
          style={{
            overflowX: "auto",
            margin: "8px 0",
            padding: "0 12px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
            }}
          >
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th style={tdHead}>Month</th>
                <th style={tdHeadNum}>Days</th>
                <th style={tdHeadNum}>CDD frac</th>
                <th style={tdHeadNum}>HDD frac</th>
                <th style={tdHeadNum}>Cool kWh</th>
                <th style={tdHeadNum}>Heat kWh</th>
                <th style={tdHeadNum}>Total kWh</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const row = result.monthly.monthly[i];
                return (
                  <tr key={m} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={tdCell}>{m}</td>
                    <td style={tdCellNum}>{MONTH_DAYS[i]}</td>
                    <td style={tdCellNum}>{(cdd[i] * 100).toFixed(1)}%</td>
                    <td style={tdCellNum}>{(hdd[i] * 100).toFixed(1)}%</td>
                    <td style={tdCellNum}>{fmt(row.coolingKWh, 0)}</td>
                    <td style={tdCellNum}>{fmt(row.heatingKWh, 0)}</td>
                    <td style={tdCellNum}>{fmt(row.totalEnergy, 0)}</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                <td style={tdCell}>Total</td>
                <td style={tdCellNum}>365</td>
                <td style={tdCellNum}>100.0%</td>
                <td style={tdCellNum}>100.0%</td>
                <td style={tdCellNum}>{fmt(result.cooling.buildingKWh, 0)}</td>
                <td style={tdCellNum}>{fmt(result.heating.buildingKWh, 0)}</td>
                <td style={tdCellNum}>{fmt(result.totalAnnualKWh, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Prose>
          The Energy &amp; cost tab renders this same data as a stacked bar chart for
          quick visual reading.
        </Prose>
      </Step>

      {/* INVARIANT CHECK */}
      <Card accent="var(--accent-emerald)">
        <p style={{ fontSize: 12.5, lineHeight: 1.7, margin: 0, color: "var(--text-primary)" }}>
          <strong>Invariant check:</strong> the monthly rollup of{" "}
          <Em>{fmt(result.monthly.monthlyAnnualEnergy, 0)} kWh</Em> should match the annual{" "}
          <Em>{fmt(result.totalAnnualKWh, 0)} kWh</Em> within float tolerance. The
          calibration suite asserts this on every CI build (test:{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
            Monthly model fairness — Monthly rows sum to annual totals
          </code>
          ).
        </p>
      </Card>
    </div>
  );
}

/** Normalize an array so it sums to exactly 1.0 — same logic the pipeline uses
 *  internally for HDD/CDD fraction arrays. */
function normalizedFractions(arr: readonly number[]): number[] {
  const sum = arr.reduce((s, v) => s + v, 0);
  if (sum <= 0) return arr.slice();
  return arr.map((v) => v / sum);
}

// ─── Inline table styles ───────────────────────────────────────────────────
// The monthly-distribution table at step 9 is the only place CalculationsTab
// needs a multi-column tabular layout; styles stay local rather than going
// into the shared helpers module.

const tdHead: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--border-light)",
};
const tdHeadNum: React.CSSProperties = { ...tdHead, textAlign: "right" };
const tdCell: React.CSSProperties = { padding: "5px 8px" };
const tdCellNum: React.CSSProperties = {
  ...tdCell,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
