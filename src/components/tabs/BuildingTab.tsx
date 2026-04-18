"use client";

import { Info } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, NumberInput, SelectInput } from "@/components/ui/Field";
import { Grid } from "@/components/ui/Grid";
import {
  CLIMATE_DESIGN,
  HPWH_TIER_ADJUSTMENT,
  type ClimateZoneKey,
  type HPWHTier,
} from "@/lib/engineering/constants";
import { SYSTEM_TYPES, type SystemTypeKey } from "@/lib/engineering/system-types";
import { DEFAULT_FIXTURE_GPM, type DhwInputs, type FixtureGPM } from "@/lib/calc/inputs";

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
          <Field label="Inlet water temp" suffix="°F">
            <NumberInput value={inputs.inletWaterF} onChange={(n) => update("inletWaterF", n)} min={33} max={90} />
          </Field>
          <Field label="Storage setpoint" suffix="°F">
            <NumberInput value={inputs.storageSetpointF} onChange={(n) => update("storageSetpointF", n)} min={100} max={180} />
          </Field>
          <Field label="Delivery temp" suffix="°F">
            <NumberInput value={inputs.deliveryF} onChange={(n) => update("deliveryF", n)} min={100} max={140} />
          </Field>
        </Grid>
      </Card>

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
          </Grid>
        </Card>
      )}

      {sys.topology === "central" && (
        <Card>
          <CardHeader>
            <CardTitle>Heat Source Parameters</CardTitle>
          </CardHeader>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
            Technology-specific tunables. All three parameter groups are always shown so the
            Equipment tab can render an apples-to-apples comparison across gas, resistance, and
            HPWH — regardless of which heat source you actually selected.
          </p>
          <Grid cols={3}>
            <Field label="Gas efficiency" suffix="%" hint="Condensing 95–98%, near-condensing 90%, atmospheric 80–82%">
              <NumberInput
                value={Math.round(inputs.gasEfficiency * 100)}
                onChange={(n) => update("gasEfficiency", n / 100)}
                min={60}
                max={99}
              />
            </Field>
            <Field label="HPWH refrigerant">
              <SelectInput
                value={inputs.hpwhRefrigerant}
                onChange={(v) => update("hpwhRefrigerant", v)}
                options={[
                  { value: "CO2", label: "CO₂ (R744, transcritical)" },
                  { value: "HFC", label: "HFC (R134a/R513A/R454B)" },
                ]}
              />
            </Field>
            <Field
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
            </Field>
            <Field
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
            </Field>
          </Grid>
        </Card>
      )}

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
