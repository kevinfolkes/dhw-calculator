"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, NumberInput, SelectInput } from "@/components/ui/Field";
import { Grid } from "@/components/ui/Grid";
import { MetricCard } from "@/components/ui/MetricCard";
import { fmt, fmtUSD } from "@/lib/utils";
import {
  ENVELOPE_PRESETS,
  GAS_TANKLESS_WH,
  GAS_TANK_WH,
  HPWH_TANK_FHR,
  type EnvelopeKey,
  type GasTankSize,
  type GasTanklessInput,
  type HPWHTankSize,
} from "@/lib/engineering/constants";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";

interface Props {
  inputs: DhwInputs;
  update: <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => void;
  result: CalcResult;
}

export function CombiTab({ inputs, update, result }: Props) {
  const sys = SYSTEM_TYPES[inputs.systemType];
  const isGasTank = inputs.systemType === "inunit_gas_tank";
  const isGasTankless = inputs.systemType === "inunit_gas_tankless";
  const isGasCombi = inputs.systemType === "inunit_combi_gas";
  const isHPWH = inputs.systemType === "inunit_hpwh" || inputs.systemType === "inunit_combi";
  const hasSpaceHeating = sys.hasSpaceHeating;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {(isGasTank || isGasCombi) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{isGasCombi ? "Gas Combi Tank — Per Unit" : "Gas Tank — Per Unit"}</CardTitle>
            </CardHeader>
            <Grid cols={3}>
              <Field label="Tank size" suffix="gal">
                <SelectInput<GasTankSize>
                  value={inputs.gasTankSize}
                  onChange={(v) => update("gasTankSize", v)}
                  options={(Object.keys(GAS_TANK_WH).map(Number) as GasTankSize[]).map((s) => ({
                    value: s,
                    label: `${s} gal (${GAS_TANK_WH[s].input_mbh} MBH)`,
                  }))}
                />
              </Field>
              <Field label="Efficiency">
                <SelectInput
                  value={inputs.gasTankType}
                  onChange={(v) => update("gasTankType", v)}
                  options={[
                    { value: "condensing", label: "Condensing" },
                    { value: "atmospheric", label: "Non-condensing" },
                  ]}
                />
              </Field>
              <Field label="Setpoint" suffix="°F">
                <NumberInput value={inputs.gasTankSetpointF} onChange={(n) => update("gasTankSetpointF", n)} min={100} max={180} />
              </Field>
            </Grid>
          </Card>
          <Grid cols={3}>
            <MetricCard
              label="FHR"
              value={fmt(result.inUnitGas.gasTankFHR)}
              unit="GPH"
              sub={result.inUnitGas.gasTankFHRMet ? "✓ meets peak" : "✗ below peak"}
              accent={result.inUnitGas.gasTankFHRMet ? "var(--accent-emerald)" : "var(--accent-red)"}
            />
            <MetricCard label="Recovery" value={fmt(result.inUnitGas.gasTankRecoveryGPH)} unit="GPH" sub={`UEF ${result.inUnitGas.gasTankUEF}, rise ${fmt(result.inUnitGas.gasTankRiseF)}°F`} />
            <MetricCard label="Per-unit input" value={fmt(result.inUnitGas.gasTankCFH_perUnit)} unit="CFH" sub={`Bldg ${fmt(result.inUnitGas.buildingGasDemandCFH)} CFH @ ${(result.inUnitGas.gasDiversityFactor * 100).toFixed(0)}% div`} />
          </Grid>
          <Grid cols={3}>
            <MetricCard label="Per-unit DHW annual" value={fmt(result.inUnitGas.gasTankAnnualTherms_perUnit, 1)} unit="therms" accent="#F59E0B" />
            <MetricCard label="Building annual cost" value={fmtUSD(result.inUnitGas.gasTankBuildingCost)} unit="/yr" accent="#F59E0B" />
            <MetricCard label="Building carbon" value={fmt(result.inUnitGas.gasTankBuildingCarbon)} unit="lb CO₂/yr" accent="#F59E0B" />
          </Grid>

          {isGasCombi && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Per-Unit Space Heating (Manual J)</CardTitle>
                </CardHeader>
                <Grid cols={2}>
                  <Field label="Envelope preset">
                    <SelectInput<EnvelopeKey>
                      value={inputs.envelopePreset}
                      onChange={(v) => update("envelopePreset", v)}
                      options={(Object.keys(ENVELOPE_PRESETS) as EnvelopeKey[]).map((k) => ({
                        value: k,
                        label: ENVELOPE_PRESETS[k].label,
                      }))}
                    />
                  </Field>
                  <Field label="Fan coil supply temp" suffix="°F">
                    <NumberInput value={inputs.fanCoilSupplyF} onChange={(n) => update("fanCoilSupplyF", n)} min={100} max={160} />
                  </Field>
                  <Field label="Indoor design temp" suffix="°F">
                    <NumberInput value={inputs.indoorDesignF} onChange={(n) => update("indoorDesignF", n)} min={65} max={78} />
                  </Field>
                  <Field label="Ventilation load" suffix="CFM/unit">
                    <NumberInput value={inputs.ventilationLoadPerUnit} onChange={(n) => update("ventilationLoadPerUnit", n)} min={0} />
                  </Field>
                  <Field label="Avg Studio sqft">
                    <NumberInput value={inputs.avgUnitSqft.br0} onChange={(n) => update("avgUnitSqft", { ...inputs.avgUnitSqft, br0: n })} step={25} min={0} />
                  </Field>
                  <Field label="Avg 1-BR sqft">
                    <NumberInput value={inputs.avgUnitSqft.br1} onChange={(n) => update("avgUnitSqft", { ...inputs.avgUnitSqft, br1: n })} step={50} min={0} />
                  </Field>
                  <Field label="Avg 2-BR sqft">
                    <NumberInput value={inputs.avgUnitSqft.br2} onChange={(n) => update("avgUnitSqft", { ...inputs.avgUnitSqft, br2: n })} step={50} min={0} />
                  </Field>
                  <Field label="Avg 3-BR sqft">
                    <NumberInput value={inputs.avgUnitSqft.br3} onChange={(n) => update("avgUnitSqft", { ...inputs.avgUnitSqft, br3: n })} step={50} min={0} />
                  </Field>
                </Grid>
              </Card>

              {(() => {
                const tankOutputBTUH = result.inUnitGas.gasTankSpec.input_mbh * result.inUnitGas.gasTankUEF * 1000;
                const meets3BR = tankOutputBTUH >= result.combi.heatingLoad_3BR;
                const meets2BR = tankOutputBTUH >= result.combi.heatingLoad_2BR;
                const meets1BR = tankOutputBTUH >= result.combi.heatingLoad_1BR;
                const meets0BR = tankOutputBTUH >= result.combi.heatingLoad_0BR;
                const showStudio = inputs.unitsStudio > 0;
                return (
                  <Grid cols={showStudio ? 4 : 3}>
                    {showStudio && (
                      <MetricCard
                        label="Studio heating load"
                        value={fmt(result.combi.heatingLoad_0BR)}
                        unit="BTU/hr"
                        sub={meets0BR ? `✓ tank ${fmt(tankOutputBTUH)} BTU/hr` : `✗ tank short by ${fmt(result.combi.heatingLoad_0BR - tankOutputBTUH)} BTU/hr`}
                        accent={meets0BR ? "var(--accent-emerald)" : "var(--accent-red)"}
                      />
                    )}
                    <MetricCard
                      label="1-BR heating load"
                      value={fmt(result.combi.heatingLoad_1BR)}
                      unit="BTU/hr"
                      sub={meets1BR ? `✓ tank ${fmt(tankOutputBTUH)} BTU/hr` : `✗ tank short by ${fmt(result.combi.heatingLoad_1BR - tankOutputBTUH)} BTU/hr`}
                      accent={meets1BR ? "var(--accent-emerald)" : "var(--accent-red)"}
                    />
                    <MetricCard
                      label="2-BR heating load"
                      value={fmt(result.combi.heatingLoad_2BR)}
                      unit="BTU/hr"
                      sub={meets2BR ? `✓ tank ${fmt(tankOutputBTUH)} BTU/hr` : `✗ tank short by ${fmt(result.combi.heatingLoad_2BR - tankOutputBTUH)} BTU/hr`}
                      accent={meets2BR ? "var(--accent-emerald)" : "var(--accent-red)"}
                    />
                    <MetricCard
                      label="3-BR heating load"
                      value={fmt(result.combi.heatingLoad_3BR)}
                      unit="BTU/hr"
                      sub={meets3BR ? `✓ tank ${fmt(tankOutputBTUH)} BTU/hr` : `✗ tank short by ${fmt(result.combi.heatingLoad_3BR - tankOutputBTUH)} BTU/hr`}
                      accent={meets3BR ? "var(--accent-emerald)" : "var(--accent-red)"}
                    />
                  </Grid>
                );
              })()}

              <Grid cols={3}>
                <MetricCard
                  label="Building annual therms"
                  value={fmt(result.monthly.monthlyAnnualEnergy)}
                  unit="therms"
                  sub={`DHW ${fmt(result.monthly.monthlyAnnualDHW)} + heating ${fmt(result.monthly.monthlyAnnualHeating)}`}
                  accent="#F59E0B"
                />
                <MetricCard
                  label="Building annual cost"
                  value={fmtUSD(result.monthly.monthlyAnnualCost)}
                  unit="/yr"
                  accent="#F59E0B"
                />
                <MetricCard
                  label="Building carbon"
                  value={fmt(result.monthly.monthlyAnnualCarbon)}
                  unit="lb CO₂/yr"
                  accent="#F59E0B"
                />
              </Grid>
            </>
          )}
        </>
      )}

      {isGasTankless && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Gas Tankless — Per Unit</CardTitle>
            </CardHeader>
            <Grid cols={3}>
              <Field label="Input" suffix="MBH">
                <SelectInput<GasTanklessInput>
                  value={inputs.gasTanklessInput}
                  onChange={(v) => update("gasTanklessInput", v)}
                  options={(Object.keys(GAS_TANKLESS_WH).map(Number) as GasTanklessInput[]).map((s) => ({
                    value: s,
                    label: `${s} MBH (${GAS_TANKLESS_WH[s].modulation} mod)`,
                  }))}
                />
              </Field>
              <Field label="Design ΔT rise" suffix="°F">
                <NumberInput value={inputs.tanklessDesignRiseF} onChange={(n) => update("tanklessDesignRiseF", n)} min={30} max={100} />
              </Field>
              <Field
                label="Simultaneous fixtures"
                hint={`Currently ${inputs.tanklessSimultaneousFixtures} — edit on the Building & System tab (Fixture Flow Rates card).`}
              >
                <NumberInput value={inputs.tanklessSimultaneousFixtures} onChange={(n) => update("tanklessSimultaneousFixtures", n)} min={1} max={6} />
              </Field>
              <Field label="Setpoint" suffix="°F">
                <NumberInput value={inputs.gasTanklessSetpointF} onChange={(n) => update("gasTanklessSetpointF", n)} min={100} max={140} />
              </Field>
            </Grid>
          </Card>
          <Grid cols={3}>
            <MetricCard
              label="Capacity at design rise"
              value={fmt(result.inUnitGas.tanklessCapacityAtRise, 1)}
              unit="GPM"
              sub={result.inUnitGas.tanklessMetsDemand ? "✓ meets peak" : "✗ below peak"}
              accent={result.inUnitGas.tanklessMetsDemand ? "var(--accent-emerald)" : "var(--accent-red)"}
            />
            <MetricCard label="Peak demand" value={fmt(result.inUnitGas.tanklessPeakGPM, 1)} unit="GPM" sub={`${inputs.tanklessSimultaneousFixtures} fixtures × 2.0 GPM × 85%`} />
            <MetricCard label="Per-unit input" value={fmt(result.inUnitGas.tanklessCFH_perUnit)} unit="CFH" sub={`Bldg ${fmt(result.inUnitGas.tanklessBuildingDemandCFH)} CFH @ div`} />
          </Grid>
          <Grid cols={3}>
            <MetricCard label="Per-unit annual" value={fmt(result.inUnitGas.tanklessAnnualTherms_perUnit, 1)} unit="therms" accent="#F59E0B" />
            <MetricCard label="Building annual cost" value={fmtUSD(result.inUnitGas.tanklessBuildingCost)} unit="/yr" accent="#F59E0B" />
            <MetricCard label="Building carbon" value={fmt(result.inUnitGas.tanklessBuildingCarbon)} unit="lb CO₂/yr" accent="#F59E0B" />
          </Grid>
        </>
      )}

      {isHPWH && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{hasSpaceHeating ? "In-Unit Combi" : "In-Unit HPWH"} — Per Unit</CardTitle>
            </CardHeader>
            <Grid cols={3}>
              <Field label="Tank size" suffix="gal">
                <SelectInput<HPWHTankSize>
                  value={inputs.combiTankSize}
                  onChange={(v) => update("combiTankSize", v)}
                  options={(Object.keys(HPWH_TANK_FHR).map(Number) as HPWHTankSize[]).map((s) => ({
                    value: s,
                    label: `${s} gal (FHR ${HPWH_TANK_FHR[s].fhr} GPH, UEF ${HPWH_TANK_FHR[s].uef})`,
                  }))}
                />
              </Field>
              <Field label="DHW setpoint" suffix="°F">
                <NumberInput value={inputs.combiDHWSetpointF} onChange={(n) => update("combiDHWSetpointF", n)} min={100} max={160} />
              </Field>
              {hasSpaceHeating && (
                <Field label="Fan coil supply temp" suffix="°F">
                  <NumberInput value={inputs.fanCoilSupplyF} onChange={(n) => update("fanCoilSupplyF", n)} min={100} max={160} />
                </Field>
              )}
              {hasSpaceHeating && (
                <Field label="HPWH op limit" suffix="°F" hint="Below this ambient, resistance carries load">
                  <NumberInput value={inputs.hpwhOpLimitF} onChange={(n) => update("hpwhOpLimitF", n)} min={-20} max={50} />
                </Field>
              )}
            </Grid>
          </Card>

          <Grid cols={3}>
            <MetricCard
              label="Tank FHR"
              value={fmt(result.combi.fhr)}
              unit="GPH"
              sub={result.combi.dhwMetByFHR ? "✓ meets peak" : `✗ needs ${fmt(result.combi.worstPeakDHW)}`}
              accent={result.combi.dhwMetByFHR ? "var(--accent-emerald)" : "var(--accent-red)"}
            />
            <MetricCard label="DHW COP" value={result.combi.combiCOP_dhw.toFixed(2)} sub={`@ 70°F ambient, ${inputs.combiDHWSetpointF}°F setpoint`} />
            {hasSpaceHeating && (
              <MetricCard label="Heating COP" value={result.combi.combiCOP_heating.toFixed(2)} sub={`@ ${fmt(result.combi.effectiveTankSetpointForHeating)}°F effective tank`} />
            )}
          </Grid>

          {hasSpaceHeating && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Per-Unit Space Heating (Manual J)</CardTitle>
                </CardHeader>
                <Grid cols={2}>
                  <Field label="Envelope preset">
                    <SelectInput<EnvelopeKey>
                      value={inputs.envelopePreset}
                      onChange={(v) => update("envelopePreset", v)}
                      options={(Object.keys(ENVELOPE_PRESETS) as EnvelopeKey[]).map((k) => ({
                        value: k,
                        label: ENVELOPE_PRESETS[k].label,
                      }))}
                    />
                  </Field>
                  <Field label="Ventilation load" suffix="CFM/unit">
                    <NumberInput value={inputs.ventilationLoadPerUnit} onChange={(n) => update("ventilationLoadPerUnit", n)} min={0} />
                  </Field>
                  <Field label="Indoor design temp" suffix="°F">
                    <NumberInput value={inputs.indoorDesignF} onChange={(n) => update("indoorDesignF", n)} min={65} max={78} />
                  </Field>
                  <Field label="Avg Studio sqft">
                    <NumberInput value={inputs.avgUnitSqft.br0} onChange={(n) => update("avgUnitSqft", { ...inputs.avgUnitSqft, br0: n })} step={25} min={0} />
                  </Field>
                  <Field label="Avg 1-BR sqft">
                    <NumberInput value={inputs.avgUnitSqft.br1} onChange={(n) => update("avgUnitSqft", { ...inputs.avgUnitSqft, br1: n })} step={50} min={0} />
                  </Field>
                  <Field label="Avg 2-BR sqft">
                    <NumberInput value={inputs.avgUnitSqft.br2} onChange={(n) => update("avgUnitSqft", { ...inputs.avgUnitSqft, br2: n })} step={50} min={0} />
                  </Field>
                  <Field label="Avg 3-BR sqft">
                    <NumberInput value={inputs.avgUnitSqft.br3} onChange={(n) => update("avgUnitSqft", { ...inputs.avgUnitSqft, br3: n })} step={50} min={0} />
                  </Field>
                </Grid>
              </Card>

              <Grid cols={inputs.unitsStudio > 0 ? 4 : 3}>
                {inputs.unitsStudio > 0 && (
                  <MetricCard
                    label="Studio heating load"
                    value={fmt(result.combi.heatingLoad_0BR)}
                    unit="BTU/hr"
                    sub={result.combi.heatingMetByHPWH_0BR ? "✓ HPWH only" : `+${fmt(result.combi.resistanceBackup_0BR, 1)}kW resist`}
                    accent={result.combi.heatingMetByHPWH_0BR ? "var(--accent-emerald)" : "var(--accent-amber)"}
                  />
                )}
                <MetricCard
                  label="1-BR heating load"
                  value={fmt(result.combi.heatingLoad_1BR)}
                  unit="BTU/hr"
                  sub={result.combi.heatingMetByHPWH_1BR ? "✓ HPWH only" : `+${fmt(result.combi.resistanceBackup_1BR, 1)}kW resist`}
                  accent={result.combi.heatingMetByHPWH_1BR ? "var(--accent-emerald)" : "var(--accent-amber)"}
                />
                <MetricCard
                  label="2-BR heating load"
                  value={fmt(result.combi.heatingLoad_2BR)}
                  unit="BTU/hr"
                  sub={result.combi.heatingMetByHPWH_2BR ? "✓ HPWH only" : `+${fmt(result.combi.resistanceBackup_2BR, 1)}kW resist`}
                  accent={result.combi.heatingMetByHPWH_2BR ? "var(--accent-emerald)" : "var(--accent-amber)"}
                />
                <MetricCard
                  label="3-BR heating load"
                  value={fmt(result.combi.heatingLoad_3BR)}
                  unit="BTU/hr"
                  sub={result.combi.heatingMetByHPWH_3BR ? "✓ HPWH only" : `+${fmt(result.combi.resistanceBackup_3BR, 1)}kW resist`}
                  accent={result.combi.heatingMetByHPWH_3BR ? "var(--accent-emerald)" : "var(--accent-amber)"}
                />
              </Grid>

              <Grid cols={3}>
                <MetricCard label="Building annual kWh" value={fmt(result.combi.combiTotalAnnualKWh)} accent="var(--accent-emerald)" />
                <MetricCard label="Building annual cost" value={fmtUSD(result.combi.combiTotalAnnualCost)} unit="/yr" accent="var(--accent-emerald)" />
                <MetricCard label="Diverse peak elec" value={fmt(result.combi.buildingPeakDemandKW_combi, 1)} unit="kW" sub={`${fmt(result.combi.perUnitElecDemand, 1)} kW/unit × 65%`} />
              </Grid>
            </>
          )}
        </>
      )}
    </div>
  );
}
