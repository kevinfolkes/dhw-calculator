/**
 * Main DHW sizing calculation pipeline. Single pure function that takes the
 * full input state and returns all derived outputs (demand, sizing, monthly
 * energy, compliance flags, auto-size recommendations).
 *
 * Ported verbatim from the original artifact's useMemo block so that every
 * engineering formula and coefficient matches. See the source references in
 * `lib/engineering/constants.ts`.
 */
import {
  ASHRAE_APT_DEMAND,
  CLIMATE_DESIGN,
  ENVELOPE_PRESETS,
  GAS_TANK_WH,
  GAS_TANKLESS_WH,
  GRID_EF,
  HPWH_TANK_FHR,
  HPWH_TIER_ADJUSTMENT,
  INUNIT_GAS_BUFFER_TANK_SIZES,
  INUNIT_RESISTANCE_TANK_SPEC,
  MONTHLY_HDD_FRAC,
  MONTH_DAYS,
  MONTHS,
  NG_LB_CO2_PER_THERM,
  STEAM_SATURATION_TEMP_F_AT_5PSIG,
  cascadeEfficiencyBonus,
} from "@/lib/engineering/constants";
import {
  deriveInletWaterF,
  getMonthlyHDDArchetype,
  monthlyAmbientAdjustment,
  monthlyInletAdjustment,
} from "@/lib/engineering/climate";
import { combiCOPAdjustment, hpwhCOP, hpwhCapacityFactor } from "@/lib/engineering/hpwh";
import {
  combinedPreheatLiftF,
  dwhrLiftF,
  solarMonthlyFraction,
  solarMonthlyLiftF,
} from "@/lib/engineering/preheat";
import { DWHR_DRAIN_TEMP_F } from "@/lib/engineering/constants";
import { applyRecircControl, recircStandbyLoss } from "@/lib/engineering/recirc";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import { autoSize } from "@/lib/sizing/auto-size";
import { computeDemand } from "./demand";
import type { DhwInputs } from "./inputs";
import type { CalcResult, ComplianceFlag, MonthlyRow } from "./types";

export function runCalc(input: DhwInputs): CalcResult {
  const {
    unitsStudio, units1BR, units2BR, units3BR, occupancyProfile, climateZone,
    storageSetpointF, deliveryF,
    demandMethod, occupantsPerUnit, gpcd,
    recircLoopLengthFt, pipeInsulationR, recircReturnTempF, ambientPipeF,
    gasEfficiency, boilerCount, hpwhRefrigerant, hpwhAmbientF, swingTankEnabled, hpwhTier,
    elecRate, gasRate, gridSubregion, customEF,
    avgUnitSqft, envelopePreset, indoorDesignF, combiTankSize,
    fanCoilSupplyF, combiDHWSetpointF, hpwhOpLimitF, ventilationLoadPerUnit,
    systemType, gasTankSize, gasTankType, gasTankSetpointF,
    gasTanklessInput, tanklessDesignRiseF, tanklessSimultaneousFixtures, gasTanklessSetpointF,
    centralGasTanklessInput, indirectHXEffectiveness,
    hybridSplitRatio, steamSourceEfficiency, steamHXEffectiveness, steamSupplyPressurePSIG,
    inunitGasTanklessCombiInput, inunitGasCombiBufferTankSize, inunitResistanceTankSize,
    bufferTankEnabled,
    preheat, solarCollectorAreaSqft, dwhrEffectiveness, dwhrCoverage,
    recircControl, timeClockHoursPerDay,
  } = input;

  // Base inlet temp BEFORE any preheat modifier — the climate-derived (or
  // manual override) annual mean. Phase D adds a preheat lift on top.
  const baseEffectiveInletF = input.inletWaterF ?? deriveInletWaterF(input.climateZone);

  // ---- PREHEAT MODIFIERS (Phase D) --------------------------------------
  // Compute the annual-average preheat lift here so design-day calcs (FHR,
  // sizing, peak BTU/hr) use a realistic annual lift rather than zero.
  // The monthly model below recomputes a per-month lift for the energy
  // rollup. Preheat fields default to "none" / 0 so existing behavior is
  // preserved when the modifier is inactive.
  const preheatActive = preheat !== "none";
  const solarActive = preheat === "solar" || preheat === "solar+dwhr";
  const dwhrActive = preheat === "dwhr" || preheat === "solar+dwhr";
  const hddArchetypePre = getMonthlyHDDArchetype(input.climateZone);
  // Use a coarse annual DHW BTU for the annual-average solar fraction (sum
  // of avg-day demand × annual rise × 365). Same denominator the monthly
  // model uses, just aggregated to annual so the design-day inlet sees the
  // same lift the energy-weighted average will produce.
  // We need avg-day demand for this — computed below — so we defer the
  // annual-average preheat lift until after the demand calc and re-resolve
  // `effectiveInletF` then. Use the base value for the demand calc itself
  // (demand is climate / occupancy driven, not inlet-temp driven).
  // Effective inlet for the rest of the pipeline starts at the base; we
  // patch in the annual lift right after demand is known.
  let effectiveInletF = baseEffectiveInletF;

  const totalUnits = unitsStudio + units1BR + units2BR + units3BR;
  const climate = CLIMATE_DESIGN[climateZone];
  const effectiveHpwhAmbient = hpwhAmbientF ?? climate.mechRoomAnnual;

  // HPWH efficiency tier — applied as a COP multiplier to every climate-based
  // hpwhCOP() call, so monthly / annual / combi COPs all scale consistently.
  // Default tier "energy_star" has multiplier 1.00 → existing inputs unchanged.
  const hpwhTierMult = HPWH_TIER_ADJUSTMENT[hpwhTier].copMultiplier;

  const ashraeProfile = ASHRAE_APT_DEMAND[occupancyProfile];

  // ---- DEMAND ------------------------------------------------------------
  const dem = computeDemand({
    unitsStudio, units1BR, units2BR, units3BR, occupancyProfile,
    demandMethod, occupantsPerUnit, gpcd,
  });
  const { peakHourGPH: peakHourDemand, peakDayGPH: peakDayDemand, avgDayGPH: avgDayDemand } = dem;

  // ---- PREHEAT LIFT — annual average (drives design-day calcs) ----------
  // With demand resolved, compute the annual-averaged preheat lift and patch
  // `effectiveInletF` so all downstream design-day math sees a realistic
  // pre-heated inlet. The monthly model below computes its own per-month
  // lift; we keep the annual lift consistent with the energy-weighted
  // average the monthly rollup will produce.
  let annualSolarFraction = 0;
  let annualDwhrLiftF = 0;
  let annualPreheatLiftF = 0;
  const monthlySolarFractions: number[] = new Array(12).fill(0);
  if (preheatActive) {
    // Annual baseline DHW BTU at base inlet (no preheat) — used as the
    // denominator for the energy-weighted annual solar fraction.
    const annualBaseDHW_BTU =
      avgDayDemand * 8.33 * Math.max(0, storageSetpointF - baseEffectiveInletF) * 365;

    if (solarActive) {
      // Sum monthly-collected BTU vs monthly load to derive an
      // energy-weighted annual SF. Per-month inlet uses the climate's
      // monthly inlet adjustment so the SF accounts for warmer summer
      // inlets reducing the load share solar can cover.
      let collectedAnnualBTU = 0;
      for (let m = 0; m < 12; m++) {
        const monthInletBase = baseEffectiveInletF + monthlyInletAdjustment(m, input.climateZone);
        const monthDHW_BTU =
          avgDayDemand * 8.33 * Math.max(0, storageSetpointF - monthInletBase) * MONTH_DAYS[m];
        const sf = solarMonthlyFraction(
          m, solarCollectorAreaSqft, hddArchetypePre, monthDHW_BTU, MONTH_DAYS[m],
        );
        monthlySolarFractions[m] = sf;
        collectedAnnualBTU += sf * monthDHW_BTU;
      }
      annualSolarFraction = annualBaseDHW_BTU > 0
        ? collectedAnnualBTU / annualBaseDHW_BTU
        : 0;
    }

    if (dwhrActive) {
      annualDwhrLiftF = dwhrLiftF(
        dwhrEffectiveness, dwhrCoverage, DWHR_DRAIN_TEMP_F, baseEffectiveInletF,
      );
    }

    const annualSolarLiftF = solarActive
      ? annualSolarFraction * Math.max(0, storageSetpointF - baseEffectiveInletF)
      : 0;
    annualPreheatLiftF = combinedPreheatLiftF(
      annualSolarLiftF, annualDwhrLiftF, storageSetpointF, baseEffectiveInletF,
    );
    effectiveInletF = baseEffectiveInletF + annualPreheatLiftF;
  }

  // ---- RECIRC ------------------------------------------------------------
  // Pure-physics raw loss (continuous pumping). The Phase E control-mode
  // multiplier is applied immediately so all downstream calcs (totalBTUH,
  // annual energy, cost) see the adjusted loss; the raw value is preserved
  // in the result for the Calculations / Current Design walkthrough.
  //
  // Non-recirc (in-unit) systems still compute the raw loss from the user's
  // loop inputs to preserve baseline regression behavior — the recirc field
  // is a no-op for those topologies because recoveryBTUH dominates totalBTUH
  // anyway, but we leave the raw number flowing through `recircLossBTUH` so
  // existing tests that compare against pre-Phase-E values stay deterministic.
  // The control-mode multiplier is only applied for `hasRecirc` topologies
  // (the result fields are zeroed for in-unit so tabs can detect the no-loop
  // case via `recircControlMultiplier > 0`).
  const sysDef = SYSTEM_TYPES[systemType];
  const rawRecirc = recircStandbyLoss({
    loopLengthFt: recircLoopLengthFt,
    insulationR: pipeInsulationR,
    returnTempF: recircReturnTempF,
    ambientPipeF,
  });
  const adjustedRecirc = sysDef.hasRecirc
    ? applyRecircControl(rawRecirc, recircControl, timeClockHoursPerDay)
    : { lossBTUH: rawRecirc.lossBTUH, lossKW: rawRecirc.lossKW, multiplier: 1.0 };
  const recircLossRawBTUH = rawRecirc.lossBTUH;
  const recircLossBTUH = adjustedRecirc.lossBTUH;
  const recircLossKW = adjustedRecirc.lossKW;
  const recircControlMultiplier = sysDef.hasRecirc ? adjustedRecirc.multiplier : 0;
  const recircLossSavingsBTUH = sysDef.hasRecirc
    ? Math.max(0, recircLossRawBTUH - recircLossBTUH)
    : 0;

  // ---- STORAGE / RECOVERY (ASHRAE) --------------------------------------
  // Tankless central plants size by peak instantaneous GPM × ΔT, not by FHR
  // + storage. Zero out the storage variables for that topology so downstream
  // tabs don't claim a phantom tank.
  const isCentralTankless = systemType === "central_gas_tankless";
  const isCentralIndirect = systemType === "central_indirect";
  const isCentralHybrid = systemType === "central_hybrid";
  const isCentralSteamHX = systemType === "central_steam_hx";
  const isInunitCombiGasTankless = systemType === "inunit_combi_gas_tankless";
  const isInunitResistance = systemType === "inunit_resistance";
  const isInunitCombiResistance = systemType === "inunit_combi_resistance";
  // Clamp the hybrid split ratio once so every downstream consumer
  // (annual rollups, monthly rows, auto-sizer) uses the same value.
  const hybridSafeRatio = Math.min(0.95, Math.max(0.05, hybridSplitRatio));
  const storageCoef = ashraeProfile.storageFrac;
  const recoveryCoef = ashraeProfile.recoveryFrac;
  const usableFraction = 0.75;
  const storageVolGal_nominal = isCentralTankless ? 0 : peakHourDemand * storageCoef;
  const storageVolGal = isCentralTankless ? 0 : storageVolGal_nominal / usableFraction;
  const temperMultiplier = (storageSetpointF - effectiveInletF) / (deliveryF - effectiveInletF);
  const temperedCapacityGal = isCentralTankless ? 0 : storageVolGal * temperMultiplier;

  const recoveryGPH = peakHourDemand * recoveryCoef;
  const temperatureRise = storageSetpointF - effectiveInletF;
  const recoveryBTUH = recoveryGPH * 8.33 * temperatureRise;
  const recoveryKW = recoveryBTUH / 3412;

  const totalBTUH = recoveryBTUH + recircLossBTUH;
  const totalKW = totalBTUH / 3412;

  // ---- TECH COMPARISON ---------------------------------------------------
  // For `central_indirect`, the boiler-side input must overcome both the
  // burner inefficiency and the heat-exchanger transfer derate from boiler
  // loop to potable. For `central_steam_hx`, the upstream steam source has
  // its own losses (district mains or in-building boiler + distribution),
  // and the HX has a separate transfer effectiveness. For all other systems
  // the combined HX effectiveness is 1.0.
  const steamCombinedEfficiencyRaw = steamSourceEfficiency * steamHXEffectiveness;
  // Only surface a non-zero `steamCombinedEfficiency` on the result when the
  // selected system type actually uses steam — otherwise it reads as 0 so
  // downstream tabs can detect the steam case by feature flag rather than
  // string-matching on `systemType` (avoids needing `inputs` plumbed into
  // tabs that only receive `result`).
  const steamCombinedEfficiency = isCentralSteamHX ? steamCombinedEfficiencyRaw : 0;
  // Cascade modulation gives a small seasonal-efficiency uplift for
  // multi-boiler central plants (central_gas, central_indirect, central_
  // hybrid gas leg). Other central systems (tankless modules, steam HX) and
  // all in-unit systems get no bonus. Bonus is +1% per added boiler, capped
  // at +3% — see CASCADE_EFFICIENCY_BONUS_* constants for sources.
  const cascadeBonusEligible =
    systemType === "central_gas" ||
    systemType === "central_indirect" ||
    systemType === "central_hybrid";
  const cascadeBonus = cascadeBonusEligible ? cascadeEfficiencyBonus(boilerCount) : 0;
  const cascadeAdjustedGasEfficiency = Math.min(0.99, gasEfficiency + cascadeBonus);
  const effectiveGasEfficiency = isCentralIndirect
    ? cascadeAdjustedGasEfficiency * indirectHXEffectiveness
    : isCentralSteamHX
    ? steamCombinedEfficiencyRaw
    : cascadeAdjustedGasEfficiency;
  const gasInputBTUH = totalBTUH / effectiveGasEfficiency;
  const resistanceInputKW = totalKW;
  const cop = hpwhCOP(effectiveHpwhAmbient, effectiveInletF, storageSetpointF, hpwhRefrigerant) * hpwhTierMult;
  const capFactor = hpwhCapacityFactor(effectiveHpwhAmbient, hpwhRefrigerant);
  const hpwhInputKW = totalKW / cop;
  const hpwhNameplateKW = hpwhInputKW / capFactor;
  const swingTankKW = swingTankEnabled ? recircLossKW + 9 : 0;

  // ---- ANNUAL ENERGY -----------------------------------------------------
  const annualDemandBTU = avgDayDemand * 8.33 * temperatureRise * 365;
  const annualRecircBTU = recircLossBTUH * 8760;
  const annualTotalBTU = annualDemandBTU + annualRecircBTU;
  const annualCOP = hpwhCOP(climate.mechRoomAnnual, effectiveInletF, storageSetpointF, hpwhRefrigerant) * hpwhTierMult;

  // Pure-fuel annual rollups. For `central_hybrid` we override the gas + HPWH
  // annual figures below so therms reflect only the gas-side share and
  // kWh reflects only the HPWH-side share. The resistance figures stay as
  // the "if you did this all in resistance" comparison row used by the
  // tech-comparison cards.
  let annualGasTherms = annualTotalBTU / (effectiveGasEfficiency * 100000);
  const annualResistanceKWh = annualTotalBTU / 3412;
  let annualHPWHKWh_total =
    annualTotalBTU / 3412 / annualCOP + (swingTankEnabled ? recircLossKW * 8760 * 0.5 : 0);

  if (isCentralHybrid) {
    const hybridGasBTU = annualTotalBTU * (1 - hybridSafeRatio);
    const hybridHpwhBTU = annualTotalBTU * hybridSafeRatio;
    // Hybrid's gas backup leg gets the same cascade bonus as a standalone
    // gas plant of equivalent size — staging works the same way.
    annualGasTherms = hybridGasBTU / (cascadeAdjustedGasEfficiency * 100000);
    annualHPWHKWh_total =
      hybridHpwhBTU / 3412 / annualCOP +
      (swingTankEnabled ? recircLossKW * 8760 * 0.5 : 0);
  }

  const annualGasCost = annualGasTherms * gasRate;
  const annualResistanceCost = annualResistanceKWh * elecRate;
  const annualHPWHCost = annualHPWHKWh_total * elecRate;

  const ef = gridSubregion === "Custom" ? customEF : GRID_EF[gridSubregion];
  const annualGasCarbon = annualGasTherms * NG_LB_CO2_PER_THERM;
  const annualResistanceCarbon = annualResistanceKWh * ef;
  const annualHPWHCarbon = annualHPWHKWh_total * ef;

  // Unified electric annual: aggregates whichever electric stream applies
  // for the configured system. Gas-only systems return 0. The in-unit
  // resistance variants are computed below (after the in-unit DHW BTU
  // total is available) and merged into this rollup at the end of the
  // pipeline; the let-binding lets us override.
  let annualElectricKWh =
    systemType === "central_resistance"
      ? annualResistanceKWh
      : systemType === "central_hpwh" ||
        systemType === "central_hybrid" ||
        systemType === "inunit_hpwh" ||
        systemType === "inunit_combi"
      ? annualHPWHKWh_total
      : 0;

  // ---- IN-UNIT COMBI (HPWH + hydronic fan coil) --------------------------
  const designDeltaT = indoorDesignF - climate.heatDB;
  const envFactor = ENVELOPE_PRESETS[envelopePreset].factor;
  const ventLoadPerUnit = ventilationLoadPerUnit * 1.08 * designDeltaT;

  const heatingLoad_0BR = avgUnitSqft.br0 * envFactor * designDeltaT + ventLoadPerUnit;
  const heatingLoad_1BR = avgUnitSqft.br1 * envFactor * designDeltaT + ventLoadPerUnit;
  const heatingLoad_2BR = avgUnitSqft.br2 * envFactor * designDeltaT + ventLoadPerUnit;
  const heatingLoad_3BR = avgUnitSqft.br3 * envFactor * designDeltaT + ventLoadPerUnit;
  const totalHeatingLoad =
    unitsStudio * heatingLoad_0BR +
    units1BR * heatingLoad_1BR +
    units2BR * heatingLoad_2BR +
    units3BR * heatingLoad_3BR;

  const dhwGPH_0BR = ashraeProfile.mh;
  const dhwGPH_1BR = ashraeProfile.mh;
  const dhwGPH_2BR = ashraeProfile.mh;
  const dhwGPH_3BR = ashraeProfile.mh;
  const dhwPeakInstantaneous_0BR = dhwGPH_0BR * 1.8 * 8.33 * (combiDHWSetpointF - effectiveInletF);
  const dhwPeakInstantaneous_1BR = dhwGPH_1BR * 1.8 * 8.33 * (combiDHWSetpointF - effectiveInletF);
  const dhwPeakInstantaneous_2BR = dhwGPH_2BR * 1.8 * 8.33 * (combiDHWSetpointF - effectiveInletF);
  const dhwPeakInstantaneous_3BR = dhwGPH_3BR * 1.8 * 8.33 * (combiDHWSetpointF - effectiveInletF);

  const tankSpec = HPWH_TANK_FHR[combiTankSize];
  const fhr = tankSpec.fhr;
  const worstPeakDHW = Math.max(dhwGPH_0BR, dhwGPH_1BR, dhwGPH_2BR, dhwGPH_3BR);
  const dhwMetByFHR = fhr >= worstPeakDHW;

  const effectiveTankSetpointForHeating = combiCOPAdjustment(fanCoilSupplyF, combiDHWSetpointF);
  const combiCOP_heating = hpwhCOP(70, effectiveInletF, effectiveTankSetpointForHeating, "HFC") * hpwhTierMult;
  const combiCOP_dhw = hpwhCOP(70, effectiveInletF, combiDHWSetpointF, "HFC") * hpwhTierMult;

  const combiCompressorOutputBTUH_0BR = tankSpec.input_kw * 3412 * combiCOP_heating;
  const combiCompressorOutputBTUH_1BR = tankSpec.input_kw * 3412 * combiCOP_heating;
  const combiCompressorOutputBTUH_2BR = tankSpec.input_kw * 3412 * combiCOP_heating;
  const combiCompressorOutputBTUH_3BR = tankSpec.input_kw * 3412 * combiCOP_heating;

  const heatingMetByHPWH_0BR = combiCompressorOutputBTUH_0BR >= heatingLoad_0BR;
  const heatingMetByHPWH_1BR = combiCompressorOutputBTUH_1BR >= heatingLoad_1BR;
  const heatingMetByHPWH_2BR = combiCompressorOutputBTUH_2BR >= heatingLoad_2BR;
  const heatingMetByHPWH_3BR = combiCompressorOutputBTUH_3BR >= heatingLoad_3BR;

  const resistanceBackup_0BR = Math.max(0, (heatingLoad_0BR - combiCompressorOutputBTUH_0BR) / 3412);
  const resistanceBackup_1BR = Math.max(0, (heatingLoad_1BR - combiCompressorOutputBTUH_1BR) / 3412);
  const resistanceBackup_2BR = Math.max(0, (heatingLoad_2BR - combiCompressorOutputBTUH_2BR) / 3412);
  const resistanceBackup_3BR = Math.max(0, (heatingLoad_3BR - combiCompressorOutputBTUH_3BR) / 3412);

  const needsFullResistanceBackup = climate.heatDB < hpwhOpLimitF;

  const dhwAvg_0BR = ashraeProfile.avg;
  const dhwAvg_1BR = ashraeProfile.avg;
  const dhwAvg_2BR = ashraeProfile.avg;
  const dhwAvg_3BR = ashraeProfile.avg;

  const annualHeatingBTU_0BR = (24 * climate.hdd65 * heatingLoad_0BR) / designDeltaT;
  const annualHeatingBTU_1BR = (24 * climate.hdd65 * heatingLoad_1BR) / designDeltaT;
  const annualHeatingBTU_2BR = (24 * climate.hdd65 * heatingLoad_2BR) / designDeltaT;
  const annualHeatingBTU_3BR = (24 * climate.hdd65 * heatingLoad_3BR) / designDeltaT;

  const annualDHWBTU_0BR = dhwAvg_0BR * 365 * 8.33 * (combiDHWSetpointF - effectiveInletF);
  const annualDHWBTU_1BR = dhwAvg_1BR * 365 * 8.33 * (combiDHWSetpointF - effectiveInletF);
  const annualDHWBTU_2BR = dhwAvg_2BR * 365 * 8.33 * (combiDHWSetpointF - effectiveInletF);
  const annualDHWBTU_3BR = dhwAvg_3BR * 365 * 8.33 * (combiDHWSetpointF - effectiveInletF);

  const seasonalCOP_heating = hpwhCOP((climate.avgAnnual + 55) / 2, effectiveInletF, effectiveTankSetpointForHeating, "HFC") * hpwhTierMult;
  const seasonalCOP_dhw = hpwhCOP(climate.avgAnnual, effectiveInletF, combiDHWSetpointF, "HFC") * hpwhTierMult;

  const resistanceShare = needsFullResistanceBackup ? 0.20 : 0.05;

  const combiAnnualPerUnit = (br: 0 | 1 | 2 | 3) => {
    const h =
      br === 0 ? annualHeatingBTU_0BR :
      br === 1 ? annualHeatingBTU_1BR :
      br === 2 ? annualHeatingBTU_2BR : annualHeatingBTU_3BR;
    const d =
      br === 0 ? annualDHWBTU_0BR :
      br === 1 ? annualDHWBTU_1BR :
      br === 2 ? annualDHWBTU_2BR : annualDHWBTU_3BR;
    const heatingKWh = (h * (1 - resistanceShare) / seasonalCOP_heating + h * resistanceShare) / 3412;
    const dhwKWh = d / seasonalCOP_dhw / 3412;
    return { heating: heatingKWh, dhw: dhwKWh, total: heatingKWh + dhwKWh };
  };

  const combi0BRAnnual = combiAnnualPerUnit(0);
  const combi1BRAnnual = combiAnnualPerUnit(1);
  const combi2BRAnnual = combiAnnualPerUnit(2);
  const combi3BRAnnual = combiAnnualPerUnit(3);

  const combiTotalAnnualKWh =
    unitsStudio * combi0BRAnnual.total +
    units1BR * combi1BRAnnual.total +
    units2BR * combi2BRAnnual.total +
    units3BR * combi3BRAnnual.total;
  const combiTotalAnnualCost = combiTotalAnnualKWh * elecRate;
  const combiTotalAnnualCarbon = combiTotalAnnualKWh * ef;

  const perUnitElecDemand = tankSpec.resistance_kw + 1.5;
  const buildingPeakDemandKW_combi = perUnitElecDemand * totalUnits * 0.65;

  // Buffer tank sizing for HPWH combi: prevents compressor short-cycling
  // during low-load heating operation. Rule of thumb: store enough heat
  // for 10 minutes of compressor runtime at a 10°F buffer swing.
  //   V_gal = Q_compressor_BTUH × t_min / (60 min/hr × 8.33 lb/gal × 1 BTU/lb·°F × ΔT_swing)
  // For common ranges this reduces to V ≈ Q_BTUH / 500.
  let bufferTankVolumeGal: number | null = null;
  if (bufferTankEnabled && systemType === "inunit_combi") {
    const worstCompressorBTUH = Math.max(
      combiCompressorOutputBTUH_0BR,
      combiCompressorOutputBTUH_1BR,
      combiCompressorOutputBTUH_2BR,
      combiCompressorOutputBTUH_3BR,
    );
    const MIN_RUNTIME_MIN = 10;
    const BUFFER_SWING_F = 10;
    const rawBufferGal = (worstCompressorBTUH * MIN_RUNTIME_MIN) / (60 * 8.33 * BUFFER_SWING_F);
    // Round up to common buffer-tank SKUs
    const BUFFER_SKUS = [20, 40, 50, 80, 120];
    bufferTankVolumeGal = BUFFER_SKUS.find((s) => s >= rawBufferGal) ?? 120;
  }

  const combi = {
    dhwGPH_0BR, dhwGPH_1BR, dhwGPH_2BR, dhwGPH_3BR,
    designDeltaT, envFactor,
    heatingLoad_0BR, heatingLoad_1BR, heatingLoad_2BR, heatingLoad_3BR, totalHeatingLoad,
    dhwPeakInstantaneous_0BR, dhwPeakInstantaneous_1BR, dhwPeakInstantaneous_2BR, dhwPeakInstantaneous_3BR,
    tankSpec, fhr, dhwMetByFHR, worstPeakDHW,
    combiCOP_heating, combiCOP_dhw, effectiveTankSetpointForHeating,
    combiCompressorOutputBTUH_0BR, combiCompressorOutputBTUH_1BR, combiCompressorOutputBTUH_2BR, combiCompressorOutputBTUH_3BR,
    heatingMetByHPWH_0BR, heatingMetByHPWH_1BR, heatingMetByHPWH_2BR, heatingMetByHPWH_3BR,
    resistanceBackup_0BR, resistanceBackup_1BR, resistanceBackup_2BR, resistanceBackup_3BR,
    needsFullResistanceBackup,
    combi0BRAnnual, combi1BRAnnual, combi2BRAnnual, combi3BRAnnual,
    combiTotalAnnualKWh, combiTotalAnnualCost, combiTotalAnnualCarbon,
    buildingPeakDemandKW_combi, perUnitElecDemand,
    ventLoadPerUnit,
    seasonalCOP_heating, seasonalCOP_dhw,
  };

  // ---- IN-UNIT GAS (tank + tankless) ------------------------------------
  const gasTankSpec = GAS_TANK_WH[gasTankSize];
  const gasTankUEF = gasTankType === "condensing" ? gasTankSpec.uef_cond : gasTankSpec.uef_atmos;
  const gasTankFHR = gasTankType === "condensing" ? gasTankSpec.fhr_condensing : gasTankSpec.fhr_atmospheric;

  const perUnitPeakGPH = ashraeProfile.mh;
  const gasTankFHRMet = gasTankFHR >= perUnitPeakGPH;
  const gasTankInputMBH = gasTankSpec.input_mbh;
  const gasTankRiseF = gasTankSetpointF - effectiveInletF;
  const gasTankOutputMBH = gasTankInputMBH * gasTankUEF;
  const gasTankRecoveryGPH = (gasTankOutputMBH * 1000) / (8.33 * gasTankRiseF);
  const gasTankAnnualBTU_perUnit = ashraeProfile.avg * 365 * 8.33 * gasTankRiseF;
  const gasTankAnnualTherms_perUnit = gasTankAnnualBTU_perUnit / (gasTankUEF * 100000);
  const gasTankBuildingTherms = gasTankAnnualTherms_perUnit * totalUnits;
  const gasTankBuildingCost = gasTankBuildingTherms * gasRate;
  const gasTankBuildingCarbon = gasTankBuildingTherms * NG_LB_CO2_PER_THERM;
  const gasTankCFH_perUnit = gasTankInputMBH;
  const gasDiversityFactor = totalUnits > 6 ? 0.70 : 0.90;
  const buildingGasDemandCFH = gasTankCFH_perUnit * totalUnits * gasDiversityFactor;

  const tanklessSpec = GAS_TANKLESS_WH[gasTanklessInput];
  // Peak simultaneous flow = (largest + governing fixtures) × diversity.
  // Take the top-N fixture-GPM values (N = simultaneous count), apply 15%
  // simultaneity derate (ASPE fixture co-use analysis).
  const sortedFlows = [
    input.fixtureGPM.shower,
    input.fixtureGPM.tub,
    input.fixtureGPM.kitchen,
    input.fixtureGPM.washer,
    input.fixtureGPM.dishwasher,
    input.fixtureGPM.lavatory,
  ].sort((a, b) => b - a);
  const N = Math.max(1, Math.min(tanklessSimultaneousFixtures, sortedFlows.length));
  const simultaneousSum = sortedFlows.slice(0, N).reduce((s, v) => s + v, 0);
  const tanklessPeakGPM = simultaneousSum * 0.85;
  const tanklessRequiredBTUH = tanklessPeakGPM * 500 * tanklessDesignRiseF;
  const tanklessCapacityAtRise = (tanklessSpec.input_mbh * tanklessSpec.uef * 1000) / (500 * tanklessDesignRiseF);
  const tanklessMetsDemand = tanklessCapacityAtRise >= tanklessPeakGPM;
  const tanklessAnnualBTU_perUnit = ashraeProfile.avg * 365 * 8.33 * (gasTanklessSetpointF - effectiveInletF);
  const tanklessAnnualTherms_perUnit = tanklessAnnualBTU_perUnit / (tanklessSpec.uef * 100000);
  const tanklessBuildingTherms = tanklessAnnualTherms_perUnit * totalUnits;
  const tanklessBuildingCost = tanklessBuildingTherms * gasRate;
  const tanklessBuildingCarbon = tanklessBuildingTherms * NG_LB_CO2_PER_THERM;
  const tanklessCFH_perUnit = tanklessSpec.input_mbh;
  const tanklessBuildingDemandCFH = tanklessCFH_perUnit * totalUnits * gasDiversityFactor;

  const inUnitGas = {
    gasTankSpec, gasTankUEF, gasTankFHR, gasTankFHRMet, gasTankInputMBH,
    gasTankOutputMBH, gasTankRiseF, gasTankRecoveryGPH,
    gasTankAnnualTherms_perUnit, gasTankBuildingTherms, gasTankBuildingCost, gasTankBuildingCarbon,
    gasTankCFH_perUnit, buildingGasDemandCFH, gasDiversityFactor, perUnitPeakGPH,
    tanklessSpec, tanklessPeakGPM, tanklessRequiredBTUH, tanklessCapacityAtRise, tanklessMetsDemand,
    tanklessAnnualTherms_perUnit, tanklessBuildingTherms, tanklessBuildingCost, tanklessBuildingCarbon,
    tanklessCFH_perUnit, tanklessBuildingDemandCFH,
  };

  // ---- CENTRAL GAS TANKLESS (peak instantaneous capacity check) ----------
  // ASHRAE Ch. 51 §"Instantaneous water heaters" recommends sizing tankless
  // plants to ~1.5× the peak 15-minute demand. Here we use 1.5× the average
  // peak-hour rate (peakHourDemand / 60) as a conservative proxy because
  // peakHourDemand is the smallest-interval demand the pipeline computes
  // upstream. Capacity at the design rise is set by the modulating
  // condensing tankless module's UEF (using the standard `gasEfficiency`
  // input as the UEF surrogate, default 0.92 for condensing central tankless).
  // Only compute tankless GPM fields when the active system actually is a
  // central tankless plant — otherwise the SizingTab's `> 0` gate would
  // mistake every other central system for tankless. (`isCentralTankless`
  // is already declared upstream where storage volume is zeroed; reuse it.)
  const centralTanklessDesignRiseF = isCentralTankless ? storageSetpointF - effectiveInletF : 0;
  const centralTanklessPeakGPMRequired = isCentralTankless ? (peakHourDemand / 60) * 1.5 : 0;
  const centralTanklessCapacityGPM =
    isCentralTankless && centralTanklessDesignRiseF > 0
      ? (centralGasTanklessInput * gasEfficiency * 1000) / (500 * centralTanklessDesignRiseF)
      : 0;
  const centralTanklessMetsDemand = isCentralTankless
    ? centralTanklessCapacityGPM >= centralTanklessPeakGPMRequired
    : true;

  // ---- CENTRAL HYBRID (HPWH baseload + gas peak/backup) ------------------
  // Split the design BTU/hr between an HPWH "primary" sized to the chosen
  // ratio and a gas backup sized for the remainder. Both pieces of equipment
  // exist on the plant and both contribute to annual energy. Storage gallons
  // mirror the central_gas / central_hpwh sizing.
  //
  // Implementation note: annual energy uses the SIMPLER annual-split
  // approximation called out in the plan — split annualTotalBTU by the
  // hybridSplitRatio rather than running a full month-by-month bin model
  // that re-allocates load when HPWH capacity drops in cold ambient. This
  // keeps the pipeline diff small; the monthly rows below mirror the same
  // split with monthly COP applied to the HPWH share.
  const hybridHpwhBTUH = isCentralHybrid ? totalBTUH * hybridSafeRatio : 0;
  const hybridGasBTUH = isCentralHybrid ? totalBTUH * (1 - hybridSafeRatio) : 0;
  const hybridGasInputMBH = isCentralHybrid
    ? hybridGasBTUH / gasEfficiency / 1000
    : 0;

  // ---- CENTRAL STEAM-TO-DHW HX (approach feasibility check) --------------
  // Steam at 5 PSIG saturates at ~227°F. The HX cannot heat potable above
  // (sat_T − ~20°F approach), so we flag setpoints that violate the
  // approach. We linearize the saturation curve coarsely from 5 PSIG to 15
  // PSIG (≈250°F): each PSIG above 5 adds ~2.3°F to saturation. Below 5
  // PSIG we extrapolate — at 2 PSIG (~219°F) a 140°F setpoint still has 79°F
  // approach margin so the warning won't fire under typical inputs.
  const steamSatTempF =
    STEAM_SATURATION_TEMP_F_AT_5PSIG + (steamSupplyPressurePSIG - 5) * 2.3;
  const steamApproachOK = isCentralSteamHX
    ? storageSetpointF + 20 < steamSatTempF
    : true;

  // ---- IN-UNIT COMBI GAS TANKLESS (modulating + buffer tank) -------------
  // Modern condensing tankless modulates 10:1, so min_fire ≈ 10% of the
  // selected max input. Buffer tank prevents short-cycling on low partial-
  // load heating calls: store enough heat for at least 5 minutes of burner
  // runtime at min_fire above the heating-loop demand, at a 15°F hydronic
  // buffer swing.
  //   V_gal = (min_fire_BTUH × 5 min) / (60 min/hr × 8.33 lb/gal × 15°F)
  //         ≈ min_fire_BTUH / 1500
  // DHW-side capacity check mirrors `inunit_gas_tankless`: peak GPM at the
  // user's design rise.
  const inunitCombiGasTanklessSpec = isInunitCombiGasTankless
    ? GAS_TANKLESS_WH[inunitGasTanklessCombiInput]
    : null;
  const inunitGasCombiMaxFireBTUH = isInunitCombiGasTankless && inunitCombiGasTanklessSpec
    ? inunitCombiGasTanklessSpec.input_mbh * inunitCombiGasTanklessSpec.uef * 1000
    : 0;
  const inunitGasCombiMinFireBTUH = inunitGasCombiMaxFireBTUH * 0.10;
  const inunitGasCombiBufferRequiredGalRaw = isInunitCombiGasTankless
    ? (inunitGasCombiMinFireBTUH * 5) / (60 * 8.33 * 15)
    : 0;
  const inunitGasCombiBufferAutoSKU = isInunitCombiGasTankless
    ? INUNIT_GAS_BUFFER_TANK_SIZES.find((s) => s >= inunitGasCombiBufferRequiredGalRaw)
        ?? INUNIT_GAS_BUFFER_TANK_SIZES[INUNIT_GAS_BUFFER_TANK_SIZES.length - 1]
    : 0;
  // User can override the SKU upward via inunitGasCombiBufferTankSize; we
  // surface the larger of (auto-sized minimum, user-selected SKU).
  const inunitGasCombiBufferSelectedGal = isInunitCombiGasTankless
    ? Math.max(inunitGasCombiBufferAutoSKU, inunitGasCombiBufferTankSize)
    : 0;
  const inunitGasCombiBufferRequiredGal = isInunitCombiGasTankless
    ? inunitGasCombiBufferRequiredGalRaw
    : 0;
  const inunitGasCombiPeakInstantGPM =
    isInunitCombiGasTankless && inunitCombiGasTanklessSpec
      ? (inunitCombiGasTanklessSpec.input_mbh * inunitCombiGasTanklessSpec.uef * 1000) /
        (500 * Math.max(1, tanklessDesignRiseF))
      : 0;

  // ---- IN-UNIT RESISTANCE (DHW only and combi variants) ------------------
  // Resistance tank is 1:1 at the element with modest standby losses
  // captured by UEF. For the combi variant, the kW input is the hard
  // ceiling on heating capacity (no compressor/burner reserve).
  const inunitResistanceSpec =
    isInunitResistance || isInunitCombiResistance
      ? INUNIT_RESISTANCE_TANK_SPEC[inunitResistanceTankSize]
      : null;

  // ---- MONTHLY MODEL -----------------------------------------------------
  const currentSysDef = SYSTEM_TYPES[systemType];
  const isInUnitGas_m = currentSysDef.topology === "inunit" && currentSysDef.tech === "gas";
  const hddArchetype = getMonthlyHDDArchetype(climateZone);
  const monthlyHDDFrac = MONTHLY_HDD_FRAC[hddArchetype];

  const totalHeatingAnnualBTU =
    unitsStudio * annualHeatingBTU_0BR +
    units1BR * annualHeatingBTU_1BR +
    units2BR * annualHeatingBTU_2BR +
    units3BR * annualHeatingBTU_3BR;

  const inUnitRiseF = isInUnitGas_m
    ? currentSysDef.subtech === "tankless"
      ? gasTanklessSetpointF - effectiveInletF
      : gasTankSetpointF - effectiveInletF
    : combiDHWSetpointF - effectiveInletF;
  const inUnitAnnualDHWBTU_perUnit = ashraeProfile.avg * 365 * 8.33 * inUnitRiseF;
  const inUnitAnnualDHWBTU_total = inUnitAnnualDHWBTU_perUnit * totalUnits;

  const monthly: MonthlyRow[] = MONTHS.map((mName, m) => {
    const daysInMonth = MONTH_DAYS[m];
    const monthAmbient = climate.avgAnnual + monthlyAmbientAdjustment(m, climateZone);
    const monthMechRoom = climate.mechRoomAnnual + monthlyAmbientAdjustment(m, climateZone) * 0.5;
    // Base monthly inlet (no preheat) — climate-only.
    const baseMonthInlet = baseEffectiveInletF + monthlyInletAdjustment(m, climateZone);
    // Per-month preheat lift: solar varies by month (insolation), DWHR is
    // a constant lift driven off the base monthly inlet (the available ΔT
    // shrinks slightly in summer when inlet is warmer — `dwhrLiftF` handles
    // that automatically via the (drainTemp - baseInlet) term).
    let monthSolarLiftF = 0;
    if (solarActive) {
      const monthDHWBaseBTU =
        avgDayDemand * 8.33 * Math.max(0, storageSetpointF - baseMonthInlet) * daysInMonth;
      monthSolarLiftF = solarMonthlyLiftF(
        m,
        solarCollectorAreaSqft,
        hddArchetypePre,
        monthDHWBaseBTU,
        daysInMonth,
        storageSetpointF,
        baseMonthInlet,
      );
    }
    const monthDwhrLiftF = dwhrActive
      ? dwhrLiftF(dwhrEffectiveness, dwhrCoverage, DWHR_DRAIN_TEMP_F, baseMonthInlet)
      : 0;
    const monthPreheatLiftF = preheatActive
      ? combinedPreheatLiftF(monthSolarLiftF, monthDwhrLiftF, storageSetpointF, baseMonthInlet)
      : 0;
    const monthInlet = baseMonthInlet + monthPreheatLiftF;

    const monthDHW_rise_central = storageSetpointF - monthInlet;
    const monthDHWBTU_central = avgDayDemand * 8.33 * monthDHW_rise_central * daysInMonth;

    const setptInUnit = isInUnitGas_m
      ? currentSysDef.subtech === "tankless"
        ? gasTanklessSetpointF
        : gasTankSetpointF
      : combiDHWSetpointF;
    const monthDHW_rise_inunit = setptInUnit - monthInlet;
    const monthDHWBTU_inunit_perUnit = ashraeProfile.avg * 8.33 * monthDHW_rise_inunit * daysInMonth;
    const monthDHWBTU_inunit_total = monthDHWBTU_inunit_perUnit * totalUnits;

    const monthCOP_central = hpwhCOP(monthMechRoom, monthInlet, storageSetpointF, hpwhRefrigerant) * hpwhTierMult;
    const monthCOP_dhw_inunit = hpwhCOP(monthMechRoom, monthInlet, combiDHWSetpointF, "HFC") * hpwhTierMult;
    const monthCOP_heating_inunit = hpwhCOP(monthMechRoom, monthInlet, effectiveTankSetpointForHeating, "HFC") * hpwhTierMult;

    const monthHeatingBTU = totalHeatingAnnualBTU * monthlyHDDFrac[m];
    const monthResistanceShare =
      monthAmbient < hpwhOpLimitF
        ? Math.min(0.5, 0.15 + (hpwhOpLimitF - monthAmbient) * 0.02)
        : 0.02;
    const monthHeatingKWh =
      (monthHeatingBTU * (1 - monthResistanceShare) / monthCOP_heating_inunit +
        monthHeatingBTU * monthResistanceShare) /
      3412;

    let dhwEnergy = 0;
    let heatingEnergy = 0;
    let unit: "kWh" | "therms" | "" = "";
    let dhwCost = 0;
    let heatingCost = 0;

    if (systemType === "central_gas") {
      const monthTotalBTU = monthDHWBTU_central + recircLossBTUH * 24 * daysInMonth;
      dhwEnergy = monthTotalBTU / (gasEfficiency * 100000);
      unit = "therms";
      dhwCost = dhwEnergy * gasRate;
    } else if (systemType === "central_gas_tankless") {
      // Modulating condensing tankless: same monthly demand and recirc loss
      // as a central gas plant, just no separate storage standby loss to
      // account for (the recirc-loop loss is already captured below).
      const monthTotalBTU = monthDHWBTU_central + recircLossBTUH * 24 * daysInMonth;
      dhwEnergy = monthTotalBTU / (gasEfficiency * 100000);
      unit = "therms";
      dhwCost = dhwEnergy * gasRate;
    } else if (systemType === "central_indirect") {
      // Boiler + indirect HX: combined efficiency = gasEfficiency × HX_eff.
      const monthTotalBTU = monthDHWBTU_central + recircLossBTUH * 24 * daysInMonth;
      dhwEnergy = monthTotalBTU / (gasEfficiency * indirectHXEffectiveness * 100000);
      unit = "therms";
      dhwCost = dhwEnergy * gasRate;
    } else if (systemType === "central_hybrid") {
      // HPWH + gas backup: split monthly BTU by the hybridSplitRatio.
      // HPWH share runs through the climate-adjusted COP (electric). Gas
      // share runs through gasEfficiency (therms). The energy-tab unit is
      // chosen by which fuel dominates the split — by convention we report
      // therms (gas) because the recirc loss + peak coverage is the gas
      // contribution most operators care about, but BOTH annual totals are
      // surfaced in the result so the Equipment / Current Design tabs can
      // show electricity and therms together.
      const monthTotalBTU = monthDHWBTU_central + recircLossBTUH * 24 * daysInMonth;
      const monthHpwhBTU = monthTotalBTU * hybridSafeRatio;
      const monthGasBTU = monthTotalBTU * (1 - hybridSafeRatio);
      const monthHpwhKWh = monthHpwhBTU / 3412 / monthCOP_central;
      const monthGasTherms = monthGasBTU / (gasEfficiency * 100000);
      // Combine electricity (kWh) and gas (therms) into a kWh-equivalent
      // for the monthly row's `dhwEnergy` so totals are non-zero, but mark
      // the unit "therms" since that's what the bulk of the annual energy
      // tab expects for a gas-bearing system. The Energy tab displays gas
      // and electric separately based on systemType; the per-row total
      // here is informational.
      unit = "therms";
      dhwEnergy = monthGasTherms + monthHpwhKWh / 29.3;
      dhwCost = monthGasTherms * gasRate + monthHpwhKWh * elecRate;
    } else if (systemType === "central_steam_hx") {
      // Steam HX: combined efficiency = steamSourceEff × steamHXEff. We
      // report annual energy as "steam therms" (a gas-equivalent unit) so
      // the cost / carbon cards can reuse the existing therms infrastructure.
      // See Methodology tab for the caveat that district steam is often
      // billed in $/MMBtu with carbon driven by plant fuel mix.
      const monthTotalBTU = monthDHWBTU_central + recircLossBTUH * 24 * daysInMonth;
      dhwEnergy = monthTotalBTU / (steamCombinedEfficiencyRaw * 100000);
      unit = "therms";
      dhwCost = dhwEnergy * gasRate;
    } else if (systemType === "central_resistance") {
      const monthTotalBTU = monthDHWBTU_central + recircLossBTUH * 24 * daysInMonth;
      dhwEnergy = monthTotalBTU / 3412;
      unit = "kWh";
      dhwCost = dhwEnergy * elecRate;
    } else if (systemType === "central_hpwh") {
      const monthTotalBTU = monthDHWBTU_central + recircLossBTUH * 24 * daysInMonth;
      dhwEnergy = monthTotalBTU / 3412 / monthCOP_central;
      unit = "kWh";
      dhwCost = dhwEnergy * elecRate;
    } else if (systemType === "inunit_gas_tank") {
      dhwEnergy = monthDHWBTU_inunit_total / (gasTankUEF * 100000);
      unit = "therms";
      dhwCost = dhwEnergy * gasRate;
    } else if (systemType === "inunit_gas_tankless") {
      dhwEnergy = monthDHWBTU_inunit_total / (tanklessSpec.uef * 100000);
      unit = "therms";
      dhwCost = dhwEnergy * gasRate;
    } else if (systemType === "inunit_hpwh") {
      dhwEnergy = monthDHWBTU_inunit_total / 3412 / monthCOP_dhw_inunit;
      unit = "kWh";
      dhwCost = dhwEnergy * elecRate;
    } else if (systemType === "inunit_combi") {
      dhwEnergy = monthDHWBTU_inunit_total / 3412 / monthCOP_dhw_inunit;
      heatingEnergy = monthHeatingKWh;
      unit = "kWh";
      dhwCost = dhwEnergy * elecRate;
      heatingCost = heatingEnergy * elecRate;
    } else if (systemType === "inunit_combi_gas") {
      // Single gas storage tank serves DHW + hydronic fan coil. Both loads
      // convert through the tank UEF at full-year gas efficiency.
      const monthHeatingBTU = totalHeatingAnnualBTU * monthlyHDDFrac[m];
      dhwEnergy = monthDHWBTU_inunit_total / (gasTankUEF * 100000);
      heatingEnergy = monthHeatingBTU / (gasTankUEF * 100000);
      unit = "therms";
      dhwCost = dhwEnergy * gasRate;
      heatingCost = heatingEnergy * gasRate;
    } else if (systemType === "inunit_combi_gas_tankless" && inunitCombiGasTanklessSpec) {
      // Modulating condensing tankless serves both DHW and hydronic fan
      // coil. Both loads convert through the tankless UEF — the buffer tank
      // is a control element (prevents short-cycling) and is treated as
      // efficiency-neutral at the monthly granularity.
      const monthHeatingBTU = totalHeatingAnnualBTU * monthlyHDDFrac[m];
      dhwEnergy = monthDHWBTU_inunit_total / (inunitCombiGasTanklessSpec.uef * 100000);
      heatingEnergy = monthHeatingBTU / (inunitCombiGasTanklessSpec.uef * 100000);
      unit = "therms";
      dhwCost = dhwEnergy * gasRate;
      heatingCost = heatingEnergy * gasRate;
    } else if (systemType === "inunit_resistance" && inunitResistanceSpec) {
      // Resistance tank — 1:1 at the element, UEF captures standby losses.
      dhwEnergy = monthDHWBTU_inunit_total / 3412 / inunitResistanceSpec.uef;
      unit = "kWh";
      dhwCost = dhwEnergy * elecRate;
    } else if (systemType === "inunit_combi_resistance" && inunitResistanceSpec) {
      // Resistance combi: DHW through tank UEF (with standby losses);
      // heating through the element directly at 1:1 (the heating loop
      // bypasses the tank's storage standby term).
      const monthHeatingBTU = totalHeatingAnnualBTU * monthlyHDDFrac[m];
      dhwEnergy = monthDHWBTU_inunit_total / 3412 / inunitResistanceSpec.uef;
      heatingEnergy = monthHeatingBTU / 3412;
      unit = "kWh";
      dhwCost = dhwEnergy * elecRate;
      heatingCost = heatingEnergy * elecRate;
    }

    let dhwCarbon = 0;
    let heatingCarbon = 0;
    if (unit === "therms") {
      dhwCarbon = dhwEnergy * NG_LB_CO2_PER_THERM;
      heatingCarbon = heatingEnergy * NG_LB_CO2_PER_THERM;
    } else {
      dhwCarbon = dhwEnergy * ef;
      heatingCarbon = heatingEnergy * ef;
    }

    // --------------------------------------------------------------
    // Effective monthly efficiency / COP per system type. The HPWH
    // variables (monthCOP_* above) are only physically meaningful for
    // heat-pump systems — for gas and resistance we report UEF or
    // unity so the Energy tab / tooltip / exports don't misrepresent
    // a gas system as having a COP of 3 in July.
    // --------------------------------------------------------------
    let effectiveMonthCOP_dhw = 0;
    let effectiveMonthCOP_heating = 0;
    if (systemType === "central_gas") {
      effectiveMonthCOP_dhw = gasEfficiency;
    } else if (systemType === "central_gas_tankless") {
      effectiveMonthCOP_dhw = gasEfficiency;
    } else if (systemType === "central_indirect") {
      effectiveMonthCOP_dhw = gasEfficiency * indirectHXEffectiveness;
    } else if (systemType === "central_hybrid") {
      // Blended effective efficiency: HPWH side runs at monthCOP_central,
      // gas side at gasEfficiency. Weight by the split ratio so the row
      // reports a single number consistent with the ratio.
      effectiveMonthCOP_dhw =
        hybridSafeRatio * monthCOP_central + (1 - hybridSafeRatio) * gasEfficiency;
    } else if (systemType === "central_steam_hx") {
      effectiveMonthCOP_dhw = steamCombinedEfficiencyRaw;
    } else if (systemType === "central_resistance") {
      effectiveMonthCOP_dhw = 1.0;
    } else if (systemType === "central_hpwh") {
      effectiveMonthCOP_dhw = monthCOP_central;
    } else if (systemType === "inunit_gas_tank") {
      effectiveMonthCOP_dhw = gasTankUEF;
    } else if (systemType === "inunit_gas_tankless") {
      effectiveMonthCOP_dhw = tanklessSpec.uef;
    } else if (systemType === "inunit_hpwh") {
      effectiveMonthCOP_dhw = monthCOP_dhw_inunit;
    } else if (systemType === "inunit_combi") {
      effectiveMonthCOP_dhw = monthCOP_dhw_inunit;
      effectiveMonthCOP_heating = monthCOP_heating_inunit;
    } else if (systemType === "inunit_combi_gas") {
      effectiveMonthCOP_dhw = gasTankUEF;
      effectiveMonthCOP_heating = gasTankUEF;
    } else if (systemType === "inunit_combi_gas_tankless" && inunitCombiGasTanklessSpec) {
      effectiveMonthCOP_dhw = inunitCombiGasTanklessSpec.uef;
      effectiveMonthCOP_heating = inunitCombiGasTanklessSpec.uef;
    } else if (systemType === "inunit_resistance" && inunitResistanceSpec) {
      effectiveMonthCOP_dhw = inunitResistanceSpec.uef;
    } else if (systemType === "inunit_combi_resistance" && inunitResistanceSpec) {
      effectiveMonthCOP_dhw = inunitResistanceSpec.uef;
      effectiveMonthCOP_heating = 1.0;
    }

    // Per-apartment figures (useful for tenant-billing comparisons and for
    // the tooltip on the Energy tab). For therms systems, per-apartment is
    // often shown to three decimals — use more resolution than the building total.
    const aptCount = Math.max(1, totalUnits);
    const perAptDigits = unit === "therms" ? 2 : 1;
    const roundApt = (v: number) => +(v / aptCount).toFixed(perAptDigits);

    return {
      month: mName,
      monthIdx: m,
      daysInMonth,
      monthAmbient: +monthAmbient.toFixed(1),
      monthMechRoom: +monthMechRoom.toFixed(1),
      monthInlet: +monthInlet.toFixed(1),
      monthCOP_dhw: +effectiveMonthCOP_dhw.toFixed(2),
      monthCOP_heating: +effectiveMonthCOP_heating.toFixed(2),
      monthResistanceShare: +monthResistanceShare.toFixed(3),
      dhwEnergy: +dhwEnergy.toFixed(0),
      heatingEnergy: +heatingEnergy.toFixed(0),
      totalEnergy: +(dhwEnergy + heatingEnergy).toFixed(0),
      dhwPerApt: roundApt(dhwEnergy),
      heatingPerApt: roundApt(heatingEnergy),
      totalPerApt: roundApt(dhwEnergy + heatingEnergy),
      dhwCost: +dhwCost.toFixed(0),
      heatingCost: +heatingCost.toFixed(0),
      totalCost: +(dhwCost + heatingCost).toFixed(0),
      dhwCarbon: +dhwCarbon.toFixed(0),
      heatingCarbon: +heatingCarbon.toFixed(0),
      totalCarbon: +(dhwCarbon + heatingCarbon).toFixed(0),
      unit,
    };
  });

  const monthlyAnnualEnergy = monthly.reduce((s, m) => s + m.totalEnergy, 0);
  const monthlyAnnualDHW = monthly.reduce((s, m) => s + m.dhwEnergy, 0);
  const monthlyAnnualHeating = monthly.reduce((s, m) => s + m.heatingEnergy, 0);
  const monthlyAnnualCost = monthly.reduce((s, m) => s + m.totalCost, 0);
  const monthlyAnnualCarbon = monthly.reduce((s, m) => s + m.totalCarbon, 0);
  const monthlyUnit = monthly[0].unit;

  const monthlyResults = {
    monthly, monthlyAnnualEnergy, monthlyAnnualDHW, monthlyAnnualHeating,
    monthlyAnnualCost, monthlyAnnualCarbon, monthlyUnit,
    dhwFraction: monthlyAnnualEnergy > 0 ? monthlyAnnualDHW / monthlyAnnualEnergy : 1,
    heatingFraction: monthlyAnnualEnergy > 0 ? monthlyAnnualHeating / monthlyAnnualEnergy : 0,
  };

  // ---- IN-UNIT RESISTANCE ANNUAL ROLLUPS (DHW + combi) -------------------
  // These override the unified `annualElectricKWh` so the Compare / Energy
  // tabs see the correct per-tech annual without bleeding the resistance
  // figure through to gas-only systems. The monthly model already produces
  // the same numbers; we mirror them here for tabs that read the rollup
  // directly (matches the central_resistance / central_hpwh pattern).
  if (isInunitResistance && inunitResistanceSpec) {
    annualElectricKWh = inUnitAnnualDHWBTU_total / 3412 / inunitResistanceSpec.uef;
  } else if (isInunitCombiResistance && inunitResistanceSpec) {
    const dhwKWh = inUnitAnnualDHWBTU_total / 3412 / inunitResistanceSpec.uef;
    const heatingKWh = totalHeatingAnnualBTU / 3412;
    annualElectricKWh = dhwKWh + heatingKWh;
  }

  // ---- IN-UNIT COMBI RESISTANCE — heating capacity feasibility ----------
  // Element kW × 3412 BTU/hr/kW is the hard ceiling on per-unit heating
  // capacity (no compressor or burner reserve). Flag any per-BR heating
  // load that exceeds the ceiling — the combi cannot meet that load even
  // with the buffer tank fully primed.
  const inunitResistanceWorstHeatingKW =
    isInunitCombiResistance
      ? Math.max(heatingLoad_0BR, heatingLoad_1BR, heatingLoad_2BR, heatingLoad_3BR) / 3412
      : 0;
  const inunitResistanceMeetsHeating =
    !isInunitCombiResistance ||
    !inunitResistanceSpec ||
    inunitResistanceSpec.kw >= inunitResistanceWorstHeatingKW;

  // ---- AUTO-SIZING -------------------------------------------------------
  const autoSizeResults = autoSize({
    input,
    ashraeProfile,
    peakHourDemand,
    storageCoef,
    usableFraction,
    storageVolGal_nominal,
    totalBTUH,
    totalKW,
    hpwhNameplateKW,
    annualTotalBTU,
    annualCOP,
    inUnitAnnualDHWBTU_total,
    totalHeatingAnnualBTU,
    seasonalCOP_heating,
    needsFullResistanceBackup,
    heatingLoad_0BR, heatingLoad_1BR, heatingLoad_2BR, heatingLoad_3BR,
    combiCOP_heating,
    tanklessPeakGPM,
    totalUnits,
    centralTanklessPeakGPMRequired,
    centralTanklessDesignRiseF,
    inunitGasCombiBufferRequiredGal,
    inunitGasCombiBufferSelectedGal,
    inunitResistanceWorstHeatingKW,
  });

  // ---- COMPLIANCE FLAGS --------------------------------------------------
  const extraFlags: ComplianceFlag[] = [];
  if (isInunitCombiResistance && inunitResistanceSpec && !inunitResistanceMeetsHeating) {
    extraFlags.push({
      level: "warn",
      code: "Manufacturer / Manual J",
      msg: `${inunitResistanceTankSize}-gal resistance combi element (${inunitResistanceSpec.kw} kW = ${(inunitResistanceSpec.kw * 3412).toFixed(0)} BTU/hr) below worst per-unit heating load (${(inunitResistanceWorstHeatingKW * 3412).toFixed(0)} BTU/hr). Resistance has no compressor reserve — step up element rating, switch to HPWH combi, or split heating onto a dedicated resistance baseboard.`,
    });
  }
  const flags = [...extraFlags, ...buildComplianceFlags({
    input,
    storageSetpointF, deliveryF, pipeInsulationR,
    storageVolGal, hpwhInputKW, gasInputBTUH, gasEfficiency,
    recircLossBTUH, totalBTUH, peakHourDemand, demandMethod,
    combi, inUnitGas,
    systemType,
    combiTankSize, combiDHWSetpointF, fanCoilSupplyF, hpwhOpLimitF,
    climate, gasTankSize, gasTankType, gasTanklessInput, tanklessDesignRiseF,
    units3BR,
  })];

  return {
    totalUnits,
    totalOccupants: dem.totalOccupants,
    hotWSFU: dem.hotWSFU,
    wsfuBreakdown: dem.wsfuBreakdown,
    demandASHRAE_MH: dem.ashraeMH,
    demandHunter_MH: dem.hunterMH,
    demandOccupancy_MH: dem.occupancyMH,
    peakGPM_modified: dem.peakGPM_modified,
    peakGPM_classical: dem.peakGPM_classical,
    peakInstantGPM: +tanklessPeakGPM.toFixed(2),
    peakInstantGPH: +(tanklessPeakGPM * 60).toFixed(0),
    peakInstantFixtureCount: N,
    diversityFactor: dem.diversityFactor,
    peakHourDemand, peakDayDemand, avgDayDemand,
    recircLossBTUH, recircLossKW,
    storageVolGal, storageVolGal_nominal, temperedCapacityGal,
    recoveryGPH, recoveryBTUH, recoveryKW, totalBTUH, totalKW,
    gasInputBTUH, resistanceInputKW,
    cop, capFactor, hpwhInputKW, hpwhNameplateKW, swingTankKW, effectiveHpwhAmbient,
    annualCOP, annualGasTherms, annualResistanceKWh, annualHPWHKWh_total,
    annualGasCost, annualResistanceCost, annualHPWHCost,
    annualGasCarbon, annualResistanceCarbon, annualHPWHCarbon,
    flags,
    climate,
    temperatureRise,
    temperMultiplier,
    combi,
    inUnitGas,
    monthly: monthlyResults,
    autoSize: autoSizeResults,
    effectiveInletF,
    bufferTankVolumeGal,
    centralTanklessPeakGPMRequired,
    centralTanklessCapacityGPM,
    centralTanklessMetsDemand,
    effectiveGasEfficiency,
    hybridHpwhBTUH,
    hybridGasBTUH,
    hybridGasInputMBH,
    steamCombinedEfficiency,
    steamApproachOK,
    annualElectricKWh,
    inunitGasCombiBufferRequiredGal,
    inunitGasCombiBufferSelectedGal,
    inunitGasCombiPeakInstantGPM,
    preheatType: preheat,
    annualSolarFraction: preheatActive ? +annualSolarFraction.toFixed(4) : 0,
    annualDwhrLiftF: preheatActive ? +annualDwhrLiftF.toFixed(2) : 0,
    annualPreheatLiftF: preheatActive ? +annualPreheatLiftF.toFixed(2) : 0,
    monthlySolarFractions: preheatActive
      ? monthlySolarFractions.map((v) => +v.toFixed(4))
      : new Array(12).fill(0),
    recircControl,
    recircControlMultiplier: +recircControlMultiplier.toFixed(4),
    recircLossSavingsBTUH: +recircLossSavingsBTUH.toFixed(0),
    recircLossRawBTUH: +recircLossRawBTUH.toFixed(0),
  };
}

// ---------------------------------------------------------------------------
// COMPLIANCE FLAG BUILDER — ported verbatim from the artifact
// ---------------------------------------------------------------------------
interface FlagCtx {
  input: DhwInputs;
  storageSetpointF: number;
  deliveryF: number;
  pipeInsulationR: number;
  storageVolGal: number;
  hpwhInputKW: number;
  gasInputBTUH: number;
  gasEfficiency: number;
  recircLossBTUH: number;
  totalBTUH: number;
  peakHourDemand: number;
  demandMethod: string;
  combi: CalcResult["combi"];
  inUnitGas: CalcResult["inUnitGas"];
  systemType: DhwInputs["systemType"];
  combiTankSize: number;
  combiDHWSetpointF: number;
  fanCoilSupplyF: number;
  hpwhOpLimitF: number;
  climate: CalcResult["climate"];
  gasTankSize: number;
  gasTankType: string;
  gasTanklessInput: number;
  tanklessDesignRiseF: number;
  units3BR: number;
}

function buildComplianceFlags(ctx: FlagCtx): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const {
    storageSetpointF, deliveryF, pipeInsulationR, storageVolGal, hpwhInputKW,
    gasInputBTUH, gasEfficiency, recircLossBTUH, totalBTUH, peakHourDemand, demandMethod,
    combi, inUnitGas, systemType, combiTankSize, combiDHWSetpointF, fanCoilSupplyF,
    hpwhOpLimitF, climate, gasTankSize, gasTankType, gasTanklessInput, tanklessDesignRiseF,
    units3BR,
  } = ctx;

  if (storageSetpointF < 140) {
    flags.push({ level: "warn", code: "ASHRAE 188-2021 §7.2", msg: `Storage <140°F (${storageSetpointF}°F) — Legionella risk. Requires documented water management plan.` });
  }
  if (deliveryF > 120) {
    flags.push({ level: "warn", code: "ASSE 1070 / IPC 424.3", msg: `Delivery >120°F (${deliveryF}°F) — scald risk; thermostatic mixing valve required at fixtures.` });
  }
  if (pipeInsulationR < 4) {
    flags.push({ level: "warn", code: "ASHRAE 90.1-2022 §6.4.4.1.3", msg: `Pipe insulation R-${pipeInsulationR} below prescriptive minimum (R-4 for ≥2" pipe, recirc loops).` });
  }
  if (storageVolGal > 135 && hpwhInputKW > 0) {
    flags.push({ level: "info", code: "ASHRAE 90.1-2022 Table 7.8", msg: `Large HPWH (${storageVolGal.toFixed(0)} gal) — verify equipment meets min efficiency (typical COP 2.2+ rated).` });
  }
  if (gasInputBTUH > 200000 && gasEfficiency < 0.82) {
    flags.push({ level: "warn", code: "ASHRAE 90.1-2022 Table 7.8", msg: `Commercial gas water heater >200 MBH: minimum Et ≥82%. Specified ${(gasEfficiency * 100).toFixed(0)}% is below threshold.` });
  }
  if (recircLossBTUH > totalBTUH * 0.3) {
    flags.push({ level: "warn", code: "ASHRAE 90.1-2022 §6.5.4.6", msg: `Recirc losses >30% of total load. Review loop length, insulation, and demand-control pump strategy.` });
  }
  if (peakHourDemand > 0) {
    flags.push({ level: "ok", code: "ASHRAE Ch. 51", msg: `Peak-hour demand calculated using ${demandMethod.toUpperCase()} method. Cross-check against fixture count and occupancy recommended.` });
  }
  if (combiDHWSetpointF < 140) {
    flags.push({ level: "warn", code: "ASHRAE 188-2021 / IRC P2801", msg: `In-unit combi DHW setpoint ${combiDHWSetpointF}°F — below 140°F Legionella threshold. Most in-unit HPWHs run 120-130°F; scald valves at fixtures recommended regardless. Consider periodic thermal disinfection cycles.` });
  }
  if (fanCoilSupplyF > combiDHWSetpointF - 5) {
    flags.push({ level: "warn", code: "AHRI 1230", msg: `Fan coil supply temp (${fanCoilSupplyF}°F) too close to tank temp (${combiDHWSetpointF}°F). Fan coil won't have adequate ΔT for design heating output. Raise tank or lower fan coil design temp.` });
  }
  if (combi.needsFullResistanceBackup) {
    flags.push({ level: "warn", code: "NEEA AWHS / Manufacturer spec", msg: `Climate design temp (${climate.heatDB}°F) is below HPWH operating limit (${hpwhOpLimitF}°F). Resistance backup will run frequently — system will behave closer to electric resistance during coldest periods.` });
  }
  if (!combi.heatingMetByHPWH_3BR && units3BR > 0) {
    flags.push({ level: "info", code: "ACCA Manual J", msg: `3BR design heating load (${combi.heatingLoad_3BR.toFixed(0)} BTU/hr) exceeds ${combiTankSize}-gal HPWH compressor capacity (${combi.combiCompressorOutputBTUH_3BR.toFixed(0)} BTU/hr). ${combi.resistanceBackup_3BR.toFixed(1)} kW resistance backup required.` });
  }
  if (!combi.dhwMetByFHR) {
    flags.push({ level: "warn", code: "AHRI 1300 / FHR", msg: `${combiTankSize}-gal tank FHR (${combi.fhr} GPH) below occupancy profile peak (${combi.worstPeakDHW} GPH). Step up tank size or select higher-FHR equipment.` });
  }

  if (systemType === "inunit_gas_tank") {
    if (!inUnitGas.gasTankFHRMet) {
      flags.push({ level: "warn", code: "DOE / AHRI 1300", msg: `${gasTankSize}-gal gas tank FHR (${inUnitGas.gasTankFHR} GPH) below ASHRAE peak hour (${inUnitGas.perUnitPeakGPH} GPH). Step up tank size or switch to condensing/tankless.` });
    }
    if (gasTankType === "atmospheric" && gasTankSize >= 50) {
      flags.push({ level: "warn", code: "ASHRAE 90.1-2022 §7.4 / DOE UEF", msg: `Atmospheric tank ≥50 gal no longer manufactured for new construction. Federal UEF requires 0.81+ for 40-55 gal gas tanks since 2015 — specify condensing or power-vent.` });
    }
    if (gasTankType === "atmospheric") {
      flags.push({ level: "info", code: "IFGC Ch. 3 / ASHRAE 62.2", msg: `Atmospheric venting requires combustion air per IFGC §304 (50 CFM/1000 BTU input). Incompatible with tight envelopes (ACH50 ≤3.0) per ASHRAE 62.2 — use direct-vent sealed combustion.` });
    }
    if (gasTankType === "condensing") {
      flags.push({ level: "info", code: "IFGC §503 / Cat IV", msg: `Condensing tank: Category IV venting required (PVC/CPVC/PP), dedicated vent per unit through exterior wall. Condensate drain required — verify trap per manufacturer.` });
    }
    flags.push({ level: "info", code: "IFGC Ch. 4", msg: `Per-unit gas supply sized for ${inUnitGas.gasTankCFH_perUnit} CFH. Building gas demand at ${(inUnitGas.gasDiversityFactor * 100).toFixed(0)}% diversity: ${inUnitGas.buildingGasDemandCFH.toFixed(0)} CFH — verify service/meter capacity.` });
  }
  if (systemType === "inunit_gas_tankless") {
    if (!inUnitGas.tanklessMetsDemand) {
      flags.push({ level: "warn", code: "ASPE / Manufacturer sizing", msg: `${gasTanklessInput} MBH tankless output (${inUnitGas.tanklessCapacityAtRise.toFixed(1)} GPM at ${tanklessDesignRiseF}°F rise) below design peak (${inUnitGas.tanklessPeakGPM.toFixed(1)} GPM). Step up input or reduce design rise.` });
    }
    flags.push({ level: "info", code: "ASHRAE 90.1 Table 7.8", msg: `Instantaneous gas WH minimum Et ≥0.80. Specified UEF ${inUnitGas.tanklessSpec.uef} ${inUnitGas.tanklessSpec.uef >= 0.80 ? "✓ meets" : "✗ below"} prescriptive requirement.` });
    flags.push({ level: "info", code: "IFGC Ch. 4", msg: `Tankless at ${gasTanklessInput} MBH typically requires 3/4" gas supply line per unit. Building peak gas demand ${inUnitGas.tanklessBuildingDemandCFH.toFixed(0)} CFH at ${(inUnitGas.gasDiversityFactor * 100).toFixed(0)}% diversity.` });
    flags.push({ level: "info", code: "Manufacturer / AHRI 1700", msg: `Modulation ratio ${inUnitGas.tanklessSpec.modulation}. Lower ratios cycle on small draws, reducing real-world efficiency 5-10% below UEF.` });
  }
  if (systemType === "inunit_gas_tank" || systemType === "inunit_gas_tankless") {
    flags.push({ level: "info", code: "Local codes / ASHRAE 62.2", msg: `Many jurisdictions (CA Title 24, NYC LL154, some CO counties, etc.) now restrict or prohibit new gas appliance installations. Verify local AHJ.` });
  }

  return flags;
}
