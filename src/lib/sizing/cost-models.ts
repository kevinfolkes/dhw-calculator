/**
 * Rough installed-cost models for lifecycle comparison. These are 2024 USD
 * averages — a real MEP bid would use RSMeans / local labor rates. They are
 * *only* used by the auto-sizer's 15-year lifecycle-total comparison; they
 * do not feed the annual energy results.
 */
import type { SystemTypeKey } from "@/lib/engineering/system-types";

export interface InstalledCostParams {
  storageGal?: number;
  inputMBH?: number;
  kW?: number;
  tankGal?: number;
  subtype?: "atmospheric" | "condensing";
}

export function installedCost(
  systemType: SystemTypeKey,
  params: InstalledCostParams,
  totalUnits: number,
): number {
  if (systemType === "central_gas") {
    return 15000 + (params.storageGal ?? 0) * 8 + (params.inputMBH ?? 0) * 12;
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
    // central gas water heater.
    return 1.25 * (15000 + (params.storageGal ?? 0) * 8 + (params.inputMBH ?? 0) * 12);
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
  if (systemType === "inunit_hpwh" || systemType === "inunit_combi") {
    const tankGal = params.tankGal ?? 0;
    const base = tankGal <= 66 ? 3200 : tankGal <= 80 ? 3800 : 5500;
    const combiAdder = systemType === "inunit_combi" ? 2200 : 0;
    return (base + combiAdder) * totalUnits;
  }
  return 0;
}
