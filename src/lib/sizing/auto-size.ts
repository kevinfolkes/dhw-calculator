/**
 * Per-system auto-sizing. For each system type, produces three sizing
 * philosophies:
 *   - minimum:    smallest equipment that passes code + demand
 *   - recommended: ASHRAE/industry standard with 20-25% safety margin
 *   - lifecycle:   optimized for 15-year total cost (capital + energy)
 *
 * Ported from the original artifact's `autoSize()` closure.
 */
import {
  CENTRAL_ELEC_KW, CENTRAL_GAS_INPUT_MBH, CENTRAL_GAS_TANKLESS_INPUT_MBH, CENTRAL_HPWH_KW, CENTRAL_TANK_SIZES,
  GAS_TANKLESS_WH, GAS_TANK_WH, HPWH_TANK_FHR,
  INUNIT_RESISTANCE_TANK_SPEC,
  type ApartmentDemand,
  type CentralGasTanklessInput,
  type GasTankSize, type GasTanklessInput, type HPWHTankSize,
  type InunitResistanceTankSize,
} from "@/lib/engineering/constants";
import type { SystemTypeKey } from "@/lib/engineering/system-types";
import type { DhwInputs } from "@/lib/calc/inputs";
import type { AutoSizeResult, SizingRec } from "@/lib/calc/types";
import { installedCost, type InstalledCostParams } from "./cost-models";

export interface AutoSizeContext {
  input: DhwInputs;
  ashraeProfile: ApartmentDemand;
  peakHourDemand: number;
  storageCoef: number;
  usableFraction: number;
  storageVolGal_nominal: number;
  totalBTUH: number;
  totalKW: number;
  hpwhNameplateKW: number;
  annualTotalBTU: number;
  annualCOP: number;
  inUnitAnnualDHWBTU_total: number;
  totalHeatingAnnualBTU: number;
  seasonalCOP_heating: number;
  needsFullResistanceBackup: boolean;
  heatingLoad_0BR: number;
  heatingLoad_1BR: number;
  heatingLoad_2BR: number;
  heatingLoad_3BR: number;
  combiCOP_heating: number;
  tanklessPeakGPM: number;
  totalUnits: number;
  /** Required peak instantaneous GPM for a central tankless plant, including
   *  the 1.5× ASHRAE Ch. 51 sizing margin. Only meaningful when
   *  `systemType === "central_gas_tankless"`. */
  centralTanklessPeakGPMRequired: number;
  /** Design ΔT used when computing tankless capacity-at-rise. */
  centralTanklessDesignRiseF: number;
  /** Required buffer tank gallons for `inunit_combi_gas_tankless`
   *  (= min_fire_BTUH × 5min ÷ (60 × 8.33 × 15°F)). Zero for other types. */
  inunitGasCombiBufferRequiredGal: number;
  /** Selected (auto + user-override) buffer tank SKU for
   *  `inunit_combi_gas_tankless`. Zero for other types. */
  inunitGasCombiBufferSelectedGal: number;
  /** Worst-case per-BR heating load in kW for the combi-resistance variant.
   *  Used to select the smallest tank whose element kW covers it. Zero for
   *  other types. */
  inunitResistanceWorstHeatingKW: number;
}

export function autoSize(ctx: AutoSizeContext): AutoSizeResult | null {
  const { input, totalUnits } = ctx;
  const st = input.systemType;

  const annualCostForSize = (params: InstalledCostParams) => annualCostForSizeImpl(ctx, params);
  // Auto-inject the user's central-plant selections into every cost call so
  // the non-condensing discount, cascade premium, and N+1 redundancy apply
  // wherever a boiler is implied (central_gas, central_indirect, central_
  // hybrid gas backup). Cost models that do not consult these fields ignore
  // them.
  const ic = (params: InstalledCostParams) =>
    installedCost(
      st,
      {
        boilerType: input.centralBoilerType,
        boilerCount: input.boilerCount,
        cascadeRedundancy: input.cascadeRedundancy,
        ...params,
      },
      totalUnits,
    );

  // ---------- CENTRAL ----------
  if (st === "central_gas" || st === "central_resistance" || st === "central_hpwh") {
    const minStorageGal = Math.ceil(ctx.peakHourDemand * ctx.storageCoef / ctx.usableFraction / 50) * 50;
    const recStorageGal = Math.ceil(ctx.peakHourDemand * ctx.storageCoef / ctx.usableFraction * 1.25 / 50) * 50;

    const minTank = CENTRAL_TANK_SIZES.find(s => s >= minStorageGal) ?? CENTRAL_TANK_SIZES[CENTRAL_TANK_SIZES.length - 1];
    const recTank = CENTRAL_TANK_SIZES.find(s => s >= recStorageGal) ?? CENTRAL_TANK_SIZES[CENTRAL_TANK_SIZES.length - 1];

    const reqOutputMBH = ctx.totalBTUH / 1000;
    const reqOutputKW = ctx.totalKW;

    let minCap: number, recCap: number, minCapUnit: string, recCapUnit: string;
    if (st === "central_gas") {
      const minInputMBH = reqOutputMBH / input.gasEfficiency;
      const recInputMBH = minInputMBH * 1.25;
      minCap = CENTRAL_GAS_INPUT_MBH.find(m => m >= minInputMBH) ?? CENTRAL_GAS_INPUT_MBH[CENTRAL_GAS_INPUT_MBH.length - 1];
      recCap = CENTRAL_GAS_INPUT_MBH.find(m => m >= recInputMBH) ?? CENTRAL_GAS_INPUT_MBH[CENTRAL_GAS_INPUT_MBH.length - 1];
      minCapUnit = recCapUnit = "MBH input";
    } else if (st === "central_resistance") {
      minCap = CENTRAL_ELEC_KW.find(k => k >= reqOutputKW) ?? CENTRAL_ELEC_KW[CENTRAL_ELEC_KW.length - 1];
      recCap = CENTRAL_ELEC_KW.find(k => k >= reqOutputKW * 1.20) ?? CENTRAL_ELEC_KW[CENTRAL_ELEC_KW.length - 1];
      minCapUnit = recCapUnit = "kW";
    } else {
      const minKW = ctx.hpwhNameplateKW;
      const recKW = ctx.hpwhNameplateKW * 1.25;
      minCap = CENTRAL_HPWH_KW.find(k => k >= minKW) ?? CENTRAL_HPWH_KW[CENTRAL_HPWH_KW.length - 1];
      recCap = CENTRAL_HPWH_KW.find(k => k >= recKW) ?? CENTRAL_HPWH_KW[CENTRAL_HPWH_KW.length - 1];
      minCapUnit = recCapUnit = "kW nameplate";
    }

    // Lifecycle: find tank × cap combo with lowest 15-year total
    let best: (SizingRec & { tank: number; cap: number; capUnit: string }) | null = null;
    for (const tank of CENTRAL_TANK_SIZES) {
      if (tank < minTank) continue;
      if (tank > recTank * 2) continue;
      const size: InstalledCostParams = { storageGal: tank, kW: recCap, inputMBH: recCap };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) {
        best = { tank, cap: recCap, capUnit: minCapUnit, capCost, annCost, total15 };
      }
    }

    const minSize: InstalledCostParams = { storageGal: minTank, kW: minCap, inputMBH: minCap };
    const recSize: InstalledCostParams = { storageGal: recTank, kW: recCap, inputMBH: recCap };

    return {
      system: st,
      minimum: { tank: minTank, cap: minCap, capUnit: minCapUnit, capCost: ic(minSize), annCost: annualCostForSize(minSize) },
      recommended: { tank: recTank, cap: recCap, capUnit: recCapUnit, capCost: ic(recSize), annCost: annualCostForSize(recSize) },
      lifecycle: best,
      reqPeakHourGPH: ctx.peakHourDemand,
      reqOutputMBH,
      reqOutputKW,
    };
  }

  // ---------- CENTRAL INDIRECT (boiler + indirect tank / plate HX) --------
  // Same storage/recovery topology as central_gas, but the boiler must
  // overcome both burner inefficiency and the heat-exchanger transfer loss
  // from boiler loop to potable. Reuses CENTRAL_GAS_INPUT_MBH and
  // CENTRAL_TANK_SIZES ladders.
  if (st === "central_indirect") {
    const minStorageGal = Math.ceil(ctx.peakHourDemand * ctx.storageCoef / ctx.usableFraction / 50) * 50;
    const recStorageGal = Math.ceil(ctx.peakHourDemand * ctx.storageCoef / ctx.usableFraction * 1.25 / 50) * 50;

    const minTank = CENTRAL_TANK_SIZES.find(s => s >= minStorageGal) ?? CENTRAL_TANK_SIZES[CENTRAL_TANK_SIZES.length - 1];
    const recTank = CENTRAL_TANK_SIZES.find(s => s >= recStorageGal) ?? CENTRAL_TANK_SIZES[CENTRAL_TANK_SIZES.length - 1];

    const reqOutputMBH = ctx.totalBTUH / 1000;
    const reqOutputKW = ctx.totalKW;

    const combinedEff = input.gasEfficiency * input.indirectHXEffectiveness;
    const minInputMBH = reqOutputMBH / combinedEff;
    const recInputMBH = minInputMBH * 1.25;
    const minCap = CENTRAL_GAS_INPUT_MBH.find(m => m >= minInputMBH) ?? CENTRAL_GAS_INPUT_MBH[CENTRAL_GAS_INPUT_MBH.length - 1];
    const recCap = CENTRAL_GAS_INPUT_MBH.find(m => m >= recInputMBH) ?? CENTRAL_GAS_INPUT_MBH[CENTRAL_GAS_INPUT_MBH.length - 1];

    let best: (SizingRec & { tank: number; cap: number; capUnit: string }) | null = null;
    for (const tank of CENTRAL_TANK_SIZES) {
      if (tank < minTank) continue;
      if (tank > recTank * 2) continue;
      const size: InstalledCostParams = { storageGal: tank, inputMBH: recCap };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) {
        best = { tank, cap: recCap, capUnit: "MBH input", capCost, annCost, total15 };
      }
    }

    const minSize: InstalledCostParams = { storageGal: minTank, inputMBH: minCap };
    const recSize: InstalledCostParams = { storageGal: recTank, inputMBH: recCap };

    return {
      system: st,
      minimum: { tank: minTank, cap: minCap, capUnit: "MBH input", capCost: ic(minSize), annCost: annualCostForSize(minSize) },
      recommended: { tank: recTank, cap: recCap, capUnit: "MBH input", capCost: ic(recSize), annCost: annualCostForSize(recSize) },
      lifecycle: best,
      reqPeakHourGPH: ctx.peakHourDemand,
      reqOutputMBH,
      reqOutputKW,
      reqInputMBH_derated: minInputMBH,
    };
  }

  // ---------- CENTRAL GAS TANKLESS (modulating condensing) ---------------
  // No storage. Sizing is driven by the peak instantaneous GPM × ΔT design
  // criterion (ASHRAE Ch. 51 §"Instantaneous water heaters" — 1.5× peak
  // 15-min demand). Capacity at the design rise scales with input MBH × UEF.
  if (st === "central_gas_tankless") {
    const sizes = CENTRAL_GAS_TANKLESS_INPUT_MBH.slice().sort((a, b) => a - b) as readonly CentralGasTanklessInput[];
    const reqGPM = ctx.centralTanklessPeakGPMRequired;
    const rise = Math.max(1, ctx.centralTanklessDesignRiseF);

    const capacityGPM = (mbh: number) =>
      (mbh * input.gasEfficiency * 1000) / (500 * rise);

    const findInput = (margin: number): CentralGasTanklessInput =>
      sizes.find(s => capacityGPM(s) >= reqGPM * margin) ?? sizes[sizes.length - 1];

    const minInput = findInput(1.0);
    const recInput = findInput(1.25);

    let best: (SizingRec & { inputMBH: number }) | null = null;
    for (const s of sizes) {
      if (capacityGPM(s) < reqGPM) continue;
      const size: InstalledCostParams = { inputMBH: s };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) best = { inputMBH: s, capCost, annCost, total15 };
    }

    return {
      system: st,
      reqPeakGPM: reqGPM,
      reqOutputMBH: ctx.totalBTUH / 1000,
      reqOutputKW: ctx.totalKW,
      minimum: {
        inputMBH: minInput, cap: minInput, capUnit: "MBH input",
        capCost: ic({ inputMBH: minInput }), annCost: annualCostForSize({ inputMBH: minInput }),
      },
      recommended: {
        inputMBH: recInput, cap: recInput, capUnit: "MBH input",
        capCost: ic({ inputMBH: recInput }), annCost: annualCostForSize({ inputMBH: recInput }),
      },
      lifecycle: best,
    };
  }

  // ---------- CENTRAL HYBRID (HPWH + gas backup) -------------------------
  // Two-piece-of-equipment plant: HPWH primary sized to `hybridSplitRatio ×
  // totalKW` (then derated by capacity-factor), gas backup sized to cover
  // the remainder. Storage gallons mirror the central_gas / central_hpwh
  // sizing. The `cap` field in the recommendation is the HPWH kW
  // (primary); `cap2` carries the gas backup MBH alongside it.
  if (st === "central_hybrid") {
    const minStorageGal = Math.ceil(ctx.peakHourDemand * ctx.storageCoef / ctx.usableFraction / 50) * 50;
    const recStorageGal = Math.ceil(ctx.peakHourDemand * ctx.storageCoef / ctx.usableFraction * 1.25 / 50) * 50;

    const minTank = CENTRAL_TANK_SIZES.find(s => s >= minStorageGal) ?? CENTRAL_TANK_SIZES[CENTRAL_TANK_SIZES.length - 1];
    const recTank = CENTRAL_TANK_SIZES.find(s => s >= recStorageGal) ?? CENTRAL_TANK_SIZES[CENTRAL_TANK_SIZES.length - 1];

    const ratio = Math.min(0.95, Math.max(0.05, input.hybridSplitRatio));
    const hpwhKWreq = ctx.hpwhNameplateKW * ratio;
    const minHpwhKW = CENTRAL_HPWH_KW.find(k => k >= hpwhKWreq) ?? CENTRAL_HPWH_KW[CENTRAL_HPWH_KW.length - 1];
    const recHpwhKW = CENTRAL_HPWH_KW.find(k => k >= hpwhKWreq * 1.25) ?? CENTRAL_HPWH_KW[CENTRAL_HPWH_KW.length - 1];

    const gasBackupMBHreq = (ctx.totalBTUH * (1 - ratio)) / input.gasEfficiency / 1000;
    const minGasMBH = CENTRAL_GAS_INPUT_MBH.find(m => m >= gasBackupMBHreq) ?? CENTRAL_GAS_INPUT_MBH[CENTRAL_GAS_INPUT_MBH.length - 1];
    const recGasMBH = CENTRAL_GAS_INPUT_MBH.find(m => m >= gasBackupMBHreq * 1.25) ?? CENTRAL_GAS_INPUT_MBH[CENTRAL_GAS_INPUT_MBH.length - 1];

    const minSize: InstalledCostParams = { storageGal: minTank, kW: minHpwhKW, inputMBH: minGasMBH };
    const recSize: InstalledCostParams = { storageGal: recTank, kW: recHpwhKW, inputMBH: recGasMBH };

    let best:
      | (SizingRec & { tank: number; cap: number; capUnit: string; cap2: number; cap2Unit: string })
      | null = null;
    for (const tank of CENTRAL_TANK_SIZES) {
      if (tank < minTank) continue;
      if (tank > recTank * 2) continue;
      const size: InstalledCostParams = { storageGal: tank, kW: recHpwhKW, inputMBH: recGasMBH };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) {
        best = {
          tank,
          cap: recHpwhKW,
          capUnit: "kW HPWH",
          cap2: recGasMBH,
          cap2Unit: "MBH gas backup",
          capCost,
          annCost,
          total15,
        };
      }
    }

    return {
      system: st,
      reqPeakHourGPH: ctx.peakHourDemand,
      reqOutputMBH: ctx.totalBTUH / 1000,
      reqOutputKW: ctx.totalKW,
      minimum: {
        tank: minTank,
        cap: minHpwhKW,
        capUnit: "kW HPWH",
        cap2: minGasMBH,
        cap2Unit: "MBH gas backup",
        capCost: ic(minSize),
        annCost: annualCostForSize(minSize),
      },
      recommended: {
        tank: recTank,
        cap: recHpwhKW,
        capUnit: "kW HPWH",
        cap2: recGasMBH,
        cap2Unit: "MBH gas backup",
        capCost: ic(recSize),
        annCost: annualCostForSize(recSize),
      },
      lifecycle: best,
    };
  }

  // ---------- CENTRAL STEAM-TO-DHW HX (steam + indirect tank) ------------
  // Same shape as central_indirect but the upstream efficiency is the
  // combined steam-source × HX effectiveness, not gas burner efficiency.
  // Reuses CENTRAL_GAS_INPUT_MBH as a proxy for steam HX kBTU/hr output
  // rating since both ladders cover the same MBH range commercially.
  if (st === "central_steam_hx") {
    const minStorageGal = Math.ceil(ctx.peakHourDemand * ctx.storageCoef / ctx.usableFraction / 50) * 50;
    const recStorageGal = Math.ceil(ctx.peakHourDemand * ctx.storageCoef / ctx.usableFraction * 1.25 / 50) * 50;

    const minTank = CENTRAL_TANK_SIZES.find(s => s >= minStorageGal) ?? CENTRAL_TANK_SIZES[CENTRAL_TANK_SIZES.length - 1];
    const recTank = CENTRAL_TANK_SIZES.find(s => s >= recStorageGal) ?? CENTRAL_TANK_SIZES[CENTRAL_TANK_SIZES.length - 1];

    const reqOutputMBH = ctx.totalBTUH / 1000;
    const reqOutputKW = ctx.totalKW;

    const combinedEff = input.steamSourceEfficiency * input.steamHXEffectiveness;
    const minInputMBH = reqOutputMBH / combinedEff;
    const recInputMBH = minInputMBH * 1.25;
    const minCap = CENTRAL_GAS_INPUT_MBH.find(m => m >= minInputMBH) ?? CENTRAL_GAS_INPUT_MBH[CENTRAL_GAS_INPUT_MBH.length - 1];
    const recCap = CENTRAL_GAS_INPUT_MBH.find(m => m >= recInputMBH) ?? CENTRAL_GAS_INPUT_MBH[CENTRAL_GAS_INPUT_MBH.length - 1];

    let best: (SizingRec & { tank: number; cap: number; capUnit: string }) | null = null;
    for (const tank of CENTRAL_TANK_SIZES) {
      if (tank < minTank) continue;
      if (tank > recTank * 2) continue;
      const size: InstalledCostParams = { storageGal: tank, inputMBH: recCap };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) {
        best = { tank, cap: recCap, capUnit: "MBH steam input", capCost, annCost, total15 };
      }
    }

    const minSize: InstalledCostParams = { storageGal: minTank, inputMBH: minCap };
    const recSize: InstalledCostParams = { storageGal: recTank, inputMBH: recCap };

    return {
      system: st,
      minimum: { tank: minTank, cap: minCap, capUnit: "MBH steam input", capCost: ic(minSize), annCost: annualCostForSize(minSize) },
      recommended: { tank: recTank, cap: recCap, capUnit: "MBH steam input", capCost: ic(recSize), annCost: annualCostForSize(recSize) },
      lifecycle: best,
      reqPeakHourGPH: ctx.peakHourDemand,
      reqOutputMBH,
      reqOutputKW,
      reqInputMBH_derated: minInputMBH,
    };
  }

  // ---------- IN-UNIT GAS TANK (DHW-only) and GAS COMBI ----------
  if (st === "inunit_gas_tank" || st === "inunit_combi_gas") {
    const reqFHR = ctx.ashraeProfile.mh;
    const sizes = Object.keys(GAS_TANK_WH).map(Number).sort((a, b) => a - b) as GasTankSize[];

    // For combi, the tank must also cover the worst per-unit heating input
    // demand. Convert BTU/hr → equivalent DHW FHR by asking: "what minimum
    // input MBH covers the worst heating load?" and constrain size to a tank
    // whose input meets it (heating loop continuous, DHW priority).
    const worstHeating = Math.max(ctx.heatingLoad_0BR, ctx.heatingLoad_1BR, ctx.heatingLoad_2BR, ctx.heatingLoad_3BR);

    const findTank = (type: "atmospheric" | "condensing", margin: number): GasTankSize => {
      for (const s of sizes) {
        const fhr = type === "condensing" ? GAS_TANK_WH[s].fhr_condensing : GAS_TANK_WH[s].fhr_atmospheric;
        if (fhr < reqFHR * margin) continue;
        if (st === "inunit_combi_gas") {
          const uef = type === "condensing" ? GAS_TANK_WH[s].uef_cond : GAS_TANK_WH[s].uef_atmos;
          const outputBTUH = GAS_TANK_WH[s].input_mbh * uef * 1000;
          if (outputBTUH < worstHeating * margin) continue;
        }
        return s;
      }
      return sizes[sizes.length - 1];
    };
    const minTank_cond = findTank("condensing", 1.0);
    const recTank_cond = findTank("condensing", 1.15);

    const meetsCombi = (s: GasTankSize, subtype: "atmospheric" | "condensing") => {
      if (st !== "inunit_combi_gas") return true;
      const uef = subtype === "condensing" ? GAS_TANK_WH[s].uef_cond : GAS_TANK_WH[s].uef_atmos;
      return GAS_TANK_WH[s].input_mbh * uef * 1000 >= worstHeating;
    };

    let best: (SizingRec & { tankGal: number; subtype: "atmospheric" | "condensing" }) | null = null;
    for (const s of sizes) {
      if (GAS_TANK_WH[s].fhr_condensing >= reqFHR && meetsCombi(s, "condensing")) {
        const size: InstalledCostParams = { tankGal: s, subtype: "condensing" };
        const capCost = ic(size);
        const annCost = annualCostForSize(size);
        const total15 = capCost + annCost * 15;
        if (!best || total15 < best.total15!) best = { tankGal: s, subtype: "condensing", capCost, annCost, total15 };
      }
      // Atmospheric tanks are a legitimate option for both DHW-only and combi
      // systems: forced-air combis (e.g. Aquatherm "Combo Heater") have been
      // installed since the 1970s with atmospheric tanks, and return water
      // temps through an air-handler coil (~110-120°F) stay above flue
      // condensation territory. Size limit of <50 gal reflects typical SKU
      // availability in atmospheric.
      if (s < 50 && GAS_TANK_WH[s].fhr_atmospheric >= reqFHR && meetsCombi(s, "atmospheric")) {
        const size: InstalledCostParams = { tankGal: s, subtype: "atmospheric" };
        const capCost = ic(size);
        const annCost = annualCostForSize(size);
        const total15 = capCost + annCost * 15;
        if (!best || total15 < best.total15!) best = { tankGal: s, subtype: "atmospheric", capCost, annCost, total15 };
      }
    }

    return {
      system: st,
      reqFHR,
      minimum: { tankGal: minTank_cond, subtype: "condensing", capCost: ic({ tankGal: minTank_cond, subtype: "condensing" }), annCost: annualCostForSize({ tankGal: minTank_cond, subtype: "condensing" }) },
      recommended: { tankGal: recTank_cond, subtype: "condensing", capCost: ic({ tankGal: recTank_cond, subtype: "condensing" }), annCost: annualCostForSize({ tankGal: recTank_cond, subtype: "condensing" }) },
      lifecycle: best,
    };
  }

  // ---------- IN-UNIT GAS TANKLESS ----------
  if (st === "inunit_gas_tankless") {
    const reqBTUH = ctx.tanklessPeakGPM * 500 * input.tanklessDesignRiseF;
    const reqInputMBH = reqBTUH / 1000 / 0.85;
    const sizes = Object.keys(GAS_TANKLESS_WH).map(Number).sort((a, b) => a - b) as GasTanklessInput[];

    const findInput = (margin: number): GasTanklessInput =>
      sizes.find(s => {
        const capacity = (GAS_TANKLESS_WH[s].input_mbh * GAS_TANKLESS_WH[s].uef * 1000) / (500 * input.tanklessDesignRiseF);
        return capacity >= ctx.tanklessPeakGPM * margin;
      }) ?? sizes[sizes.length - 1];

    const minInput = findInput(1.0);
    const recInput = findInput(1.15);

    let best: (SizingRec & { inputMBH: number }) | null = null;
    for (const s of sizes) {
      const cap = (GAS_TANKLESS_WH[s].input_mbh * GAS_TANKLESS_WH[s].uef * 1000) / (500 * input.tanklessDesignRiseF);
      if (cap < ctx.tanklessPeakGPM) continue;
      const size: InstalledCostParams = { inputMBH: s };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) best = { inputMBH: s, capCost, annCost, total15 };
    }

    return {
      system: st,
      reqPeakGPM: ctx.tanklessPeakGPM,
      reqInputMBH_derated: reqInputMBH,
      minimum: { inputMBH: minInput, capCost: ic({ inputMBH: minInput }), annCost: annualCostForSize({ inputMBH: minInput }) },
      recommended: { inputMBH: recInput, capCost: ic({ inputMBH: recInput }), annCost: annualCostForSize({ inputMBH: recInput }) },
      lifecycle: best,
    };
  }

  // ---------- IN-UNIT COMBI GAS TANKLESS (modulating + buffer tank) ------
  // DHW-side capacity check mirrors `inunit_gas_tankless` (peak GPM × ΔT).
  // Recommendation steps up MBH 15%; the lifecycle search compares all
  // input MBH × buffer SKU pairs that pass demand. The recommended buffer
  // gallons come from the pipeline (computed off min_fire); we surface
  // them in `cap2`.
  if (st === "inunit_combi_gas_tankless") {
    const reqGPM = ctx.tanklessPeakGPM;
    const sizes = Object.keys(GAS_TANKLESS_WH).map(Number).sort((a, b) => a - b) as GasTanklessInput[];
    const findInput = (margin: number): GasTanklessInput =>
      sizes.find(s => {
        const cap = (GAS_TANKLESS_WH[s].input_mbh * GAS_TANKLESS_WH[s].uef * 1000) / (500 * input.tanklessDesignRiseF);
        return cap >= reqGPM * margin;
      }) ?? sizes[sizes.length - 1];

    const minInput = findInput(1.0);
    const recInput = findInput(1.15);
    const bufferGal = Math.max(1, ctx.inunitGasCombiBufferSelectedGal);

    let best: (SizingRec & { inputMBH: number; cap2: number; cap2Unit: string }) | null = null;
    for (const s of sizes) {
      const cap = (GAS_TANKLESS_WH[s].input_mbh * GAS_TANKLESS_WH[s].uef * 1000) / (500 * input.tanklessDesignRiseF);
      if (cap < reqGPM) continue;
      const size: InstalledCostParams = { inputMBH: s, storageGal: bufferGal };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) {
        best = { inputMBH: s, cap2: bufferGal, cap2Unit: "gal buffer", capCost, annCost, total15 };
      }
    }

    return {
      system: st,
      reqPeakGPM: reqGPM,
      minimum: {
        inputMBH: minInput,
        cap: minInput,
        capUnit: "MBH input",
        cap2: bufferGal,
        cap2Unit: "gal buffer",
        capCost: ic({ inputMBH: minInput, storageGal: bufferGal }),
        annCost: annualCostForSize({ inputMBH: minInput, storageGal: bufferGal }),
      },
      recommended: {
        inputMBH: recInput,
        cap: recInput,
        capUnit: "MBH input",
        cap2: bufferGal,
        cap2Unit: "gal buffer",
        capCost: ic({ inputMBH: recInput, storageGal: bufferGal }),
        annCost: annualCostForSize({ inputMBH: recInput, storageGal: bufferGal }),
      },
      lifecycle: best,
    };
  }

  // ---------- IN-UNIT RESISTANCE (DHW-only) ------------------------------
  if (st === "inunit_resistance") {
    const reqFHR = ctx.ashraeProfile.mh;
    const sizes = Object.keys(INUNIT_RESISTANCE_TANK_SPEC).map(Number).sort((a, b) => a - b) as InunitResistanceTankSize[];

    const findTank = (margin: number): InunitResistanceTankSize =>
      sizes.find(s => INUNIT_RESISTANCE_TANK_SPEC[s].fhr >= reqFHR * margin)
        ?? sizes[sizes.length - 1];

    const minTank = findTank(1.0);
    const recTank = findTank(1.15);

    let best: (SizingRec & { tankGal: number; cap: number; capUnit: string }) | null = null;
    for (const s of sizes) {
      if (INUNIT_RESISTANCE_TANK_SPEC[s].fhr < reqFHR) continue;
      const size: InstalledCostParams = { tankGal: s, kW: INUNIT_RESISTANCE_TANK_SPEC[s].kw };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) {
        best = { tankGal: s, cap: INUNIT_RESISTANCE_TANK_SPEC[s].kw, capUnit: "kW element", capCost, annCost, total15 };
      }
    }

    return {
      system: st,
      reqFHR,
      minimum: {
        tankGal: minTank,
        cap: INUNIT_RESISTANCE_TANK_SPEC[minTank].kw,
        capUnit: "kW element",
        capCost: ic({ tankGal: minTank, kW: INUNIT_RESISTANCE_TANK_SPEC[minTank].kw }),
        annCost: annualCostForSize({ tankGal: minTank, kW: INUNIT_RESISTANCE_TANK_SPEC[minTank].kw }),
      },
      recommended: {
        tankGal: recTank,
        cap: INUNIT_RESISTANCE_TANK_SPEC[recTank].kw,
        capUnit: "kW element",
        capCost: ic({ tankGal: recTank, kW: INUNIT_RESISTANCE_TANK_SPEC[recTank].kw }),
        annCost: annualCostForSize({ tankGal: recTank, kW: INUNIT_RESISTANCE_TANK_SPEC[recTank].kw }),
      },
      lifecycle: best,
    };
  }

  // ---------- IN-UNIT COMBI RESISTANCE (DHW + hydronic) ------------------
  // Same FHR check as inunit_resistance, plus the element kW must cover
  // the worst per-BR heating load (resistance has no compressor reserve).
  if (st === "inunit_combi_resistance") {
    const reqFHR = ctx.ashraeProfile.mh;
    const worstHeatingKW = ctx.inunitResistanceWorstHeatingKW;
    const sizes = Object.keys(INUNIT_RESISTANCE_TANK_SPEC).map(Number).sort((a, b) => a - b) as InunitResistanceTankSize[];

    const findTank = (margin: number): InunitResistanceTankSize => {
      for (const s of sizes) {
        const spec = INUNIT_RESISTANCE_TANK_SPEC[s];
        if (spec.fhr < reqFHR * margin) continue;
        if (spec.kw < worstHeatingKW) continue;
        return s;
      }
      return sizes[sizes.length - 1];
    };

    const minTank = findTank(1.0);
    const recTank = findTank(1.15);

    let best: (SizingRec & { tankGal: number; cap: number; capUnit: string }) | null = null;
    for (const s of sizes) {
      const spec = INUNIT_RESISTANCE_TANK_SPEC[s];
      if (spec.fhr < reqFHR) continue;
      if (spec.kw < worstHeatingKW) continue;
      const size: InstalledCostParams = { tankGal: s, kW: spec.kw };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) {
        best = { tankGal: s, cap: spec.kw, capUnit: "kW element", capCost, annCost, total15 };
      }
    }

    return {
      system: st,
      reqFHR,
      worstHeatingLoad: worstHeatingKW * 3412,
      minimum: {
        tankGal: minTank,
        cap: INUNIT_RESISTANCE_TANK_SPEC[minTank].kw,
        capUnit: "kW element",
        capCost: ic({ tankGal: minTank, kW: INUNIT_RESISTANCE_TANK_SPEC[minTank].kw }),
        annCost: annualCostForSize({ tankGal: minTank, kW: INUNIT_RESISTANCE_TANK_SPEC[minTank].kw }),
      },
      recommended: {
        tankGal: recTank,
        cap: INUNIT_RESISTANCE_TANK_SPEC[recTank].kw,
        capUnit: "kW element",
        capCost: ic({ tankGal: recTank, kW: INUNIT_RESISTANCE_TANK_SPEC[recTank].kw }),
        annCost: annualCostForSize({ tankGal: recTank, kW: INUNIT_RESISTANCE_TANK_SPEC[recTank].kw }),
      },
      lifecycle: best,
    };
  }

  // ---------- IN-UNIT HPWH / COMBI ----------
  if (st === "inunit_hpwh" || st === "inunit_combi") {
    const reqFHR = ctx.ashraeProfile.mh;
    const sizes = Object.keys(HPWH_TANK_FHR).map(Number).sort((a, b) => a - b) as HPWHTankSize[];
    const worstHeatingLoad = Math.max(ctx.heatingLoad_0BR, ctx.heatingLoad_1BR, ctx.heatingLoad_2BR, ctx.heatingLoad_3BR);

    const findTank = (margin: number): HPWHTankSize => {
      for (const s of sizes) {
        const fhr = HPWH_TANK_FHR[s].fhr;
        if (fhr >= reqFHR * margin) {
          if (st === "inunit_combi") {
            const compressorBTUH = HPWH_TANK_FHR[s].input_kw * 3412 * ctx.combiCOP_heating;
            const resistanceNeeded = Math.max(0, (worstHeatingLoad - compressorBTUH) / 3412);
            if (margin >= 1.15 && resistanceNeeded > 3) continue;
          }
          return s;
        }
      }
      return sizes[sizes.length - 1];
    };

    const minTank = findTank(1.0);
    const recTank = findTank(1.15);

    let best: (SizingRec & { tankGal: number }) | null = null;
    for (const s of sizes) {
      if (HPWH_TANK_FHR[s].fhr < reqFHR) continue;
      const size: InstalledCostParams = { tankGal: s };
      const capCost = ic(size);
      const annCost = annualCostForSize(size);
      const total15 = capCost + annCost * 15;
      if (!best || total15 < best.total15!) best = { tankGal: s, capCost, annCost, total15 };
    }

    return {
      system: st,
      reqFHR,
      worstHeatingLoad: st === "inunit_combi" ? worstHeatingLoad : null,
      minimum: { tankGal: minTank, capCost: ic({ tankGal: minTank }), annCost: annualCostForSize({ tankGal: minTank }) },
      recommended: { tankGal: recTank, capCost: ic({ tankGal: recTank }), annCost: annualCostForSize({ tankGal: recTank }) },
      lifecycle: best,
    };
  }

  return null;
}

// Annual operating cost (USD/year) for a candidate equipment size.
function annualCostForSizeImpl(ctx: AutoSizeContext, size: InstalledCostParams): number {
  const { input } = ctx;
  const st = input.systemType;

  if (st === "central_gas") {
    return (ctx.annualTotalBTU / (input.gasEfficiency * 100000)) * input.gasRate;
  }
  if (st === "central_gas_tankless") {
    return (ctx.annualTotalBTU / (input.gasEfficiency * 100000)) * input.gasRate;
  }
  if (st === "central_indirect") {
    const eff = input.gasEfficiency * input.indirectHXEffectiveness;
    return (ctx.annualTotalBTU / (eff * 100000)) * input.gasRate;
  }
  if (st === "central_hybrid") {
    // Annual energy split by hybridSplitRatio: HPWH share at annualCOP,
    // gas share at gasEfficiency. Mirrors the simpler annual-split
    // approximation used in the pipeline.
    const ratio = Math.min(0.95, Math.max(0.05, input.hybridSplitRatio));
    const hpwhBTU = ctx.annualTotalBTU * ratio;
    const gasBTU = ctx.annualTotalBTU * (1 - ratio);
    const hpwhKWh = (hpwhBTU / 3412) / ctx.annualCOP;
    const gasTherms = gasBTU / (input.gasEfficiency * 100000);
    return hpwhKWh * input.elecRate + gasTherms * input.gasRate;
  }
  if (st === "central_steam_hx") {
    const eff = input.steamSourceEfficiency * input.steamHXEffectiveness;
    return (ctx.annualTotalBTU / (eff * 100000)) * input.gasRate;
  }
  if (st === "central_resistance") {
    return (ctx.annualTotalBTU / 3412) * input.elecRate;
  }
  if (st === "central_hpwh") {
    const storageGal = size.storageGal ?? ctx.storageVolGal_nominal;
    const sizeCOP = ctx.annualCOP * (1 + Math.min(0.05, (storageGal - ctx.storageVolGal_nominal) / 10000));
    return ((ctx.annualTotalBTU / 3412) / sizeCOP) * input.elecRate;
  }
  if (st === "inunit_gas_tank") {
    const tankGal = size.tankGal as GasTankSize;
    const uef = size.subtype === "condensing" ? GAS_TANK_WH[tankGal].uef_cond : GAS_TANK_WH[tankGal].uef_atmos;
    return (ctx.inUnitAnnualDHWBTU_total / (uef * 100000)) * input.gasRate;
  }
  if (st === "inunit_combi_gas") {
    const tankGal = size.tankGal as GasTankSize;
    const uef = size.subtype === "condensing" ? GAS_TANK_WH[tankGal].uef_cond : GAS_TANK_WH[tankGal].uef_atmos;
    const dhwTherms = ctx.inUnitAnnualDHWBTU_total / (uef * 100000);
    const heatTherms = ctx.totalHeatingAnnualBTU / (uef * 100000);
    return (dhwTherms + heatTherms) * input.gasRate;
  }
  if (st === "inunit_gas_tankless") {
    const uef = GAS_TANKLESS_WH[size.inputMBH as GasTanklessInput].uef;
    return (ctx.inUnitAnnualDHWBTU_total / (uef * 100000)) * input.gasRate;
  }
  if (st === "inunit_combi_gas_tankless") {
    const uef = GAS_TANKLESS_WH[size.inputMBH as GasTanklessInput].uef;
    const dhwTherms = ctx.inUnitAnnualDHWBTU_total / (uef * 100000);
    const heatTherms = ctx.totalHeatingAnnualBTU / (uef * 100000);
    return (dhwTherms + heatTherms) * input.gasRate;
  }
  if (st === "inunit_resistance") {
    const uef = INUNIT_RESISTANCE_TANK_SPEC[size.tankGal as InunitResistanceTankSize].uef;
    return ((ctx.inUnitAnnualDHWBTU_total / 3412) / uef) * input.elecRate;
  }
  if (st === "inunit_combi_resistance") {
    const uef = INUNIT_RESISTANCE_TANK_SPEC[size.tankGal as InunitResistanceTankSize].uef;
    const dhwKWh = (ctx.inUnitAnnualDHWBTU_total / 3412) / uef;
    const heatKWh = ctx.totalHeatingAnnualBTU / 3412;
    return (dhwKWh + heatKWh) * input.elecRate;
  }
  if (st === "inunit_hpwh") {
    const uefEff = HPWH_TANK_FHR[size.tankGal as HPWHTankSize].uef;
    return ((ctx.inUnitAnnualDHWBTU_total / 3412) / uefEff) * input.elecRate;
  }
  if (st === "inunit_combi") {
    const tankGal = size.tankGal as HPWHTankSize;
    const uefEff = HPWH_TANK_FHR[tankGal].uef;
    const dhwKWh = (ctx.inUnitAnnualDHWBTU_total / 3412) / uefEff;
    const sizeAdjustedShare = Math.max(
      0.02,
      ctx.needsFullResistanceBackup ? 0.20 - (tankGal - 50) * 0.001 : 0.05,
    );
    const heatKWh =
      (ctx.totalHeatingAnnualBTU * (1 - sizeAdjustedShare) / ctx.seasonalCOP_heating +
        ctx.totalHeatingAnnualBTU * sizeAdjustedShare) /
      3412;
    return (dhwKWh + heatKWh) * input.elecRate;
  }
  return 0;
}
