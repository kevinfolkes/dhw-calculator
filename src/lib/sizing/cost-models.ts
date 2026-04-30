/**
 * Rough installed-cost models for lifecycle comparison. These are 2024 USD
 * averages — a real MEP bid would use RSMeans / local labor rates. They are
 * *only* used by the auto-sizer's 15-year lifecycle-total comparison; they
 * do not feed the annual energy results.
 */
import {
  CENTRAL_BOILER_COST_FACTOR,
  cascadeCostPremium,
  totalInstalledMBHWithRedundancy,
  type CascadeRedundancy,
  type CentralBoilerType,
} from "@/lib/engineering/constants";
import type { SystemTypeKey } from "@/lib/engineering/system-types";

export interface InstalledCostParams {
  storageGal?: number;
  inputMBH?: number;
  kW?: number;
  tankGal?: number;
  subtype?: "atmospheric" | "condensing";
  /** Central boiler subtype — applies to central_gas, central_indirect, and
   *  the gas-backup leg of central_hybrid. Non-condensing boilers cost ~28%
   *  less for the same input rating. Defaults to "condensing" if absent. */
  boilerType?: CentralBoilerType;
  /** Number of boilers in a cascade. Defaults to 1 (single-boiler plant).
   *  >1 triggers manifold/control cost premium and (with N+1 redundancy)
   *  larger total installed MBH. */
  boilerCount?: number;
  /** Cascade redundancy mode. Defaults to "N" (no redundancy). */
  cascadeRedundancy?: CascadeRedundancy;
}

export function installedCost(
  systemType: SystemTypeKey,
  params: InstalledCostParams,
  totalUnits: number,
): number {
  const boilerFactor = CENTRAL_BOILER_COST_FACTOR[params.boilerType ?? "condensing"];
  const boilerCount = params.boilerCount ?? 1;
  const redundancy = params.cascadeRedundancy ?? "N";
  const cascadePremium = cascadeCostPremium(boilerCount);
  // For cascade systems, the per-MBH cost applies to the TOTAL installed
  // capacity (which is grossed up under N+1 redundancy), not the active
  // duty. Single-boiler plants pass through unchanged.
  const installedInputMBH = totalInstalledMBHWithRedundancy(
    params.inputMBH ?? 0,
    boilerCount,
    redundancy,
  );

  if (systemType === "central_gas") {
    return cascadePremium * boilerFactor *
      (15000 + (params.storageGal ?? 0) * 8 + installedInputMBH * 12);
  }
  if (systemType === "central_gas_tankless") {
    // Modulating condensing tankless central plant: $4,000 base + $4/MBH
    // covers the cascade of tankless modules + manifold + recirc tie-in.
    // No primary storage, so no $/gal term — runs ~15% lower than the
    // equivalent central gas + storage at the same input rating.
    return 4000 + (params.inputMBH ?? 0) * 4;
  }
  if (systemType === "central_indirect") {
    // Boiler-equivalent cost (same as central_gas) + 25% markup for the
    // indirect storage tank / plate HX, controls, and the secondary loop
    // pumping that distinguishes an indirect plant from a direct-fired
    // central gas water heater. Cascade premium applies to the boiler
    // side of the cost.
    return 1.25 * cascadePremium * boilerFactor *
      (15000 + (params.storageGal ?? 0) * 8 + installedInputMBH * 12);
  }
  if (systemType === "central_hybrid") {
    // HPWH primary + gas backup: full HPWH cost on the primary side
    // (using `kW` as the HPWH nameplate) plus 60% of an equivalent
    // central_gas plant on the backup side (using `inputMBH` as the gas
    // backup). The 60% factor reflects that the gas leg is sized for the
    // peak shortfall rather than the full load — smaller burner, same
    // venting/controls/manifold complexity. Storage is shared. Cascade
    // premium applies to the gas-backup leg only.
    const hpwhPart = 40000 + (params.storageGal ?? 0) * 10 + (params.kW ?? 0) * 800;
    const gasPart = 0.6 * cascadePremium * boilerFactor *
      (15000 + installedInputMBH * 12);
    return hpwhPart + gasPart;
  }
  if (systemType === "central_steam_hx") {
    // Steam HX is more expensive than direct-fired boiler — the shell-and-
    // tube exchanger, condensate handling, and steam controls add ~50%
    // over an equivalent central_gas burner of the same MBH output rating.
    return 1.5 * (15000 + (params.storageGal ?? 0) * 8 + (params.inputMBH ?? 0) * 12);
  }
  if (systemType === "central_resistance") {
    return 10000 + (params.storageGal ?? 0) * 6 + (params.kW ?? 0) * 150;
  }
  if (systemType === "central_hpwh") {
    return 40000 + (params.storageGal ?? 0) * 10 + (params.kW ?? 0) * 800;
  }
  if (systemType === "inunit_gas_tank") {
    const perUnit = params.subtype === "condensing"
      ? 1800 + (params.tankGal ?? 0) * 15
      : 900 + (params.tankGal ?? 0) * 10;
    return perUnit * totalUnits;
  }
  if (systemType === "inunit_combi_gas") {
    // Same tank body as inunit_gas_tank, plus a hydronic fan coil, pump,
    // buffer tank/heat exchanger, and combi controls.
    const base = params.subtype === "condensing"
      ? 1800 + (params.tankGal ?? 0) * 15
      : 900 + (params.tankGal ?? 0) * 10;
    const combiAdder = 1800; // fan coil + controls + hydronic pump
    return (base + combiAdder) * totalUnits;
  }
  if (systemType === "inunit_gas_tankless") {
    return (1500 + (params.inputMBH ?? 0) * 10) * totalUnits;
  }
  if (systemType === "inunit_combi_gas_tankless") {
    // Modulating condensing tankless cost (per inunit_gas_tankless) +
    // buffer tank ($1,000 base + $15/gal) + hydronic adder ($1,800 fan
    // coil + controls + pump, matches inunit_combi_gas).
    const tanklessPart = 1500 + (params.inputMBH ?? 0) * 10;
    const bufferPart = 1000 + (params.storageGal ?? 0) * 15;
    const combiAdder = 1800;
    return (tanklessPart + bufferPart + combiAdder) * totalUnits;
  }
  if (systemType === "inunit_resistance") {
    // Per-apartment electric resistance tank — cheaper than HPWH but
    // pricier than gas tank in capex due to the larger element + control
    // module.
    return (800 + (params.tankGal ?? 0) * 12) * totalUnits;
  }
  if (systemType === "inunit_combi_resistance") {
    // Resistance tank cost + $1,800 hydronic adder per unit (mirrors
    // inunit_combi_gas adder structure: fan coil + controls + pump).
    const tankPart = 800 + (params.tankGal ?? 0) * 12;
    const combiAdder = 1800;
    return (tankPart + combiAdder) * totalUnits;
  }
  if (systemType === "inunit_hpwh" || systemType === "inunit_combi") {
    const tankGal = params.tankGal ?? 0;
    const base = tankGal <= 66 ? 3200 : tankGal <= 80 ? 3800 : 5500;
    const combiAdder = systemType === "inunit_combi" ? 2200 : 0;
    return (base + combiAdder) * totalUnits;
  }
  return 0;
}
