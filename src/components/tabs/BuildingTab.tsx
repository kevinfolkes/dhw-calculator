"use client";

import { Info } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, NumberInput, SelectInput } from "@/components/ui/Field";
import { Grid } from "@/components/ui/Grid";
import {
  ASHRAE_APT_DEMAND,
  CASCADE_COST_PREMIUM_PER_BOILER,
  CASCADE_EFFICIENCY_BONUS_CAP,
  CASCADE_EFFICIENCY_BONUS_PER_BOILER,
  CENTRAL_BOILER_COST_FACTOR,
  CENTRAL_BOILER_DEFAULT_EFFICIENCY,
  CENTRAL_BOILER_LABEL,
  CLIMATE_DESIGN,
  DWHR_DRAIN_TEMP_F,
  HPWH_TIER_ADJUSTMENT,
  MONTH_DAYS,
  RECIRC_CONTROL_LABEL,
  cascadeCostPremium,
  cascadeEfficiencyBonus,
  type CascadeRedundancy,
  type CentralBoilerType,
  type ClimateZoneKey,
  type HPWHTier,
  type RecircControlMode,
} from "@/lib/engineering/constants";
import { recircControlMultiplier } from "@/lib/engineering/recirc";
import { deriveInletWaterF, getMonthlyHDDArchetype } from "@/lib/engineering/climate";
import {
  combinedPreheatLiftF,
  dwhrLiftF,
  solarMonthlyFraction,
} from "@/lib/engineering/preheat";
import { SYSTEM_TYPES, type SystemTypeKey } from "@/lib/engineering/system-types";
import {
  DEFAULT_FIXTURE_GPM,
  type DhwInputs,
  type FixtureGPM,
  type PreheatType,
} from "@/lib/calc/inputs";

interface Props {
  inputs: DhwInputs;
  update: <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => void;
}

export function BuildingTab({ inputs, update }: Props) {
  const sys = SYSTEM_TYPES[inputs.systemType];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card accent={sys.color}>
        <CardHeader>
          <CardTitle>System Type</CardTitle>
        </CardHeader>
        <Grid cols={1} gap={8}>
          <SelectInput<SystemTypeKey>
            value={inputs.systemType}
            onChange={(v) => update("systemType", v)}
            options={(Object.keys(SYSTEM_TYPES) as SystemTypeKey[]).map((k) => ({
              value: k,
              label: SYSTEM_TYPES[k].label,
            }))}
          />
          {(inputs.systemType === "inunit_gas_tank" ||
            inputs.systemType === "inunit_combi_gas") && (
            <Field
              label="Efficiency tier"
              hint={
                inputs.gasTankType === "condensing"
                  ? "Condensing (Cat IV direct-vent): PVC/CPVC/PP vent through exterior wall, condensate drain required. UEF 0.80–0.96."
                  : "Non-condensing (Cat I atmospheric or Cat III power-vent): UEF 0.60–0.70. For new construction ≥50 gal, atmospheric is restricted by federal UEF 0.81+ (2015 DOE rule) — Cat III power-vent is now standard."
              }
            >
              <SelectInput
                value={inputs.gasTankType}
                onChange={(v) => update("gasTankType", v)}
                options={[
                  { value: "condensing", label: "Condensing" },
                  { value: "atmospheric", label: "Non-condensing" },
                ]}
              />
            </Field>
          )}
          {sys.tech === "hpwh" && (
            <Field
              label="Efficiency tier"
              hint={`${HPWH_TIER_ADJUSTMENT[inputs.hpwhTier].description} ${HPWH_TIER_ADJUSTMENT[inputs.hpwhTier].uefRange}. Applied as a ${(HPWH_TIER_ADJUSTMENT[inputs.hpwhTier].copMultiplier * 100).toFixed(0)}% multiplier on the climate-derived COP.`}
            >
              <SelectInput<HPWHTier>
                value={inputs.hpwhTier}
                onChange={(v) => update("hpwhTier", v)}
                options={(Object.keys(HPWH_TIER_ADJUSTMENT) as HPWHTier[]).map((k) => ({
                  value: k,
                  label: `${HPWH_TIER_ADJUSTMENT[k].label} (${HPWH_TIER_ADJUSTMENT[k].uefRange})`,
                }))}
              />
            </Field>
          )}
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {sys.description}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Typical equipment: {sys.archetypes}
          </p>
        </Grid>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unit Mix</CardTitle>
        </CardHeader>
        <Grid cols={4}>
          <Field label="Studio units" hint="Efficiency / 0-BR">
            <NumberInput value={inputs.unitsStudio} onChange={(n) => update("unitsStudio", n)} min={0} />
          </Field>
          <Field label="1-BR units">
            <NumberInput value={inputs.units1BR} onChange={(n) => update("units1BR", n)} min={0} />
          </Field>
          <Field label="2-BR units">
            <NumberInput value={inputs.units2BR} onChange={(n) => update("units2BR", n)} min={0} />
          </Field>
          <Field label="3-BR units">
            <NumberInput value={inputs.units3BR} onChange={(n) => update("units3BR", n)} min={0} />
          </Field>
        </Grid>
      </Card>

      <FixtureGPMEditor
        inputs={inputs}
        update={update}
        isInUnit={SYSTEM_TYPES[inputs.systemType].topology === "inunit"}
        isTankless={inputs.systemType === "inunit_gas_tankless"}
      />

      <Card>
        <CardHeader>
          <CardTitle>Climate & Water Conditions</CardTitle>
        </CardHeader>
        <Grid cols={2}>
          <Field label="Climate zone" hint={`Design heating DB ${CLIMATE_DESIGN[inputs.climateZone].heatDB}°F, HDD65 ${CLIMATE_DESIGN[inputs.climateZone].hdd65.toLocaleString()}`}>
            <SelectInput<ClimateZoneKey>
              value={inputs.climateZone}
              onChange={(v) => update("climateZone", v)}
              options={Object.keys(CLIMATE_DESIGN).map((k) => ({ value: k as ClimateZoneKey, label: k }))}
            />
          </Field>
          <Field label="Occupancy profile">
            <SelectInput
              value={inputs.occupancyProfile}
              onChange={(v) => update("occupancyProfile", v)}
              options={[
                { value: "low", label: "Low (elderly/efficiency)" },
                { value: "medium", label: "Medium (market-rate)" },
                { value: "high", label: "High (family/luxury)" },
              ]}
            />
          </Field>
          <Field
            label="Inlet water temp"
            suffix="°F"
            hint={
              inputs.inletWaterF == null
                ? `${deriveInletWaterF(inputs.climateZone)}°F — annual mean for ${inputs.climateZone}`
                : "Manual override"
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SelectInput
                value={inputs.inletWaterF == null ? "auto" : "manual"}
                onChange={(v) =>
                  update(
                    "inletWaterF",
                    v === "auto" ? null : deriveInletWaterF(inputs.climateZone),
                  )
                }
                options={[
                  { value: "auto", label: "Auto from climate" },
                  { value: "manual", label: "Manual" },
                ]}
              />
              {inputs.inletWaterF == null ? (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    padding: "6px 10px",
                    background: "var(--surface-muted, rgba(0,0,0,0.04))",
                    borderRadius: 6,
                  }}
                >
                  {deriveInletWaterF(inputs.climateZone)}°F
                </div>
              ) : (
                <NumberInput
                  value={inputs.inletWaterF}
                  onChange={(n) => update("inletWaterF", n)}
                  min={33}
                  max={90}
                />
              )}
            </div>
          </Field>
          <Field label="Storage setpoint" suffix="°F">
            <NumberInput value={inputs.storageSetpointF} onChange={(n) => update("storageSetpointF", n)} min={100} max={180} />
          </Field>
          <Field label="Delivery temp" suffix="°F">
            <NumberInput value={inputs.deliveryF} onChange={(n) => update("deliveryF", n)} min={100} max={140} />
          </Field>
        </Grid>
      </Card>

      <PreheatCard inputs={inputs} update={update} />

      {sys.hasRecirc && (
        <Card>
          <CardHeader>
            <CardTitle>Recirculation Loop</CardTitle>
          </CardHeader>
          <Grid cols={2}>
            <Field label="Loop length (supply only)" suffix="ft">
              <NumberInput value={inputs.recircLoopLengthFt} onChange={(n) => update("recircLoopLengthFt", n)} min={0} />
            </Field>
            <Field label="Pipe insulation R-value">
              <NumberInput value={inputs.pipeInsulationR} onChange={(n) => update("pipeInsulationR", n)} min={0} max={12} step={0.5} />
            </Field>
            <Field label="Return temp" suffix="°F">
              <NumberInput value={inputs.recircReturnTempF} onChange={(n) => update("recircReturnTempF", n)} min={100} max={160} />
            </Field>
            <Field label="Pipe ambient" suffix="°F">
              <NumberInput value={inputs.ambientPipeF} onChange={(n) => update("ambientPipeF", n)} min={40} max={100} />
            </Field>
            <Field
              label="Recirculation control"
              hint={(() => {
                const m = recircControlMultiplier(
                  inputs.recircControl,
                  inputs.timeClockHoursPerDay,
                );
                const pct = (m * 100).toFixed(0);
                if (inputs.recircControl === "continuous") {
                  return `Pump runs 24/7 (multiplier ${m.toFixed(2)} = baseline). ASHRAE 90.1-2022 §6.5.5 typically requires non-continuous control for new construction.`;
                }
                if (inputs.recircControl === "demand") {
                  return `Flow-triggered pump runs only when a draw is sensed. Multiplier ${m.toFixed(2)} (~${pct}% of continuous loss). Source: SoCalGas / Taco / Watts pilot data.`;
                }
                if (inputs.recircControl === "aquastat") {
                  return `Pump modulates by return-loop temperature. Multiplier ${m.toFixed(2)} (~${pct}% of continuous loss).`;
                }
                return `Scheduled pump at ${inputs.timeClockHoursPerDay} hr/day. Multiplier (${inputs.timeClockHoursPerDay}/24)×0.75 = ${m.toFixed(2)} (~${pct}% of continuous loss). The 0.75 factor reflects savings beating strict pro-rata because schedules typically exclude overnight.`;
              })()}
            >
              <SelectInput<RecircControlMode>
                value={inputs.recircControl}
                onChange={(v) => update("recircControl", v)}
                options={(Object.keys(RECIRC_CONTROL_LABEL) as RecircControlMode[]).map((k) => ({
                  value: k,
                  label: RECIRC_CONTROL_LABEL[k],
                }))}
              />
            </Field>
            {inputs.recircControl === "time_clock" && (
              <Field
                label="Time-clock hours per day"
                suffix="hr/day"
                hint="Range 8–24. Default 16 → multiplier 0.50 at the spec baseline."
              >
                <NumberInput
                  value={inputs.timeClockHoursPerDay}
                  onChange={(n) => update("timeClockHoursPerDay", n)}
                  min={8}
                  max={24}
                  step={1}
                />
              </Field>
            )}
          </Grid>
        </Card>
      )}

      {sys.topology === "central" && (() => {
        // Heat-source parameters are gated by relevance so users only see
        // what applies to their selected system. The Equipment tab can still
        // render the gas / resistance / HPWH comparison using DEFAULT_INPUTS
        // for any heat source the user didn't tune.
        const showGasParams =
          inputs.systemType === "central_gas" ||
          inputs.systemType === "central_gas_tankless" ||
          inputs.systemType === "central_indirect" ||
          inputs.systemType === "central_hybrid" ||
          inputs.systemType === "central_steam_hx" ||
          inputs.systemType === "central_hrc";
        const showHpwhParams =
          inputs.systemType === "central_hpwh" ||
          inputs.systemType === "central_hybrid" ||
          inputs.systemType === "central_per_floor" ||
          inputs.systemType === "central_wastewater_hp";
        const showSwingTank = showHpwhParams || inputs.systemType === "central_hrc";
        // Per-floor adds zone count; HRC adds 3 fields (tons, year-round
        // fraction, HR COP) plus gas-backup fields (already in showGasParams);
        // wastewater adds source temp + COP. Track these so the heat-source
        // grid sizes appropriately.
        const showPerFloorParams = inputs.systemType === "central_per_floor";
        const showHrcParams = inputs.systemType === "central_hrc";
        const showWastewaterParams = inputs.systemType === "central_wastewater_hp";
        const numShown =
          (showGasParams ? 2 : 0) +
          (showHpwhParams ? 2 : 0) +
          (showSwingTank ? 1 : 0) +
          (showPerFloorParams ? 1 : 0) +
          (showHrcParams ? 3 : 0) +
          (showWastewaterParams ? 2 : 0);
        if (numShown === 0) return null; // central_resistance has nothing to tune here
        return (
        <Card>
          <CardHeader>
            <CardTitle>Heat Source Parameters</CardTitle>
          </CardHeader>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
            Tunables for the heat source(s) on this system type. Hidden fields stay
            at their defaults — switch to a different system type to see its tunables.
          </p>
          <Grid cols={Math.min(numShown, 3)}>
            {showGasParams && <Field
              label="Central boiler type"
              hint={`Drives the default efficiency shown below. ${CENTRAL_BOILER_LABEL.condensing} ~${(CENTRAL_BOILER_DEFAULT_EFFICIENCY.condensing * 100).toFixed(0)}%; ${CENTRAL_BOILER_LABEL.non_condensing} ~${(CENTRAL_BOILER_DEFAULT_EFFICIENCY.non_condensing * 100).toFixed(0)}%. Non-condensing also reduces installed cost by ~${Math.round((1 - CENTRAL_BOILER_COST_FACTOR.non_condensing) * 100)}%.`}
            >
              <SelectInput<CentralBoilerType>
                value={inputs.centralBoilerType}
                onChange={(v) => {
                  // Always reset gasEfficiency to the new type's default when
                  // boiler type changes — this is what users expect when they
                  // explicitly pick a boiler type. If they want a non-standard
                  // efficiency (e.g. 88% for a near-condensing unit) they can
                  // override it AFTER selecting the type.
                  update("gasEfficiency", CENTRAL_BOILER_DEFAULT_EFFICIENCY[v]);
                  update("centralBoilerType", v);
                }}
                options={[
                  { value: "condensing", label: CENTRAL_BOILER_LABEL.condensing },
                  { value: "non_condensing", label: CENTRAL_BOILER_LABEL.non_condensing },
                ]}
              />
            </Field>}
            {showGasParams && (
              <Field
                label="Boiler count (cascade)"
                hint={(() => {
                  const bonus = cascadeEfficiencyBonus(inputs.boilerCount);
                  const premium = cascadeCostPremium(inputs.boilerCount);
                  if (inputs.boilerCount <= 1) {
                    return `Single-boiler plant. Increase to model a cascade — each added boiler gives +${(CASCADE_EFFICIENCY_BONUS_PER_BOILER * 100).toFixed(0)}% seasonal-efficiency uplift (capped at +${(CASCADE_EFFICIENCY_BONUS_CAP * 100).toFixed(0)}%) and +${(CASCADE_COST_PREMIUM_PER_BOILER * 100).toFixed(0)}% installed-cost premium for the manifold/controls.`;
                  }
                  return `Cascade of ${inputs.boilerCount} boilers. +${(bonus * 100).toFixed(1)}% seasonal-efficiency uplift; ×${premium.toFixed(2)} cost premium for manifold + controls.`;
                })()}
              >
                <NumberInput
                  value={inputs.boilerCount}
                  onChange={(n) => update("boilerCount", n)}
                  min={1}
                  max={8}
                />
              </Field>
            )}
            {showGasParams && (
              <Field
                label="Cascade redundancy"
                hint={
                  inputs.cascadeRedundancy === "N+1"
                    ? `N+1: total installed capacity grossed up so any (${inputs.boilerCount}-1)=${Math.max(0, inputs.boilerCount - 1)} boilers cover design load. Standard for critical multifamily DHW (50+ units).`
                    : "N: installed capacity equals design duty (no redundancy). Acceptable for smaller plants where downtime during a single-boiler failure is tolerable."
                }
              >
                <SelectInput<CascadeRedundancy>
                  value={inputs.cascadeRedundancy}
                  onChange={(v) => update("cascadeRedundancy", v)}
                  options={[
                    { value: "N", label: "N (no redundancy)" },
                    { value: "N+1", label: "N+1 (one spare boiler)" },
                  ]}
                />
              </Field>
            )}
            {showGasParams && <Field
              label="Gas efficiency (manual override)"
              suffix="%"
              hint={(() => {
                const def = CENTRAL_BOILER_DEFAULT_EFFICIENCY[inputs.centralBoilerType];
                const current = inputs.gasEfficiency;
                const isDefault = Math.abs(current - def) < 0.005;
                return isDefault
                  ? `Default for ${CENTRAL_BOILER_LABEL[inputs.centralBoilerType]}: ${(def * 100).toFixed(0)}% (matches current)`
                  : `Default for ${CENTRAL_BOILER_LABEL[inputs.centralBoilerType]}: ${(def * 100).toFixed(0)}% — current ${(current * 100).toFixed(0)}% is a manual override`;
              })()}
            >
              <NumberInput
                value={Math.round(inputs.gasEfficiency * 100)}
                onChange={(n) => update("gasEfficiency", n / 100)}
                min={60}
                max={99}
              />
            </Field>}
            {showHpwhParams && <Field label="HPWH refrigerant">
              <SelectInput
                value={inputs.hpwhRefrigerant}
                onChange={(v) => update("hpwhRefrigerant", v)}
                options={[
                  { value: "CO2", label: "CO₂ (R744, transcritical)" },
                  { value: "HFC", label: "HFC (R134a/R513A/R454B)" },
                ]}
              />
            </Field>}
            {showHpwhParams && <Field
              label="HPWH design ambient"
              suffix="°F"
              hint={
                inputs.hpwhAmbientF == null
                  ? "Auto from climate mech-room annual avg"
                  : "Manual override"
              }
            >
              <NumberInput
                value={inputs.hpwhAmbientF ?? CLIMATE_DESIGN[inputs.climateZone].mechRoomAnnual}
                onChange={(n) => update("hpwhAmbientF", n)}
                min={-20}
                max={110}
              />
            </Field>}
            {showSwingTank && <Field
              label="Swing tank"
              hint="Electric-resistance boost for recirc losses + Legionella disinfection"
            >
              <SelectInput
                value={inputs.swingTankEnabled ? "yes" : "no"}
                onChange={(v) => update("swingTankEnabled", v === "yes")}
                options={[
                  { value: "yes", label: "Enabled" },
                  { value: "no", label: "Disabled" },
                ]}
              />
            </Field>}
            {showPerFloorParams && (
              <Field
                label="Per-floor / per-stack zone count"
                hint="Number of independent HPWH plants serving the building. Each zone serves totalUnits/zoneCount and runs its own short recirc loop. Range 2–20; default 4 = one plant per floor on a 4-story mid-rise."
              >
                <NumberInput
                  value={inputs.perFloorZoneCount}
                  onChange={(n) => update("perFloorZoneCount", n)}
                  min={2}
                  max={20}
                  step={1}
                />
              </Field>
            )}
            {showHrcParams && (
              <Field
                label="Cooling tonnage"
                suffix="tons"
                hint="Total building cooling tonnage. Drives the HRC's available heat-recovery capacity. Range 10–500; data centers + large mixed-use are at the high end."
              >
                <NumberInput
                  value={inputs.hrcCoolingTons}
                  onChange={(n) => update("hrcCoolingTons", n)}
                  min={10}
                  max={500}
                  step={5}
                />
              </Field>
            )}
            {showHrcParams && (
              <Field
                label="Year-round cooling fraction"
                hint="Fraction of cooling load running year-round (1.0 = data center, ~0.6 = mixed-use w/ retail, ~0.3 = residential AC). This drives DHW recovery availability. Range 0.0–1.0."
              >
                <NumberInput
                  value={inputs.hrcYearRoundCoolingFraction}
                  onChange={(n) => update("hrcYearRoundCoolingFraction", n)}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </Field>
            )}
            {showHrcParams && (
              <Field
                label="HR-mode COP"
                hint="Combined cooling+heating COP when running in heat-recovery mode. Heat rejected to DHW per BTU of cooling = COP/(COP-1). Range 2.5–6.0; default 4.0 reflects a typical CenTraVac / AquaForce."
              >
                <NumberInput
                  value={inputs.hrcCOPHeatRecovery}
                  onChange={(n) => update("hrcCOPHeatRecovery", n)}
                  min={2.5}
                  max={6}
                  step={0.1}
                />
              </Field>
            )}
            {showWastewaterParams && (
              <Field
                label="Wastewater source temp"
                suffix="°F"
                hint="Average sewer/wastewater temperature at the building tap. Stable year-round (~55–65°F). Range 50–70°F. Residential bias toward shower-heated water keeps the sewer warm."
              >
                <NumberInput
                  value={inputs.wastewaterSourceTempF}
                  onChange={(n) => update("wastewaterSourceTempF", n)}
                  min={50}
                  max={70}
                  step={1}
                />
              </Field>
            )}
            {showWastewaterParams && (
              <Field
                label="Wastewater HPWH COP"
                hint="Heat pump COP at the wastewater source temperature. Higher than air-source HPWH because the source is warm + stable. Range 3.0–6.0; default 4.5 reflects typical SHARC / Huber field data."
              >
                <NumberInput
                  value={inputs.wastewaterCOP}
                  onChange={(n) => update("wastewaterCOP", n)}
                  min={3}
                  max={6}
                  step={0.1}
                />
              </Field>
            )}
          </Grid>
        </Card>
        );
      })()}

      <Card>
        <CardHeader>
          <CardTitle>Utility Rates & Grid</CardTitle>
        </CardHeader>
        <Grid cols={2}>
          <Field label="Electric rate" suffix="$/kWh">
            <NumberInput value={inputs.elecRate} onChange={(n) => update("elecRate", n)} step={0.01} min={0} />
          </Field>
          <Field label="Gas rate" suffix="$/therm">
            <NumberInput value={inputs.gasRate} onChange={(n) => update("gasRate", n)} step={0.05} min={0} />
          </Field>
          <Field label="eGRID subregion">
            <SelectInput
              value={inputs.gridSubregion}
              onChange={(v) => update("gridSubregion", v)}
              options={[
                { value: "CAMX (CA)", label: "CAMX — California" },
                { value: "NWPP (PNW)", label: "NWPP — Pacific NW" },
                { value: "RMPA (Rockies)", label: "RMPA — Rockies" },
                { value: "ERCT (TX)", label: "ERCT — Texas" },
                { value: "MROW (Upper MW)", label: "MROW — Upper Midwest" },
                { value: "RFCE (Mid-Atl)", label: "RFCE — Mid-Atlantic" },
                { value: "NYUP (Upstate NY)", label: "NYUP — Upstate NY" },
                { value: "NEWE (New England)", label: "NEWE — New England" },
                { value: "SRSO (Southeast)", label: "SRSO — Southeast" },
                { value: "FRCC (FL)", label: "FRCC — Florida" },
                { value: "Custom", label: "Custom factor" },
              ]}
            />
          </Field>
          {inputs.gridSubregion === "Custom" && (
            <Field label="Custom EF" suffix="lb CO₂/kWh">
              <NumberInput value={inputs.customEF} onChange={(n) => update("customEF", n)} step={0.01} min={0} />
            </Field>
          )}
        </Grid>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Fixture flow rate editor (moved from Demand tab). Defaults are WaterSense /
// 2021 IPC values; these flows drive the tankless peak-demand calculation on
// the pipeline (top-N fixtures by flow × 85% simultaneity derate).
// -----------------------------------------------------------------------------
const FIXTURE_LABEL: Record<keyof FixtureGPM, string> = {
  lavatory: "Bathroom sink",
  kitchen: "Kitchen sink",
  shower: "Shower",
  tub: "Tub",
  dishwasher: "Dishwasher",
  washer: "Clothes washer",
};

const FIXTURE_HINT: Record<keyof FixtureGPM, string> = {
  lavatory: "WaterSense faucet cap 0.5 GPM",
  kitchen: "Low-flow aerator typical 1.5 GPM",
  shower: "Federal max 2.5, WaterSense 1.8",
  tub: "Tub spout full flow ~4 GPM",
  dishwasher: "Hot-fill rate, residential",
  washer: "Hot-fill rate, residential",
};

function FixtureGPMEditor({
  inputs,
  update,
  isInUnit,
  isTankless,
}: {
  inputs: DhwInputs;
  update: <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => void;
  isInUnit: boolean;
  isTankless: boolean;
}) {
  const setOne = (key: keyof FixtureGPM, value: number) =>
    update("fixtureGPM", { ...inputs.fixtureGPM, [key]: value });
  const isOverridden = (key: keyof FixtureGPM) => inputs.fixtureGPM[key] !== DEFAULT_FIXTURE_GPM[key];
  const anyOverridden = (Object.keys(DEFAULT_FIXTURE_GPM) as Array<keyof FixtureGPM>).some(isOverridden);

  // Preview: mirrors the top-N selection the pipeline does for tankless peak-demand
  const sortedFlows = (Object.keys(inputs.fixtureGPM) as Array<keyof FixtureGPM>)
    .map((k) => ({ key: k, gpm: inputs.fixtureGPM[k] }))
    .sort((a, b) => b.gpm - a.gpm);
  const N = Math.max(1, Math.min(inputs.tanklessSimultaneousFixtures, sortedFlows.length));
  const selected = sortedFlows.slice(0, N);
  const sum = selected.reduce((s, r) => s + r.gpm, 0);
  const peakGPM = sum * 0.85;

  const previewLabel = isTankless
    ? "Tankless peak preview"
    : "Peak instantaneous preview (used on Current Design burst check)";
  const roleDescription = isTankless
    ? "directly size tankless capacity-at-rise"
    : isInUnit
    ? "a secondary burst-flow sanity check on the Current Design tab (can the tank supply this simultaneous flow?)"
    : "only the per-fixture WSFU table in Methodology; central sizing uses aggregate peak-hour GPH instead";

  return (
    <Card accent={isTankless ? "var(--accent-violet)" : undefined}>
      <CardHeader>
        <CardTitle>
          Fixture Flow Rates{isTankless ? " (drives tankless sizing)" : ""}
        </CardTitle>
      </CardHeader>

      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-secondary)",
          lineHeight: 1.65,
          marginBottom: 10,
        }}
      >
        Per-fixture hot-water flow (GPM). Defaults are WaterSense / 2021&nbsp;IPC values — override
        with measured or spec&rsquo;d values if you have them. The top-N fixtures by flow × 85%
        simultaneity derate drives <strong>{roleDescription}</strong>.
        {anyOverridden && (
          <button
            className="ve-btn ve-btn-secondary"
            style={{ marginLeft: 12, padding: "2px 10px", fontSize: 11 }}
            onClick={() => update("fixtureGPM", { ...DEFAULT_FIXTURE_GPM })}
          >
            Reset to defaults
          </button>
        )}
      </div>

      <Grid cols={3}>
        {(Object.keys(DEFAULT_FIXTURE_GPM) as Array<keyof FixtureGPM>).map((k) => (
          <Field
            key={k}
            label={FIXTURE_LABEL[k]}
            suffix="GPM"
            hint={isOverridden(k) ? `Default: ${DEFAULT_FIXTURE_GPM[k]} GPM` : FIXTURE_HINT[k]}
          >
            <NumberInput
              value={inputs.fixtureGPM[k]}
              onChange={(n) => setOne(k, n)}
              step={0.1}
              min={0}
            />
          </Field>
        ))}
      </Grid>

      {isInUnit && (
        <>
          <div style={{ marginTop: 12, maxWidth: 240 }}>
            <Field label="Simultaneous fixtures (peak burst)" hint="How many fixtures the model assumes draw at once. 2 is typical single-apt peak; 3+ is conservative.">
              <NumberInput
                value={inputs.tanklessSimultaneousFixtures}
                onChange={(n) => update("tanklessSimultaneousFixtures", n)}
                min={1}
                max={6}
              />
            </Field>
          </div>
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              background: "var(--accent-violet-bg)",
              borderLeft: "3px solid var(--accent-violet)",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--accent-violet)", marginBottom: 6 }}>
              <Info size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              {previewLabel} — top {N} fixtures × 85% simultaneity
            </div>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
              {selected.map((s, i) => (
                <span key={s.key}>
                  {i > 0 && <span style={{ color: "var(--text-muted)" }}> + </span>}
                  {FIXTURE_LABEL[s.key]} {s.gpm.toFixed(1)}
                </span>
              ))}
              <span style={{ color: "var(--text-muted)" }}> = </span>
              <strong>{sum.toFixed(1)} GPM</strong>
              <span style={{ color: "var(--text-muted)" }}> × 0.85 = </span>
              <strong style={{ color: "var(--accent-violet)" }}>{peakGPM.toFixed(1)} GPM</strong>
              <span style={{ color: "var(--text-muted)" }}> peak</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Preheat modifiers (Phase D) — solar thermal + drainwater heat recovery.
// Architectural addition that lifts effective inlet water temp before any
// primary system runs. Default "none" preserves baseline behavior.
// -----------------------------------------------------------------------------
function PreheatCard({
  inputs,
  update,
}: {
  inputs: DhwInputs;
  update: <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => void;
}) {
  const isSolar = inputs.preheat === "solar" || inputs.preheat === "solar+dwhr";
  const isDwhr = inputs.preheat === "dwhr" || inputs.preheat === "solar+dwhr";
  const active = inputs.preheat !== "none";

  // Live preview of the annual-average lift (so the user sees impact before
  // the rest of the calc tabs render). Mirrors the pipeline math exactly:
  // - solar uses energy-weighted SF across all 12 months
  // - dwhr is constant lift on the base inlet
  // - combined uses the 0.95 × ΔT cap
  const baseInletF = inputs.inletWaterF ?? deriveInletWaterF(inputs.climateZone);
  const archetype = getMonthlyHDDArchetype(inputs.climateZone);
  const totalUnits =
    inputs.unitsStudio + inputs.units1BR + inputs.units2BR + inputs.units3BR;
  const avgDayDemand = ASHRAE_APT_DEMAND[inputs.occupancyProfile].avg * totalUnits;
  let annualLiftF = 0;
  let annualSF = 0;
  if (active) {
    const setpoint = inputs.storageSetpointF;
    let solarLift = 0;
    if (isSolar) {
      let collected = 0;
      let total = 0;
      for (let m = 0; m < 12; m++) {
        const monthDHW = avgDayDemand * 8.33 * Math.max(0, setpoint - baseInletF) * MONTH_DAYS[m];
        const sf = solarMonthlyFraction(
          m, inputs.solarCollectorAreaSqft, archetype, monthDHW, MONTH_DAYS[m],
        );
        collected += sf * monthDHW;
        total += monthDHW;
      }
      annualSF = total > 0 ? collected / total : 0;
      solarLift = annualSF * Math.max(0, setpoint - baseInletF);
    }
    const dwhrL = isDwhr
      ? dwhrLiftF(inputs.dwhrEffectiveness, inputs.dwhrCoverage, DWHR_DRAIN_TEMP_F, baseInletF)
      : 0;
    annualLiftF = combinedPreheatLiftF(solarLift, dwhrL, setpoint, baseInletF);
  }

  return (
    <Card accent={active ? "var(--accent-amber, #d97706)" : undefined}>
      <CardHeader>
        <CardTitle>Preheat (Solar / DWHR)</CardTitle>
      </CardHeader>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.6 }}>
        Optional pre-heaters that lift the cold-water inlet before any DHW system runs.
        Solar uses a glazed flat-plate collector array + storage tank; DWHR uses a
        vertical falling-film heat exchanger on the drain stack. Both apply uniformly
        to every system type.
      </p>
      <Grid cols={2}>
        <Field
          label="Preheat configuration"
          hint="None = baseline. Solar = collector array. DWHR = drainwater heat recovery. Solar+DWHR stacks both with a 0.95 × ΔT combined cap."
        >
          <SelectInput<PreheatType>
            value={inputs.preheat}
            onChange={(v) => update("preheat", v)}
            options={[
              { value: "none", label: "None" },
              { value: "solar", label: "Solar thermal" },
              { value: "dwhr", label: "DWHR (drainwater heat recovery)" },
              { value: "solar+dwhr", label: "Solar + DWHR" },
            ]}
          />
        </Field>
      </Grid>

      {isSolar && (
        <Grid cols={2}>
          <Field
            label="Solar collector area"
            suffix="ft²"
            hint="Total aperture area of the flat-plate collector array. Multifamily systems range 100–800 ft² depending on occupancy."
          >
            <NumberInput
              value={inputs.solarCollectorAreaSqft}
              onChange={(n) => update("solarCollectorAreaSqft", n)}
              min={0}
              max={5000}
              step={10}
            />
          </Field>
          <Field
            label="Solar storage tank"
            suffix="gal"
            hint="Solar storage tank volume — informational at current modeling fidelity. Range 40–500."
          >
            <NumberInput
              value={inputs.solarStorageGal}
              onChange={(n) => update("solarStorageGal", n)}
              min={40}
              max={2000}
              step={10}
            />
          </Field>
        </Grid>
      )}

      {isDwhr && (
        <Grid cols={2}>
          <Field
            label="DWHR effectiveness"
            hint="Fraction of (drainTemp − inlet) ΔT recovered. CSA B55.2 vertical units rate 0.40–0.60; 0.50 typical."
          >
            <NumberInput
              value={inputs.dwhrEffectiveness}
              onChange={(n) => update("dwhrEffectiveness", n)}
              min={0}
              max={1}
              step={0.05}
            />
          </Field>
          <Field
            label="DWHR coverage"
            hint="Fraction of fixtures plumbed through the DWHR unit. Showers benefit; sinks rarely. Range 0–1."
          >
            <NumberInput
              value={inputs.dwhrCoverage}
              onChange={(n) => update("dwhrCoverage", n)}
              min={0}
              max={1}
              step={0.05}
            />
          </Field>
        </Grid>
      )}

      {active && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            background: "var(--accent-amber-bg, rgba(217, 119, 6, 0.08))",
            borderLeft: "3px solid var(--accent-amber, #d97706)",
            borderRadius: 8,
            fontSize: 12.5,
            color: "var(--text-primary)",
          }}
        >
          <strong>
            Effective inlet lifted +{annualLiftF.toFixed(1)}°F annual avg
          </strong>{" "}
          <span style={{ color: "var(--text-secondary)" }}>
            (base {baseInletF}°F → preheated {(baseInletF + annualLiftF).toFixed(1)}°F)
          </span>
          {isSolar && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, marginTop: 4, color: "var(--text-secondary)" }}>
              Annual solar fraction: {(annualSF * 100).toFixed(1)}% (cap 85%)
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
