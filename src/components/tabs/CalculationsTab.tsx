"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { fmt, fmtUSD } from "@/lib/utils";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import {
  ASHRAE_APT_DEMAND,
  ENVELOPE_PRESETS,
  GAS_TANKLESS_WH,
  HPWH_TIER_ADJUSTMENT,
  INUNIT_RESISTANCE_TANK_SPEC,
  WSFU,
} from "@/lib/engineering/constants";
import { UNIT_FIXTURE_MIX } from "@/lib/calc/demand";
import type { DhwInputs, FixtureGPM } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";

interface Props {
  inputs: DhwInputs;
  result: CalcResult;
}

interface FixtureMix {
  lavatory: number;
  kitchen: number;
  shower: number;
  tub: number;
  dishwasher: number;
  washer: number;
}

/**
 * Step-by-step walkthrough of the full calculation pipeline, substituting
 * the user's current inputs into every formula. Designed to let an engineer
 * read the calculator as a worked example — you should be able to verify
 * each line by hand against ASHRAE / Hunter / ASPE references.
 */
export function CalculationsTab({ inputs, result }: Props) {
  const sys = SYSTEM_TYPES[inputs.systemType];
  const isCentral = sys.topology === "central";
  const isCentralTankless = inputs.systemType === "central_gas_tankless";
  const isCentralIndirect = inputs.systemType === "central_indirect";
  const isCentralHybrid = inputs.systemType === "central_hybrid";
  const isCentralSteamHX = inputs.systemType === "central_steam_hx";
  const isCentralPerFloor = inputs.systemType === "central_per_floor";
  const isCentralHRC = inputs.systemType === "central_hrc";
  const isCentralWastewaterHP = inputs.systemType === "central_wastewater_hp";
  const isGasTank = inputs.systemType === "inunit_gas_tank";
  const isGasCombi = inputs.systemType === "inunit_combi_gas";
  const isGasTankless = inputs.systemType === "inunit_gas_tankless";
  const isGasTanklessCombi = inputs.systemType === "inunit_combi_gas_tankless";
  const isResistance = inputs.systemType === "inunit_resistance";
  const isResistanceCombi = inputs.systemType === "inunit_combi_resistance";
  const isHPWHInUnit =
    inputs.systemType === "inunit_hpwh" || inputs.systemType === "inunit_combi";
  const hasHeating = sys.hasSpaceHeating;

  const profile = ASHRAE_APT_DEMAND[inputs.occupancyProfile];
  const mix = {
    br0: UNIT_FIXTURE_MIX.br0,
    br1: UNIT_FIXTURE_MIX.br1,
    br2: UNIT_FIXTURE_MIX.br2,
    br3: UNIT_FIXTURE_MIX.br3,
  };

  // Per-unit-type WSFU breakdown for transparency
  const wsfuOf = (m: FixtureMix) =>
    WSFU.lavatory * m.lavatory +
    WSFU.kitchen * m.kitchen +
    WSFU.shower * m.shower +
    WSFU.tub * m.tub +
    WSFU.dishwasher * m.dishwasher +
    WSFU.washer * m.washer;
  const wsfu_br0 = wsfuOf(mix.br0);
  const wsfu_br1 = wsfuOf(mix.br1);
  const wsfu_br2 = wsfuOf(mix.br2);
  const wsfu_br3 = wsfuOf(mix.br3);

  // Fixture GPM sorted for top-N preview
  const sortedFlows = (Object.keys(inputs.fixtureGPM) as Array<keyof FixtureGPM>)
    .map((k) => ({ key: k, gpm: inputs.fixtureGPM[k] }))
    .sort((a, b) => b.gpm - a.gpm);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* INTRO */}
      <Card accent="var(--accent-blue)">
        <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "var(--text-primary)" }}>
          <strong>Calculations</strong> is a worked example. Every formula the pipeline runs is
          shown below with your current inputs substituted in — so you can trace any output back
          to its inputs, verify the math against ASHRAE / Hunter / ASPE, or hand-check a specific
          result before signing a design. The <strong>Methodology</strong> tab documents the
          formulas in abstract; this tab shows them plugged in.
        </p>
      </Card>

      {/* 01 BUILDING TOTALS */}
      <Step n={1} title="Building totals">
        <Prose>
          Unit counts and occupancy inputs roll up into two numbers that drive every downstream
          demand method: <Em>total units</Em> (for ASHRAE) and <Em>total occupants</Em> (for
          Occupancy).
        </Prose>
        <Formula>total_units = unitsStudio + units1BR + units2BR + units3BR</Formula>
        <Sub>
          {fmt(inputs.unitsStudio)} + {fmt(inputs.units1BR)} + {fmt(inputs.units2BR)} +{" "}
          {fmt(inputs.units3BR)} = <Result>{fmt(result.totalUnits)}</Result> units
        </Sub>
        <Formula>
          total_occupants = unitsStudio·occ_br0 + units1BR·occ_br1 + units2BR·occ_br2 +
          units3BR·occ_br3
        </Formula>
        <Sub>
          {fmt(inputs.unitsStudio)}·{inputs.occupantsPerUnit.br0} +{" "}
          {fmt(inputs.units1BR)}·{inputs.occupantsPerUnit.br1} +{" "}
          {fmt(inputs.units2BR)}·{inputs.occupantsPerUnit.br2} +{" "}
          {fmt(inputs.units3BR)}·{inputs.occupantsPerUnit.br3} ={" "}
          <Result>{fmt(result.totalOccupants)}</Result> occupants
        </Sub>
      </Step>

      {/* 02 CLIMATE + WATER BASIS */}
      <Step n={2} title="Climate + water temperature basis">
        <Prose>
          Climate zone selection sets four engineering temperatures used downstream: heating design
          day (for Manual J), annual average ambient (for HPWH COP), mech-room annual average (for
          HPWH indoor derate), and HDD65 (for annual heating hours).
        </Prose>
        <KVList
          rows={[
            [`Climate zone`, inputs.climateZone],
            [`Heating design DB`, `${result.climate.heatDB}°F`],
            [`Avg annual ambient`, `${result.climate.avgAnnual}°F`],
            [`Mech-room annual avg`, `${result.climate.mechRoomAnnual}°F`],
            [`HDD65`, `${fmt(result.climate.hdd65)} °F·day`],
          ]}
        />
        <Prose>The water-side temperatures define storage rise and the tempering multiplier:</Prose>
        <Formula>
          rise = storageSetpoint − inletWater = {inputs.storageSetpointF}°F − {result.effectiveInletF}°F
          {inputs.inletWaterF == null && " (auto from climate)"}
          = <Result>{fmt(result.temperatureRise)}</Result> °F
        </Formula>
        <Formula>
          temper_mult = (storage − inlet) ÷ (delivery − inlet) ={" "}
          ({inputs.storageSetpointF} − {result.effectiveInletF}) ÷ ({inputs.deliveryF} −{" "}
          {result.effectiveInletF}) = <Result>{result.temperMultiplier.toFixed(3)}</Result>
        </Formula>
        <Prose>
          The temper multiplier converts stored-water volume into delivered-water volume at the
          fixture. A 400-gal tank stored at 140°F with 120°F delivery and 50°F inlet yields{" "}
          {result.temperMultiplier.toFixed(2)} × 400 = {Math.round(400 * result.temperMultiplier)}{" "}
          gal of usable 120°F water.
        </Prose>
      </Step>

      {result.preheatType !== "none" && (
        <Step n={2} title={`Preheat lift — ${result.preheatType}`} subtitle="Phase D modifier">
          <Prose>
            Preheat raises the effective cold-water inlet before the primary system runs.
            Solar contributes a monthly fraction (collected BTU ÷ monthly DHW BTU, capped
            at 85%); DWHR adds a constant lift driven by drain temp − inlet ΔT × effectiveness
            × coverage. The combined annual lift is bounded at 0.95 × (setpoint − base inlet).
          </Prose>
          {(result.preheatType === "solar" || result.preheatType === "solar+dwhr") && (
            <Formula>
              SF<sub>annual</sub> = Σ (SF<sub>m</sub> × DHW<sub>m</sub>) ÷ Σ DHW<sub>m</sub> ={" "}
              <Result>{(result.annualSolarFraction * 100).toFixed(1)}%</Result>
            </Formula>
          )}
          {(result.preheatType === "dwhr" || result.preheatType === "solar+dwhr") && (
            <Formula>
              DWHR lift = eff × coverage × (drainTemp − inletBase) ={" "}
              {inputs.dwhrEffectiveness.toFixed(2)} × {inputs.dwhrCoverage.toFixed(2)} × (95 −{" "}
              {(result.effectiveInletF - result.annualPreheatLiftF).toFixed(1)}) ={" "}
              <Result>+{result.annualDwhrLiftF.toFixed(1)}°F</Result>
            </Formula>
          )}
          <Formula>
            inlet<sub>effective</sub> = inlet<sub>base</sub> + lift<sub>preheat</sub> ={" "}
            {(result.effectiveInletF - result.annualPreheatLiftF).toFixed(1)} + {result.annualPreheatLiftF.toFixed(1)} ={" "}
            <Result>{result.effectiveInletF.toFixed(1)}°F</Result>
          </Formula>
          <Prose>
            All downstream sizing math (recovery rise, tank capacity, monthly energy) uses
            this lifted inlet. The reduction in primary thermal load is exactly the share
            the preheat covered.
          </Prose>
        </Step>
      )}

      {/* 03 DEMAND — ASHRAE */}
      <Step n={3} title="Demand — ASHRAE Ch. 51 Table 7 (apt-count)">
        <Prose>
          ASHRAE uses a calibrated lookup of per-apartment peak-hour GPH by occupancy profile.
          Your profile is <Em>{inputs.occupancyProfile}</Em> → {profile.mh} GPH/apt.
        </Prose>
        <Formula>ashrae_MH = totalUnits × profile.mh</Formula>
        <Sub>
          {fmt(result.totalUnits)} × {profile.mh} = <Result>{fmt(result.demandASHRAE_MH)}</Result>{" "}
          GPH
        </Sub>
        <Prose>
          Peak-day and average-day scale the same way via <code>profile.md</code> ={" "}
          {profile.md} GPD/apt and <code>profile.avg</code> = {profile.avg} GPD/apt.
        </Prose>
      </Step>

      {/* 04 DEMAND — HUNTER / ASPE */}
      <Step n={4} title="Demand — Hunter / ASPE Modified (fixture units)">
        <Prose>
          Hunter aggregates Water Supply Fixture Units (WSFU, IPC Table 604.3 hot column), converts
          the sum to GPM via a piecewise curve fit, and applies a building-size diversity factor.
        </Prose>
        <Formula>
          wsfu_per_unit = lav·{WSFU.lavatory} + kitchen·{WSFU.kitchen} + shower·{WSFU.shower} +
          tub·{WSFU.tub} + dishwasher·{WSFU.dishwasher} + washer·{WSFU.washer}
        </Formula>
        <KVList
          rows={[
            [
              "Studio",
              `${formatMix(mix.br0)} = ${wsfu_br0.toFixed(2)} WSFU × ${fmt(
                inputs.unitsStudio,
              )} = ${(wsfu_br0 * inputs.unitsStudio).toFixed(2)}`,
            ],
            [
              "1-BR",
              `${formatMix(mix.br1)} = ${wsfu_br1.toFixed(2)} WSFU × ${fmt(
                inputs.units1BR,
              )} = ${(wsfu_br1 * inputs.units1BR).toFixed(2)}`,
            ],
            [
              "2-BR",
              `${formatMix(mix.br2)} = ${wsfu_br2.toFixed(2)} WSFU × ${fmt(
                inputs.units2BR,
              )} = ${(wsfu_br2 * inputs.units2BR).toFixed(2)}`,
            ],
            [
              "3-BR",
              `${formatMix(mix.br3)} = ${wsfu_br3.toFixed(2)} WSFU × ${fmt(
                inputs.units3BR,
              )} = ${(wsfu_br3 * inputs.units3BR).toFixed(2)}`,
            ],
          ]}
        />
        <Formula>
          total_WSFU = <Result>{fmt(result.hotWSFU, 2)}</Result>
        </Formula>
        <Prose>Piecewise Hunter curve (ASPE Modified, low-flow):</Prose>
        <KVList
          rows={[
            ["WSFU < 3", "GPM = 2.5 + 0.8·WSFU"],
            ["3 ≤ WSFU < 20", "GPM = 5 + 1.1·√WSFU"],
            ["20 ≤ WSFU < 100", "GPM = 8 + 1.8·√WSFU"],
            ["100 ≤ WSFU < 500", "GPM = 15 + 2.2·√WSFU"],
            ["WSFU ≥ 500", "GPM = 25 + 2.5·√WSFU"],
          ]}
        />
        <Formula>
          peak_GPM = <Result>{fmt(result.peakGPM_modified, 2)}</Result> GPM (classical:{" "}
          {fmt(result.peakGPM_classical, 2)})
        </Formula>
        <Prose>
          Diversity factor is 80% below 30 WSFU, 65% below 100, 55% above. At{" "}
          {fmt(result.hotWSFU, 1)} WSFU, diversity ={" "}
          <strong>{(result.diversityFactor * 100).toFixed(0)}%</strong>.
        </Prose>
        <Formula>
          hunter_MH = peak_GPM × 60 × diversity = {fmt(result.peakGPM_modified, 2)} × 60 ×{" "}
          {result.diversityFactor.toFixed(2)} ={" "}
          <Result>{fmt(result.demandHunter_MH)}</Result> GPH
        </Formula>
        {result.totalUnits < 10 && (
          <Callout tone="warn">
            Hunter/ASPE is calibrated for population-scale co-use. At{" "}
            {result.totalUnits} {result.totalUnits === 1 ? "apartment" : "apartments"}, the method
            overstates peak by 10–30×. The AgreementDiagnostic on the Demand tab flags this.
          </Callout>
        )}
      </Step>

      {/* 05 DEMAND — OCCUPANCY */}
      <Step n={5} title="Demand — Occupancy (gpcd)">
        <Prose>
          The occupancy method assumes {inputs.gpcd} gallons of hot water per capita per day (gpcd),
          with 25% of that volume falling in the peak hour.
        </Prose>
        <Formula>
          occupancy_MH = totalOccupants × gpcd × 25% = {fmt(result.totalOccupants)} ×{" "}
          {inputs.gpcd} × 0.25 = <Result>{fmt(result.demandOccupancy_MH)}</Result> GPH
        </Formula>
      </Step>

      {/* 06 GOVERNING DEMAND */}
      <Step n={6} title="Governing demand — downstream sizing basis">
        <Prose>
          You selected <Em>{methodLabel(inputs.demandMethod)}</Em> as the governing method. These
          values are the baton handed to storage, recovery, and annual energy:
        </Prose>
        <KVList
          rows={[
            ["Peak hour (drives storage + recovery)", `${fmt(result.peakHourDemand)} GPH`],
            ["Peak day (storage floor / redundancy)", `${fmt(result.peakDayDemand)} GPH`],
            ["Avg day (drives annual energy)", `${fmt(result.avgDayDemand)} GPH`],
          ]}
        />
      </Step>

      {/* 07 RECIRC */}
      {isCentral && (
        <Step n={7} title="Recirculation standby loss">
          <Prose>
            Central systems circulate hot water through the building so every tap gets hot water
            quickly. The pipe loses heat to the surrounding space at a rate proportional to
            temperature difference ÷ insulation R-value.
          </Prose>
          <Formula>
            loss_BTUH_raw = loop_length × (return_T − ambient_T) ÷ R × 0.16
          </Formula>
          <Sub>
            {fmt(inputs.recircLoopLengthFt)} ft × ({inputs.recircReturnTempF} −{" "}
            {inputs.ambientPipeF})°F ÷ R-{inputs.pipeInsulationR} × 0.16 ={" "}
            <Result>{fmt(result.recircLossRawBTUH)}</Result> BTU/hr (continuous-pumping baseline)
          </Sub>
          {result.recircControlMultiplier > 0 && result.recircControl !== "continuous" && (
            <>
              <Prose>
                The selected recirculation control mode (<strong>{result.recircControl}</strong>)
                modulates how often the loop is actively pumped, which scales the standby loss.
                Continuous pumping = 1.00; time-clock at {inputs.timeClockHoursPerDay} hr/day,
                demand-controlled = 0.30, aquastat = 0.65 (ASHRAE 90.1-2022 §6.5.5; ACEEE MF
                distribution studies).
              </Prose>
              <Formula>
                loss_BTUH = loss_BTUH_raw × control_multiplier
              </Formula>
              <Sub>
                {fmt(result.recircLossRawBTUH)} × {result.recircControlMultiplier.toFixed(2)} ={" "}
                <Result>{fmt(result.recircLossBTUH)}</Result> BTU/hr
                {" "}(savings: {fmt(result.recircLossSavingsBTUH)} BTU/hr)
              </Sub>
            </>
          )}
          <Formula>
            loss_kW = <Result>{fmt(result.recircLossKW, 2)}</Result> kW (= BTU/hr ÷ 3412)
          </Formula>
        </Step>
      )}

      {/* 08 STORAGE */}
      {isCentral && (
        <Step n={8} title="Storage sizing (ASHRAE)">
          <Prose>
            ASHRAE sizes storage as a fraction of peak-hour demand, adjusted for the fraction of
            tank volume actually usable after thermal stratification.
          </Prose>
          <Formula>
            nominal = peak_hour × storage_coef = {fmt(result.peakHourDemand)} × {profile.storageFrac}{" "}
            = <Result>{fmt(result.storageVolGal_nominal)}</Result> gal
          </Formula>
          <Formula>
            usable = nominal ÷ 0.75 = {fmt(result.storageVolGal_nominal)} ÷ 0.75 ={" "}
            <Result>{fmt(result.storageVolGal)}</Result> gal
          </Formula>
          <Formula>
            tempered_120F = usable × temper_mult = {fmt(result.storageVolGal)} ×{" "}
            {result.temperMultiplier.toFixed(3)} ={" "}
            <Result>{fmt(result.temperedCapacityGal)}</Result> gal
          </Formula>
        </Step>
      )}

      {/* 09 RECOVERY */}
      {isCentral && (
        <Step n={9} title="Recovery sizing (ASHRAE)">
          <Prose>
            Recovery is the rate at which the system can replenish hot water during and after the
            peak hour. ASHRAE sizes it as 30% of peak-hour demand for continuous backfill.
          </Prose>
          <Formula>
            recovery_GPH = peak_hour × recovery_coef = {fmt(result.peakHourDemand)} ×{" "}
            {profile.recoveryFrac} = <Result>{fmt(result.recoveryGPH)}</Result> GPH
          </Formula>
          <Formula>
            recovery_BTUH = GPH × 8.33 lb/gal × rise°F = {fmt(result.recoveryGPH)} × 8.33 ×{" "}
            {fmt(result.temperatureRise)} = <Result>{fmt(result.recoveryBTUH)}</Result> BTU/hr
          </Formula>
          <Formula>
            recovery_kW = BTU/hr ÷ 3412 = <Result>{fmt(result.recoveryKW, 1)}</Result> kW
          </Formula>
        </Step>
      )}

      {/* 10 TOTAL DESIGN LOAD */}
      {isCentral && (
        <Step n={10} title="Total design load">
          <Formula>
            total_BTUH = recovery + recirc = {fmt(result.recoveryBTUH)} +{" "}
            {fmt(result.recircLossBTUH)} = <Result>{fmt(result.totalBTUH)}</Result> BTU/hr
          </Formula>
          <Formula>
            total_kW = <Result>{fmt(result.totalKW, 1)}</Result> kW
          </Formula>
          <Prose>
            The recirc loss is <strong>{((result.recircLossBTUH / result.totalBTUH) * 100).toFixed(1)}%</strong>{" "}
            of total design load — a common sanity check. If this exceeds ~15% the loop is under-insulated
            or over-long, and the Compliance tab will flag it.
          </Prose>
        </Step>
      )}

      {/* 11 HEAT SOURCE SPECIFICS */}
      <Step n={isCentral ? 11 : 7} title={`Heat source math — ${sys.label}`}>
        {inputs.systemType === "central_gas" && (
          <>
            <Prose>
              Central gas sizes the burner input to cover total BTU/hr at the entered efficiency.
            </Prose>
            <Formula>
              gas_input_BTUH = total_BTUH ÷ η = {fmt(result.totalBTUH)} ÷{" "}
              {inputs.gasEfficiency.toFixed(2)} ={" "}
              <Result>{fmt(result.gasInputBTUH)}</Result> BTU/hr ({fmt(result.gasInputBTUH / 1000)}{" "}
              MBH)
            </Formula>
          </>
        )}
        {isCentralTankless && (
          <>
            <Prose>
              Central tankless plants are sized by peak instantaneous GPM × ΔT, not by FHR +
              storage. ASHRAE Ch. 51 §&ldquo;Instantaneous water heaters&rdquo; recommends 1.5×
              peak 15-minute demand; we use 1.5× the average peak-hour rate as a conservative
              proxy. Capacity-at-rise scales with the module&rsquo;s UEF (using the gas-efficiency
              input as the surrogate, default 0.92).
            </Prose>
            <Formula>
              required_GPM = peakHourDemand ÷ 60 × 1.5 = {fmt(result.peakHourDemand)} ÷ 60 × 1.5 ={" "}
              <Result>{fmt(result.centralTanklessPeakGPMRequired, 2)}</Result> GPM
            </Formula>
            <Formula>
              capacity_GPM = (input_MBH × UEF × 1000) ÷ (500 × ΔT)
            </Formula>
            <Sub>
              ({inputs.centralGasTanklessInput} × {inputs.gasEfficiency.toFixed(2)} × 1000) ÷ (500 ×{" "}
              {fmt(result.temperatureRise)}) ={" "}
              <Result>{fmt(result.centralTanklessCapacityGPM, 2)}</Result> GPM →{" "}
              {result.centralTanklessMetsDemand ? "✓ meets" : "✗ below"} required
            </Sub>
            <Formula>
              gas_input_BTUH = total_BTUH ÷ η = {fmt(result.totalBTUH)} ÷{" "}
              {inputs.gasEfficiency.toFixed(2)} ={" "}
              <Result>{fmt(result.gasInputBTUH)}</Result> BTU/hr (annual energy uses the same η —
              no separate storage standby loss).
            </Formula>
          </>
        )}
        {isCentralIndirect && (
          <>
            <Prose>
              Central indirect systems use a hydronic boiler heating a glycol/water loop that
              feeds an indirect-fired storage tank or plate HX on the potable side. The boiler
              must overcome both burner inefficiency and the HX transfer derate.
            </Prose>
            <Formula>
              effective_η = gas_η × HX_eff = {inputs.gasEfficiency.toFixed(2)} ×{" "}
              {inputs.indirectHXEffectiveness.toFixed(2)} ={" "}
              <Result>{result.effectiveGasEfficiency.toFixed(3)}</Result>
            </Formula>
            <Formula>
              boiler_input_BTUH = total_BTUH ÷ effective_η = {fmt(result.totalBTUH)} ÷{" "}
              {result.effectiveGasEfficiency.toFixed(3)} ={" "}
              <Result>{fmt(result.gasInputBTUH)}</Result> BTU/hr ({fmt(result.gasInputBTUH / 1000)}{" "}
              MBH)
            </Formula>
            <Prose>
              Storage tank sizing reuses the central_gas formulas (peak hour × storage coef ÷
              usable fraction). The HX derate flows through to annual energy too: therms ={" "}
              annual_BTU ÷ (effective_η × 100,000).
            </Prose>
          </>
        )}
        {isCentralHybrid && (
          <>
            <Prose>
              Central hybrid plants split the design load between an HPWH primary
              (carrying the baseload + shoulder seasons) and a gas backup
              (covering peak hour + cold-snap recovery). The split ratio
              determines how much capacity each side carries; both pieces of
              equipment exist on the plant.
            </Prose>
            <Formula>
              split_ratio = <Result>{inputs.hybridSplitRatio.toFixed(2)}</Result> · backup ={" "}
              <Em>{inputs.hybridGasBackupType}</Em>
            </Formula>
            <Formula>
              hpwh_BTUH = split_ratio × total_BTUH = {inputs.hybridSplitRatio.toFixed(2)} ×{" "}
              {fmt(result.totalBTUH)} = <Result>{fmt(result.hybridHpwhBTUH)}</Result> BTU/hr
            </Formula>
            <Formula>
              gas_BTUH = (1 − split_ratio) × total_BTUH ={" "}
              {(1 - inputs.hybridSplitRatio).toFixed(2)} × {fmt(result.totalBTUH)} ={" "}
              <Result>{fmt(result.hybridGasBTUH)}</Result> BTU/hr
            </Formula>
            <Formula>
              gas_input_MBH = gas_BTUH ÷ gas_η ÷ 1000 = {fmt(result.hybridGasBTUH)} ÷{" "}
              {inputs.gasEfficiency.toFixed(2)} ÷ 1000 ={" "}
              <Result>{fmt(result.hybridGasInputMBH, 1)}</Result> MBH
            </Formula>
            <Prose>
              Annual energy uses the simpler annual-split approximation: HPWH share runs at the
              climate-weighted annual COP, gas share at gas_η. The monthly model below mirrors the
              same split with monthly COP applied to the HPWH share.
            </Prose>
          </>
        )}
        {isCentralSteamHX && (
          <>
            <Prose>
              Central steam-to-DHW HX systems route building or district steam through a shell-and-
              tube heat exchanger that heats potable water in an indirect-fired storage tank. The
              effective system efficiency multiplies the upstream steam-source efficiency (district
              mains losses + plant, or in-building boiler + distribution) by the HX transfer
              effectiveness.
            </Prose>
            <Formula>
              combined_η = source_η × HX_eff = {inputs.steamSourceEfficiency.toFixed(2)} ×{" "}
              {inputs.steamHXEffectiveness.toFixed(2)} ={" "}
              <Result>{result.steamCombinedEfficiency.toFixed(3)}</Result>
            </Formula>
            <Formula>
              required_steam_input_MBH = total_BTUH ÷ (combined_η × 1000) ={" "}
              {fmt(result.totalBTUH)} ÷ ({result.steamCombinedEfficiency.toFixed(3)} × 1000) ={" "}
              <Result>{fmt(result.gasInputBTUH / 1000)}</Result> MBH
            </Formula>
            <Formula>
              steam_sat_T(P={inputs.steamSupplyPressurePSIG} PSIG) ≈ 227 + ({inputs.steamSupplyPressurePSIG} − 5) × 2.3 ={" "}
              <Result>{(227 + (inputs.steamSupplyPressurePSIG - 5) * 2.3).toFixed(0)}</Result>°F
              · approach_OK ={" "}
              <Result>{result.steamApproachOK ? "✓" : "✗"}</Result> (need storage_setpoint + 20 &lt;
              sat_T)
            </Formula>
            <Prose>
              Annual energy is reported as steam-therm equivalents using the gas-rate / gas-carbon
              factors as proxies. Real district-steam pricing is typically $/MMBtu and carbon
              depends on the upstream plant fuel mix — see the Methodology tab caveat.
            </Prose>
          </>
        )}
        {isCentralPerFloor && (
          <>
            <Prose>
              Per-floor / per-stack systems decentralize the central plant into N
              independent HPWH zones (one per floor or per riser). Each zone serves
              `totalUnits / zoneCount` apartments through its own short recirc loop;
              total summed recirc loss scales as ~1/zoneCount vs a single full-length
              loop because the long building riser disappears.
            </Prose>
            <Formula>
              zone_count = <Result>{inputs.perFloorZoneCount}</Result>
            </Formula>
            <Formula>
              per_zone_BTUH = total_BTUH ÷ zone_count = {fmt(result.totalBTUH)} ÷{" "}
              {inputs.perFloorZoneCount} ={" "}
              <Result>{fmt(result.totalBTUH / inputs.perFloorZoneCount)}</Result> BTU/hr
            </Formula>
            <Formula>
              per_zone_kW = (per_zone_BTUH ÷ 3412) ÷ COP ÷ cap_factor ={" "}
              <Result>{fmt(result.perFloorPerZoneKW, 1)}</Result> kW (snapped to ladder)
            </Formula>
            <Formula>
              total_installed_kW = per_zone_kW × zone_count ={" "}
              <Result>{fmt(result.perFloorTotalInstalledKW, 1)}</Result> kW
            </Formula>
            <Formula>
              recirc_loss_savings = continuous_loss × (1 − 1/zone_count) ={" "}
              <Result>{fmt(result.perFloorRecircLossReduction)}</Result> BTU/hr (vs single full loop)
            </Formula>
            <Prose>
              Annual energy uses the same HPWH compressor physics as a single central
              plant — savings come entirely from the reduced recirc loop loss.
            </Prose>
          </>
        )}
        {isCentralHRC && (
          <>
            <Prose>
              Heat-recovery chiller integration captures the building cooling system&apos;s
              condenser reject heat for DHW preheating. Available HR capacity scales with
              cooling tonnage × year-round fraction × the COP/(COP-1) heat-rejection
              ratio. Backup gas covers any annual shortfall after applying a utilization
              factor (cooling/DHW timing mismatch).
            </Prose>
            <Formula>
              hrc_capacity_BTUH = tons × 12,000 × yr_round × COP ÷ (COP − 1) ={" "}
              {fmt(inputs.hrcCoolingTons)} × 12000 × {inputs.hrcYearRoundCoolingFraction.toFixed(2)} ×{" "}
              {inputs.hrcCOPHeatRecovery.toFixed(2)} ÷ {(inputs.hrcCOPHeatRecovery - 1).toFixed(2)} ={" "}
              <Result>{fmt(result.hrcCapacityBTUH)}</Result> BTU/hr
            </Formula>
            <Formula>
              hrc_max_annual_BTU = capacity × 8760 × utilization (0.70) ={" "}
              <Result>{fmt(result.hrcCapacityBTUH * 8760 * 0.70)}</Result> BTU/yr
            </Formula>
            <Formula>
              hrc_contribution_BTU = min(annual_total_BTU, hrc_max_annual_BTU) ={" "}
              <Result>{fmt(result.hrcAnnualContributionBTU)}</Result> BTU/yr
            </Formula>
            <Formula>
              coverage_fraction = hrc_contribution ÷ annual_total ={" "}
              <Result>{(result.hrcCoverageFraction * 100).toFixed(1)}%</Result>
            </Formula>
            <Formula>
              backup_gas_therms = (annual_total − hrc_contribution) ÷ (gas_η × 100,000) ={" "}
              <Result>{fmt(result.annualGasTherms)}</Result> therms
            </Formula>
            <Formula>
              hrc_electric_kWh = hrc_contribution ÷ 3412 ÷ HR-mode_COP ={" "}
              <Result>{fmt(result.annualHPWHKWh_total)}</Result> kWh
            </Formula>
            <Prose>
              The HRC&apos;s &quot;free&quot; heat is the rejected condenser energy that
              would otherwise dump outdoors; the chiller&apos;s incremental compressor work
              to deliver useful heat at potable-side setpoint IS counted in the electric
              total. ASHRAE 90.1-2022 §6.5.6 mandates heat recovery in many large
              facilities with year-round simultaneous heating + cooling.
            </Prose>
          </>
        )}
        {isCentralWastewaterHP && (
          <>
            <Prose>
              Sewer-source heat pumps use raw wastewater as the thermal source. The
              source temperature stays in the 55–65°F range year-round (residential
              shower-heated runoff), giving much higher COP than air-source HPWHs in
              cold climates. No air-temp-driven capacity derate.
            </Prose>
            <Formula>
              source_temp = <Result>{inputs.wastewaterSourceTempF}</Result>°F (constant)
            </Formula>
            <Formula>
              effective_COP = <Result>{result.wastewaterEffectiveCOP.toFixed(2)}</Result>{" "}
              (from spec; bounded 3.0–6.0)
            </Formula>
            <Formula>
              hpwh_nameplate_kW = total_BTUH ÷ 3412 ÷ COP = {fmt(result.totalBTUH)} ÷ 3412 ÷{" "}
              {result.wastewaterEffectiveCOP.toFixed(2)} ={" "}
              <Result>{fmt(result.totalKW / result.wastewaterEffectiveCOP, 1)}</Result> kW
            </Formula>
            <Formula>
              annual_kWh = annual_total_BTU ÷ 3412 ÷ COP ={" "}
              <Result>{fmt(result.annualHPWHKWh_total)}</Result> kWh
            </Formula>
            <Prose>
              Capex is ~2× standard HPWH because the sewer-side HX must handle raw
              sewage (screening, biofouling mitigation). Real installations:
              SHARC International False Creek (Vancouver), Hudson Yards (NYC),
              Goodwill HQ (Seattle).
            </Prose>
          </>
        )}
        {inputs.systemType === "central_resistance" && (
          <>
            <Prose>Resistance converts 1:1 — no efficiency derate needed.</Prose>
            <Formula>
              resistance_kW = total_kW = <Result>{fmt(result.resistanceInputKW, 1)}</Result> kW
            </Formula>
          </>
        )}
        {inputs.systemType === "central_hpwh" && (
          <>
            <Prose>
              HPWH nameplate sizing accounts for (a) compressor COP at design ambient and (b)
              capacity derate in cold mech rooms. Tier multiplier:{" "}
              {HPWH_TIER_ADJUSTMENT[inputs.hpwhTier].copMultiplier.toFixed(2)} (
              {HPWH_TIER_ADJUSTMENT[inputs.hpwhTier].label}).
            </Prose>
            <Formula>
              COP = hpwhCOP(ambient={result.effectiveHpwhAmbient.toFixed(0)}°F, inlet={result.effectiveInletF}°F,
              setpoint={inputs.storageSetpointF}°F, {inputs.hpwhRefrigerant}) × tier_mult ={" "}
              <Result>{result.cop.toFixed(2)}</Result>
            </Formula>
            <Formula>
              cap_factor = <Result>{(result.capFactor * 100).toFixed(0)}%</Result> (derate at cold
              ambient)
            </Formula>
            <Formula>
              hpwh_input_kW = total_kW ÷ COP = {fmt(result.totalKW, 1)} ÷ {result.cop.toFixed(2)} ={" "}
              <Result>{fmt(result.hpwhInputKW, 1)}</Result> kW
            </Formula>
            <Formula>
              nameplate_kW = input_kW ÷ cap_factor = {fmt(result.hpwhInputKW, 1)} ÷{" "}
              {result.capFactor.toFixed(2)} ={" "}
              <Result>{fmt(result.hpwhNameplateKW, 1)}</Result> kW
            </Formula>
            {inputs.swingTankEnabled && (
              <Formula>
                swing_tank_kW = recirc_kW + 9 kW = {fmt(result.recircLossKW, 1)} + 9 ={" "}
                <Result>{fmt(result.swingTankKW, 1)}</Result> kW
              </Formula>
            )}
          </>
        )}

        {(isGasTank || isGasCombi) && (
          <>
            <Prose>
              In-unit gas tank uses per-apartment peak-hour demand from ASHRAE as the FHR target.
              {isGasCombi && " Combi gas also serves space heating from the same tank — see step below."}
            </Prose>
            <Formula>
              per_unit_peak_GPH = profile.mh ={" "}
              <Result>{fmt(result.inUnitGas.perUnitPeakGPH)}</Result> GPH
            </Formula>
            <Formula>
              tank_FHR = {fmt(result.inUnitGas.gasTankFHR)} GPH ({inputs.gasTankType}) →{" "}
              <Result>
                {result.inUnitGas.gasTankFHRMet ? "✓ meets" : "✗ below"}
              </Result>
            </Formula>
            <Formula>
              UEF = {result.inUnitGas.gasTankUEF.toFixed(2)} · input_MBH ={" "}
              {result.inUnitGas.gasTankInputMBH} · output_MBH ={" "}
              {result.inUnitGas.gasTankOutputMBH.toFixed(1)}
            </Formula>
            <Formula>
              recovery_GPH = output_MBH × 1000 ÷ (8.33 × rise) ={" "}
              {result.inUnitGas.gasTankOutputMBH.toFixed(1)} × 1000 ÷ (8.33 ×{" "}
              {fmt(result.inUnitGas.gasTankRiseF)}) ={" "}
              <Result>{fmt(result.inUnitGas.gasTankRecoveryGPH)}</Result> GPH
            </Formula>
            <Formula>
              building_gas_demand = per_unit_CFH × units × diversity ={" "}
              {fmt(result.inUnitGas.gasTankCFH_perUnit)} × {fmt(result.totalUnits)} ×{" "}
              {(result.inUnitGas.gasDiversityFactor * 100).toFixed(0)}% ={" "}
              <Result>{fmt(result.inUnitGas.buildingGasDemandCFH)}</Result> CFH
            </Formula>
          </>
        )}

        {isGasTankless && (
          <>
            <Prose>
              Tankless sizing is instantaneous: the unit must deliver the peak simultaneous GPM at
              the design rise. No storage buffer.
            </Prose>
            <Prose>Top-N fixture co-use with 85% simultaneity derate:</Prose>
            <KVList
              rows={sortedFlows
                .slice(0, Math.max(1, Math.min(inputs.tanklessSimultaneousFixtures, sortedFlows.length)))
                .map((s) => [fixtureLabel(s.key), `${s.gpm.toFixed(1)} GPM`])}
            />
            <Formula>
              peak_GPM = sum(top_{inputs.tanklessSimultaneousFixtures}) × 0.85 ={" "}
              {sortedFlows
                .slice(0, inputs.tanklessSimultaneousFixtures)
                .reduce((s, r) => s + r.gpm, 0)
                .toFixed(1)}{" "}
              × 0.85 = <Result>{fmt(result.inUnitGas.tanklessPeakGPM, 1)}</Result> GPM
            </Formula>
            <Formula>
              required_BTUH = peak_GPM × 500 × rise = {fmt(result.inUnitGas.tanklessPeakGPM, 1)} × 500 ×{" "}
              {inputs.tanklessDesignRiseF} ={" "}
              <Result>{fmt(result.inUnitGas.tanklessRequiredBTUH)}</Result> BTU/hr
            </Formula>
            <Formula>
              capacity_at_rise = input_MBH × UEF × 1000 ÷ (500 × rise) ={" "}
              {GAS_TANKLESS_WH[inputs.gasTanklessInput].input_mbh} × {GAS_TANKLESS_WH[inputs.gasTanklessInput].uef} ×
              1000 ÷ (500 × {inputs.tanklessDesignRiseF}) ={" "}
              <Result>{fmt(result.inUnitGas.tanklessCapacityAtRise, 2)}</Result> GPM →{" "}
              {result.inUnitGas.tanklessMetsDemand ? "✓ meets" : "✗ below"} peak
            </Formula>
          </>
        )}

        {isGasTanklessCombi && (
          <>
            <Prose>
              In-unit gas tankless combi sizing checks both the DHW-side capacity (peak GPM × ΔT,
              like a DHW-only tankless) and the buffer-tank gallons needed to prevent burner
              short-cycling on low partial-load heating calls. The buffer SKU is auto-sized off
              min_fire_BTUH (≈10% of max input, typical 10:1 turndown).
            </Prose>
            <Formula>
              capacity_GPM = (input_MBH × UEF × 1000) ÷ (500 × ΔT) ={" "}
              ({inputs.inunitGasTanklessCombiInput} ×{" "}
              {GAS_TANKLESS_WH[inputs.inunitGasTanklessCombiInput].uef.toFixed(2)} × 1000) ÷ (500 ×{" "}
              {inputs.tanklessDesignRiseF}) ={" "}
              <Result>{fmt(result.inunitGasCombiPeakInstantGPM, 2)}</Result> GPM
            </Formula>
            <Formula>
              max_fire_BTUH = input_MBH × UEF × 1000 ={" "}
              {inputs.inunitGasTanklessCombiInput} ×{" "}
              {GAS_TANKLESS_WH[inputs.inunitGasTanklessCombiInput].uef.toFixed(2)} × 1000 ={" "}
              <Result>
                {fmt(
                  inputs.inunitGasTanklessCombiInput *
                    GAS_TANKLESS_WH[inputs.inunitGasTanklessCombiInput].uef *
                    1000,
                )}
              </Result>{" "}
              BTU/hr
            </Formula>
            <Formula>
              min_fire_BTUH = max_fire × 0.10 = <Result>
                {fmt(
                  inputs.inunitGasTanklessCombiInput *
                    GAS_TANKLESS_WH[inputs.inunitGasTanklessCombiInput].uef *
                    1000 *
                    0.10,
                )}
              </Result>{" "}
              BTU/hr (10:1 turndown typical)
            </Formula>
            <Formula>
              required_buffer_gal = min_fire × 5 min ÷ (60 × 8.33 × 15°F swing) ={" "}
              <Result>{fmt(result.inunitGasCombiBufferRequiredGal, 1)}</Result> gal
            </Formula>
            <Formula>
              selected_buffer = max(auto_SKU, user_override) ={" "}
              <Result>{fmt(result.inunitGasCombiBufferSelectedGal)}</Result> gal
            </Formula>
            <Prose>
              Annual energy treats both DHW and heating loads at the tankless UEF — the buffer tank
              is a control element, not an efficiency derate.
            </Prose>
          </>
        )}
        {(isResistance || isResistanceCombi) && (
          <>
            <Prose>
              Electric resistance tank — 1:1 conversion at the element with modest standby losses
              captured by UEF. {isResistanceCombi ? "Combi variant routes the heating loop through the same element; element kW is the hard ceiling on per-unit heating capacity (no compressor or burner reserve)." : "DHW only."}
            </Prose>
            <Formula>
              tank_FHR = {fmt(INUNIT_RESISTANCE_TANK_SPEC[inputs.inunitResistanceTankSize].fhr)} GPH →{" "}
              vs per-unit peak {fmt(result.inUnitGas.perUnitPeakGPH)} GPH →{" "}
              <Result>
                {INUNIT_RESISTANCE_TANK_SPEC[inputs.inunitResistanceTankSize].fhr >=
                result.inUnitGas.perUnitPeakGPH
                  ? "✓ meets"
                  : "✗ below"}
              </Result>
            </Formula>
            <Formula>
              UEF = {INUNIT_RESISTANCE_TANK_SPEC[inputs.inunitResistanceTankSize].uef.toFixed(2)} ·
              element_kW = {INUNIT_RESISTANCE_TANK_SPEC[inputs.inunitResistanceTankSize].kw} kW ·
              element_BTUH ={" "}
              <Result>
                {fmt(INUNIT_RESISTANCE_TANK_SPEC[inputs.inunitResistanceTankSize].kw * 3412)}
              </Result>{" "}
              BTU/hr
            </Formula>
            {isResistanceCombi && (
              <Formula>
                worst_heating_load ={" "}
                {fmt(
                  Math.max(
                    result.combi.heatingLoad_0BR,
                    result.combi.heatingLoad_1BR,
                    result.combi.heatingLoad_2BR,
                    result.combi.heatingLoad_3BR,
                  ),
                )}{" "}
                BTU/hr →{" "}
                <Result>
                  {INUNIT_RESISTANCE_TANK_SPEC[inputs.inunitResistanceTankSize].kw * 3412 >=
                  Math.max(
                    result.combi.heatingLoad_0BR,
                    result.combi.heatingLoad_1BR,
                    result.combi.heatingLoad_2BR,
                    result.combi.heatingLoad_3BR,
                  )
                    ? "✓ element covers"
                    : "✗ element undersized"}
                </Result>
              </Formula>
            )}
          </>
        )}
        {isHPWHInUnit && (
          <>
            <Prose>
              In-unit HPWH sizing pairs first-hour rating (peak burst capacity) with climate-derived
              COP (efficiency). Tier multiplier:{" "}
              {HPWH_TIER_ADJUSTMENT[inputs.hpwhTier].copMultiplier.toFixed(2)} (
              {HPWH_TIER_ADJUSTMENT[inputs.hpwhTier].label}).
            </Prose>
            <Formula>
              tank_FHR = {fmt(result.combi.fhr)} GPH → vs per-unit peak{" "}
              {fmt(result.inUnitGas.perUnitPeakGPH)} GPH →{" "}
              <Result>{result.combi.dhwMetByFHR ? "✓ meets" : "✗ below"}</Result>
            </Formula>
            <Formula>
              COP_dhw = hpwhCOP(70°F, {result.effectiveInletF}°F, {inputs.combiDHWSetpointF}°F, HFC) × tier_mult ={" "}
              <Result>{result.combi.combiCOP_dhw.toFixed(2)}</Result>
            </Formula>
            {hasHeating && (
              <Formula>
                COP_heating = hpwhCOP(70°F, inlet, eff_tank_setpoint={" "}
                {fmt(result.combi.effectiveTankSetpointForHeating)}°F, HFC) × tier_mult ={" "}
                <Result>{result.combi.combiCOP_heating.toFixed(2)}</Result>
              </Formula>
            )}
          </>
        )}
      </Step>

      {/* 12 PEAK-INSTANT BURST */}
      {(isGasTank || isGasCombi || isHPWHInUnit) && (
        <Step
          n={isCentral ? 12 : 8}
          title="Peak instantaneous burst check"
          subtitle="Can the tank supply the simultaneous fixture flow long enough?"
        >
          <Prose>
            The burst check compares peak simultaneous fixture flow against the tank&rsquo;s
            sustained recovery rate. If peak exceeds sustain, storage buffers a finite burst before
            tank temperature drops below setpoint.
          </Prose>
          {(() => {
            const tankFHR = isGasTank || isGasCombi ? result.inUnitGas.gasTankFHR : result.combi.fhr;
            const tankGallons = isGasTank || isGasCombi ? inputs.gasTankSize : inputs.combiTankSize;
            const sustainGPM = tankFHR / 60;
            const usable = tankGallons * 0.7;
            const burstMin =
              result.peakInstantGPM > sustainGPM
                ? usable / (result.peakInstantGPM - sustainGPM)
                : Infinity;
            return (
              <>
                <Formula>
                  peak_burst_GPM ={" "}
                  <Result>{result.peakInstantGPM.toFixed(1)}</Result> GPM (top{" "}
                  {result.peakInstantFixtureCount} × 85%)
                </Formula>
                <Formula>
                  tank_sustain_GPM = FHR ÷ 60 = {fmt(tankFHR)} ÷ 60 ={" "}
                  <Result>{sustainGPM.toFixed(2)}</Result> GPM
                </Formula>
                {result.peakInstantGPM <= sustainGPM ? (
                  <Callout tone="ok">
                    ✓ Sustained — tank covers peak indefinitely.
                  </Callout>
                ) : (
                  <Formula>
                    burst_minutes = usable_storage ÷ (peak − sustain) = {Math.round(usable)} ÷ (
                    {result.peakInstantGPM.toFixed(1)} − {sustainGPM.toFixed(2)}) ={" "}
                    <Result>{Number.isFinite(burstMin) ? burstMin.toFixed(0) : "∞"}</Result> min
                  </Formula>
                )}
              </>
            );
          })()}
        </Step>
      )}

      {/* 13 SPACE HEATING (combi) */}
      {hasHeating && (
        <Step n={isCentral ? 13 : 9} title="Space heating load (Manual J abbreviated)">
          <Prose>
            Per-unit heating load is computed from envelope factor × sqft × ΔT plus ventilation
            load. Envelope preset <Em>{inputs.envelopePreset}</Em> uses factor{" "}
            {ENVELOPE_PRESETS[inputs.envelopePreset].factor.toFixed(2)} BTU/(hr·ft²·°F).
          </Prose>
          <Formula>
            ΔT = indoor_design − heating_DB = {inputs.indoorDesignF}°F − {result.climate.heatDB}°F ={" "}
            <Result>{fmt(result.combi.designDeltaT)}</Result> °F
          </Formula>
          <Formula>
            vent_load = cfm × 1.08 × ΔT = {inputs.ventilationLoadPerUnit} × 1.08 ×{" "}
            {fmt(result.combi.designDeltaT)} ={" "}
            <Result>{fmt(result.combi.ventLoadPerUnit)}</Result> BTU/hr
          </Formula>
          <Formula>
            heating_load = sqft × env_factor × ΔT + vent_load
          </Formula>
          <KVList
            rows={[
              [
                "Studio",
                `${inputs.avgUnitSqft.br0} × ${result.combi.envFactor.toFixed(2)} × ${fmt(
                  result.combi.designDeltaT,
                )} + ${fmt(result.combi.ventLoadPerUnit)} = ${fmt(
                  result.combi.heatingLoad_0BR,
                )} BTU/hr`,
              ],
              [
                "1-BR",
                `${inputs.avgUnitSqft.br1} × ${result.combi.envFactor.toFixed(2)} × ${fmt(
                  result.combi.designDeltaT,
                )} + ${fmt(result.combi.ventLoadPerUnit)} = ${fmt(
                  result.combi.heatingLoad_1BR,
                )} BTU/hr`,
              ],
              [
                "2-BR",
                `${inputs.avgUnitSqft.br2} × ${result.combi.envFactor.toFixed(2)} × ${fmt(
                  result.combi.designDeltaT,
                )} + ${fmt(result.combi.ventLoadPerUnit)} = ${fmt(
                  result.combi.heatingLoad_2BR,
                )} BTU/hr`,
              ],
              [
                "3-BR",
                `${inputs.avgUnitSqft.br3} × ${result.combi.envFactor.toFixed(2)} × ${fmt(
                  result.combi.designDeltaT,
                )} + ${fmt(result.combi.ventLoadPerUnit)} = ${fmt(
                  result.combi.heatingLoad_3BR,
                )} BTU/hr`,
              ],
            ]}
          />
          <Formula>
            total_heating_load = Σ units × load ={" "}
            <Result>{fmt(result.combi.totalHeatingLoad)}</Result> BTU/hr
          </Formula>
        </Step>
      )}

      {/* 13b BUFFER TANK SIZING (combi HPWH only) */}
      {inputs.systemType === "inunit_combi" &&
        inputs.bufferTankEnabled &&
        result.bufferTankVolumeGal != null && (
          <Step n={isCentral ? 13 : 9} title="Buffer tank sizing">
            <Prose>
              A buffer tank on the heating loop prevents compressor short-cycling during low-load
              operation. Rule of thumb: store enough heat for 10 minutes of compressor runtime at
              a 10°F buffer swing.
            </Prose>
            <Formula>
              V_gal = Q_compressor × t_min ÷ (60 × 8.33 × ΔT_swing)
            </Formula>
            <Formula>
              V_gal = {fmt(
                Math.max(
                  result.combi.combiCompressorOutputBTUH_0BR,
                  result.combi.combiCompressorOutputBTUH_1BR,
                  result.combi.combiCompressorOutputBTUH_2BR,
                  result.combi.combiCompressorOutputBTUH_3BR,
                ),
              )}{" "}
              × 10 ÷ (60 × 8.33 × 10) ={" "}
              <Result>
                {(
                  Math.max(
                    result.combi.combiCompressorOutputBTUH_0BR,
                    result.combi.combiCompressorOutputBTUH_1BR,
                    result.combi.combiCompressorOutputBTUH_2BR,
                    result.combi.combiCompressorOutputBTUH_3BR,
                  ) *
                  10 /
                  (60 * 8.33 * 10)
                ).toFixed(1)}
              </Result>{" "}
              gal raw
            </Formula>
            <Formula>
              rounded up to nearest SKU [20, 40, 50, 80, 120] ={" "}
              <Result>{result.bufferTankVolumeGal}</Result> gal
            </Formula>
            <Prose>
              The worst-case (largest) per-BR compressor output is used so the buffer tank covers
              every unit type. Sizing mirrors the <Em>worstHeating</Em> convention used elsewhere
              for combi tank selection.
            </Prose>
          </Step>
        )}

      {/* 14 ANNUAL ENERGY */}
      <Step
        n={
          isCentral
            ? hasHeating
              ? 14
              : 11
            : hasHeating
            ? 10
            : 9
        }
        title="Annual energy (monthly model)"
      >
        <Prose>
          The monthly energy model iterates 12 months, adjusting ambient, inlet, and COP per month,
          then integrating demand × rise × days. Per-month efficiency is applied system-specific.
        </Prose>
        <Formula>
          annual_DHW_BTU = avg_daily × 365 × 8.33 × rise = {fmt(result.avgDayDemand)} × 365 × 8.33 ×{" "}
          {fmt(result.temperatureRise)} = {fmt(result.avgDayDemand * 365 * 8.33 * result.temperatureRise)}{" "}
          BTU/yr
        </Formula>
        {isCentral && (
          <Formula>
            + annual_recirc_BTU = recirc_BTUH × 8760 = {fmt(result.recircLossBTUH)} × 8760 ={" "}
            {fmt(result.recircLossBTUH * 8760)} BTU/yr
          </Formula>
        )}
        <Prose>
          Divided through the selected tech&rsquo;s efficiency, annual energy reduces to:
        </Prose>
        {inputs.systemType === "central_gas" && (
          <Formula>
            therms = total_BTU ÷ (η × 100,000) = <Result>{fmt(result.annualGasTherms)}</Result>{" "}
            therms · cost <Result>{fmtUSD(result.annualGasCost)}</Result>
          </Formula>
        )}
        {isCentralTankless && (
          <Formula>
            therms = total_BTU ÷ (η × 100,000) = <Result>{fmt(result.annualGasTherms)}</Result>{" "}
            therms · cost <Result>{fmtUSD(result.annualGasCost)}</Result>
          </Formula>
        )}
        {isCentralIndirect && (
          <Formula>
            therms = total_BTU ÷ (gas_η × HX_eff × 100,000) ={" "}
            <Result>{fmt(result.annualGasTherms)}</Result> therms · cost{" "}
            <Result>{fmtUSD(result.annualGasCost)}</Result>
          </Formula>
        )}
        {isCentralHybrid && (
          <>
            <Formula>
              gas_therms = (1 − split) × total_BTU ÷ (gas_η × 100,000) ={" "}
              <Result>{fmt(result.annualGasTherms)}</Result> therms · cost{" "}
              <Result>{fmtUSD(result.annualGasCost)}</Result>
            </Formula>
            <Formula>
              hpwh_kWh = split × total_BTU ÷ 3412 ÷ annualCOP + swing_tank ={" "}
              <Result>{fmt(result.annualHPWHKWh_total)}</Result> kWh (annualCOP ={" "}
              {result.annualCOP.toFixed(2)}) · cost{" "}
              <Result>{fmtUSD(result.annualHPWHCost)}</Result>
            </Formula>
          </>
        )}
        {isCentralSteamHX && (
          <Formula>
            steam_therms = total_BTU ÷ (source_η × HX_eff × 100,000) ={" "}
            <Result>{fmt(result.annualGasTherms)}</Result> therms · cost{" "}
            <Result>{fmtUSD(result.annualGasCost)}</Result> (proxy — district steam is often $/MMBtu)
          </Formula>
        )}
        {inputs.systemType === "central_resistance" && (
          <Formula>
            kWh = total_BTU ÷ 3412 = <Result>{fmt(result.annualResistanceKWh)}</Result> kWh · cost{" "}
            <Result>{fmtUSD(result.annualResistanceCost)}</Result>
          </Formula>
        )}
        {inputs.systemType === "central_hpwh" && (
          <Formula>
            kWh = total_BTU ÷ 3412 ÷ annualCOP + swing_tank_kWh ={" "}
            <Result>{fmt(result.annualHPWHKWh_total)}</Result> kWh (annualCOP ={" "}
            {result.annualCOP.toFixed(2)}) · cost{" "}
            <Result>{fmtUSD(result.annualHPWHCost)}</Result>
          </Formula>
        )}
        {isCentralPerFloor && (
          <Formula>
            kWh = total_BTU (with reduced recirc) ÷ 3412 ÷ annualCOP ={" "}
            <Result>{fmt(result.annualHPWHKWh_total)}</Result> kWh · cost{" "}
            <Result>{fmtUSD(result.annualHPWHCost)}</Result>
          </Formula>
        )}
        {isCentralHRC && (
          <>
            <Formula>
              hrc_kWh = hrc_contribution_BTU ÷ 3412 ÷ HR_COP ={" "}
              <Result>{fmt(result.annualHPWHKWh_total)}</Result> kWh · cost{" "}
              <Result>{fmtUSD(result.annualHPWHCost)}</Result>
            </Formula>
            <Formula>
              gas_backup_therms = backup_BTU ÷ (gas_η × 100,000) ={" "}
              <Result>{fmt(result.annualGasTherms)}</Result> therms · cost{" "}
              <Result>{fmtUSD(result.annualGasCost)}</Result>
            </Formula>
          </>
        )}
        {isCentralWastewaterHP && (
          <Formula>
            kWh = total_BTU ÷ 3412 ÷ wastewater_COP = {fmt(result.annualHPWHKWh_total)} kWh ·{" "}
            <Result>cost {fmtUSD(result.annualHPWHCost)}</Result>
          </Formula>
        )}
        {(isGasTank || isGasCombi) && (
          <Formula>
            therms = annual_BTU ÷ (UEF × 100,000) ={" "}
            <Result>
              {fmt(isGasCombi ? result.monthly.monthlyAnnualEnergy : result.inUnitGas.gasTankBuildingTherms)}
            </Result>{" "}
            therms · cost{" "}
            <Result>
              {fmtUSD(isGasCombi ? result.monthly.monthlyAnnualCost : result.inUnitGas.gasTankBuildingCost)}
            </Result>
          </Formula>
        )}
        {isGasTankless && (
          <Formula>
            therms = annual_BTU ÷ (UEF × 100,000) ={" "}
            <Result>{fmt(result.inUnitGas.tanklessBuildingTherms)}</Result> therms · cost{" "}
            <Result>{fmtUSD(result.inUnitGas.tanklessBuildingCost)}</Result>
          </Formula>
        )}
        {isHPWHInUnit && (
          <Formula>
            kWh = annual_BTU ÷ 3412 ÷ COP = <Result>{fmt(result.combi.combiTotalAnnualKWh)}</Result>{" "}
            kWh (seasonalCOP_dhw = {result.combi.seasonalCOP_dhw.toFixed(2)}) · cost{" "}
            <Result>{fmtUSD(result.combi.combiTotalAnnualCost)}</Result>
          </Formula>
        )}
        {isGasTanklessCombi && (
          <Formula>
            therms = (annual_DHW_BTU + annual_heating_BTU) ÷ (UEF × 100,000) ={" "}
            <Result>{fmt(result.monthly.monthlyAnnualEnergy)}</Result> therms · cost{" "}
            <Result>{fmtUSD(result.monthly.monthlyAnnualCost)}</Result>
          </Formula>
        )}
        {(isResistance || isResistanceCombi) && (
          <Formula>
            kWh = annual_DHW_BTU ÷ 3412 ÷ UEF{isResistanceCombi ? " + annual_heating_BTU ÷ 3412" : ""} ={" "}
            <Result>{fmt(result.monthly.monthlyAnnualEnergy)}</Result> kWh · cost{" "}
            <Result>{fmtUSD(result.monthly.monthlyAnnualCost)}</Result>
          </Formula>
        )}
        <Prose>
          The monthly iteration detail (12 per-month rows with ambient, inlet, COP, and resulting
          kWh/therms) is shown on the <Em>Energy Model</Em> tab; hovering the bar chart reveals each
          month&rsquo;s substitutions.
        </Prose>
      </Step>

      {/* 15 AUTO-SIZE */}
      {result.autoSize && (
        <Step
          n={(() => {
            // simple final step numbering — just say it's the last one
            let n = isCentral ? 15 : 12;
            if (!isCentral && hasHeating) n = 11;
            return n;
          })()}
          title="Auto-size targets"
        >
          <Prose>
            Auto-size runs three sizing philosophies against the demand + heating loads computed
            above: <Em>minimum</Em> (code-compliant), <Em>recommended</Em> (+25% margin), and{" "}
            <Em>lifecycle</Em> (15-yr NPV optimum). Full philosophy details are on the Auto-Size
            tab; raw results are shown here.
          </Prose>
          <KVList
            rows={Object.entries(result.autoSize)
              .filter(([k, v]) => v !== null && v !== undefined && typeof v === "object")
              .map(([tier, rec]) => [
                tier,
                Object.entries(rec as Record<string, unknown>)
                  .map(([k, v]) => `${k}=${typeof v === "number" ? fmt(v) : String(v)}`)
                  .join(" · "),
              ])}
          />
        </Step>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// PRIMITIVES
// -----------------------------------------------------------------------------

function Step({
  n,
  title,
  subtitle,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            fontWeight: 700,
          }}
        >
          {String(n).padStart(2, "0")}
        </span>
        <h3 className="ve-section-title" style={{ fontSize: 15, margin: 0 }}>
          {title}
        </h3>
        {subtitle && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{subtitle}</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </Card>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 12.5,
        color: "var(--text-secondary)",
        lineHeight: 1.7,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

function Em({ children }: { children: ReactNode }) {
  return (
    <em
      style={{
        fontStyle: "normal",
        fontWeight: 700,
        color: "var(--text-primary)",
      }}
    >
      {children}
    </em>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        background: "var(--surface-subtle, rgba(0,0,0,0.02))",
        borderLeft: "2px solid var(--accent-blue)",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        color: "var(--text-primary)",
        lineHeight: 1.7,
        overflowX: "auto",
      }}
    >
      {children}
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "6px 12px",
        marginLeft: 14,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        color: "var(--text-secondary)",
        lineHeight: 1.7,
        overflowX: "auto",
      }}
    >
      {children}
    </div>
  );
}

function Result({ children }: { children: ReactNode }) {
  return (
    <strong
      style={{
        color: "var(--accent-emerald)",
        fontWeight: 800,
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </strong>
  );
}

function KVList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "4px 16px",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        padding: "4px 12px",
      }}
    >
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{k}</div>
          <div style={{ color: "var(--text-primary)" }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function Callout({ tone, children }: { tone: "ok" | "info" | "warn"; children: ReactNode }) {
  const palette =
    tone === "ok"
      ? { bg: "rgba(5,150,105,0.08)", border: "var(--accent-emerald)", color: "var(--accent-emerald)" }
      : tone === "warn"
      ? { bg: "rgba(245,158,11,0.10)", border: "var(--accent-amber)", color: "var(--accent-amber)" }
      : { bg: "rgba(29,78,216,0.08)", border: "var(--accent-blue)", color: "var(--accent-blue)" };
  return (
    <div
      style={{
        padding: "8px 12px",
        background: palette.bg,
        borderLeft: `3px solid ${palette.border}`,
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.6,
        color: palette.color,
      }}
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function formatMix(m: FixtureMix): string {
  const parts: string[] = [];
  if (m.lavatory) parts.push(`${m.lavatory}·lav×${WSFU.lavatory}`);
  if (m.kitchen) parts.push(`${m.kitchen}·kit×${WSFU.kitchen}`);
  if (m.shower) parts.push(`${m.shower}·shr×${WSFU.shower}`);
  if (m.tub) parts.push(`${m.tub}·tub×${WSFU.tub}`);
  if (m.dishwasher) parts.push(`${m.dishwasher}·dw×${WSFU.dishwasher}`);
  if (m.washer) parts.push(`${m.washer}·wsh×${WSFU.washer}`);
  return parts.join(" + ");
}

function fixtureLabel(k: keyof FixtureGPM): string {
  return k === "lavatory"
    ? "Bathroom sink"
    : k === "kitchen"
    ? "Kitchen sink"
    : k === "shower"
    ? "Shower"
    : k === "tub"
    ? "Tub"
    : k === "dishwasher"
    ? "Dishwasher"
    : "Clothes washer";
}

function methodLabel(m: DhwInputs["demandMethod"]): string {
  return m === "ashrae"
    ? "ASHRAE Ch. 51 Table 7"
    : m === "hunter"
    ? "Hunter / ASPE Modified"
    : "Occupancy (gpcd)";
}
