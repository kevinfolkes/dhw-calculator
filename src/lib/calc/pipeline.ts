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
  MONTHLY_HDD_FRAC,
  MONTH_DAYS,
  MONTHS,
  NG_LB_CO2_PER_THERM,
} from "@/lib/engineering/constants";
import {
  deriveInletWaterF,
  getMonthlyHDDArchetype,
  monthlyAmbientAdjustment,
  monthlyInletAdjustment,
} from "@/lib/engineering/climate";
import { combiCOPAdjustment, hpwhCOP, hpwhCapacityFactor } from "@/lib/engineering/hpwh";
import { recircStandbyLoss } from "@/lib/engineering/recirc";
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
    gasEfficiency, hpwhRefrigerant, hpwhAmbientF, swingTankEnabled, hpwhTier,
    elecRate, gasRate, gridSubregion, customEF,
    avgUnitSqft, envelopePreset, indoorDesignF, combiTankSize,
    fanCoilSupplyF, combiDHWSetpointF, hpwhOpLimitF, ventilationLoadPerUnit,
    systemType, gasTankSize, gasTankType, gasTankSetpointF,
    gasTanklessInput, tanklessDesignRiseF, tanklessSimultaneousFixtures, gasTanklessSetpointF,
    bufferTankEnabled,
  } = input;

  const effectiveInletF = input.inletWaterF ?? deriveInletWaterF(input.climateZone);

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

  // ---- RECIRC ------------------------------------------------------------
  const { lossBTUH: recircLossBTUH, lossKW: recircLossKW } = recircStandbyLoss({
    loopLengthFt: recircLoopLengthFt,
    insulationR: pipeInsulationR,
    returnTempF: recircReturnTempF,
    ambientPipeF,
  });

  // ---- STORAGE / RECOVERY (ASHRAE) --------------------------------------
  const storageCoef = ashraeProfile.storageFrac;
  const recoveryCoef = ashraeProfile.recoveryFrac;
  const usableFraction = 0.75;
  const storageVolGal_nominal = peakHourDemand * storageCoef;
  const storageVolGal = storageVolGal_nominal / usableFraction;
  const temperMultiplier = (storageSetpointF - effectiveInletF) / (deliveryF - effectiveInletF);
  const temperedCapacityGal = storageVolGal * temperMultiplier;

  const recoveryGPH = peakHourDemand * recoveryCoef;
  const temperatureRise = storageSetpointF - effectiveInletF;
  const recoveryBTUH = recoveryGPH * 8.33 * temperatureRise;
  const recoveryKW = recoveryBTUH / 3412;

  const totalBTUH = recoveryBTUH + recircLossBTUH;
  const totalKW = totalBTUH / 3412;

  // ---- TECH COMPARISON ---------------------------------------------------
  const gasInputBTUH = totalBTUH / gasEfficiency;
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

  const annualGasTherms = annualTotalBTU / (gasEfficiency * 100000);
  const annualResistanceKWh = annualTotalBTU / 3412;
  const annualHPWHKWh_total =
    annualTotalBTU / 3412 / annualCOP + (swingTankEnabled ? recircLossKW * 8760 * 0.5 : 0);

  const annualGasCost = annualGasTherms * gasRate;
  const annualResistanceCost = annualResistanceKWh * elecRate;
  const annualHPWHCost = annualHPWHKWh_total * elecRate;

  const ef = gridSubregion === "Custom" ? customEF : GRID_EF[gridSubregion];
  const annualGasCarbon = annualGasTherms * NG_LB_CO2_PER_THERM;
  const annualResistanceCarbon = annualResistanceKWh * ef;
  const annualHPWHCarbon = annualHPWHKWh_total * ef;

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
    const monthInlet = effectiveInletF + monthlyInletAdjustment(m, climateZone);

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
  });

  // ---- COMPLIANCE FLAGS --------------------------------------------------
  const flags = buildComplianceFlags({
    input,
    storageSetpointF, deliveryF, pipeInsulationR,
    storageVolGal, hpwhInputKW, gasInputBTUH, gasEfficiency,
    recircLossBTUH, totalBTUH, peakHourDemand, demandMethod,
    combi, inUnitGas,
    systemType,
    combiTankSize, combiDHWSetpointF, fanCoilSupplyF, hpwhOpLimitF,
    climate, gasTankSize, gasTankType, gasTanklessInput, tanklessDesignRiseF,
    units3BR,
  });

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
