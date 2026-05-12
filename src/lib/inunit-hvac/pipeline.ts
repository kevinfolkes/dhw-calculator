/**
 * In-unit HVAC calculator pipeline. Pure function:
 * `InUnitHvacInputs → InUnitHvacResult`.
 *
 * Math (per apartment, per end-use):
 *
 *   For SEER2 / EER / HSPF2 (BTU/Wh ratings):
 *     annualKWh = (capacityBtuh × eflhHours) ÷ (rating × 1000)
 *
 *   For COP (dimensionless output/input ratio):
 *     annualKWh = (capacityBtuh × eflhHours) ÷ (COP × 3412)
 *
 *   For resistance (COP fixed at 1.0):
 *     annualKWh = (capacityBtuh × eflhHours) ÷ 3412
 *
 *   buildingKWh = perAptKWh × apartmentCount
 *   annualCost  = buildingKWh × elecRate
 *   annualCO₂   = buildingKWh × emissionFactor[gridSubregion]
 *
 * Unit conversions:
 *   - 1 kWh = 3412.14 BTU (we use 3412)
 *   - SEER2 / HSPF2 / EER are BTU per W·h; capacity × hours ÷ rating gives Wh,
 *     then ÷ 1000 → kWh.
 *
 * Monthly profile uses HDD/CDD fractions by climate archetype to allocate
 * cooling EFLH (peaks Jul/Aug) and heating EFLH (peaks Dec/Jan). Both
 * fraction tables sum to ~1.0 across the year, so the monthly rollup
 * matches the annual within rounding.
 *
 * EFLH (Equivalent Full-Load Hours) defaults are sourced from ASHRAE 90.1-
 * 2022 Appendix G3.1.3.10 + DOE Building America HVAC reference designs.
 * Users can override per-input via `coolingEflhOverride` / `heatingEflhOverride`.
 *
 * References:
 *   - ASHRAE 90.1-2022 §6.4 (Minimum Equipment Efficiency Requirements)
 *   - ASHRAE 90.1-2022 Appendix G3.1.3.10 (EFLH for residential equipment)
 *   - AHRI 210/240-2023 (SEER2 / HSPF2 rating standard)
 *   - AHRI 310/380 (PTAC / PTHP rating standard)
 *   - NEEP Cold Climate ASHP Specification — capacity retention at 5°F
 *   - DOE Building America MF HVAC reference designs
 *   - EPA eGRID 2022 emission factors
 */
import {
  CLIMATE_DESIGN,
  GRID_EF,
  MONTH_DAYS,
  MONTHLY_HDD_FRAC,
  MONTHS,
  type ClimateZoneKey,
  type HDDArchetype,
} from "@/lib/engineering/constants";
import type {
  CoolingEffMetric,
  HeatingEffMetric,
  InUnitHvacInputs,
} from "./inputs";
import type {
  InUnitHvacComplianceFlag,
  InUnitHvacEndUseResult,
  InUnitHvacMonthlyResults,
  InUnitHvacMonthlyRow,
  InUnitHvacResult,
} from "./types";

/** BTU per kWh (energy unit conversion constant). 1 kWh × 3412.14 BTU/kWh. */
const BTU_PER_KWH = 3412;

/** Cooling Equivalent Full-Load Hours by climate zone. Sourced from ASHRAE
 *  90.1-2022 Appendix G3.1.3.10 + DOE Building America HVAC reference
 *  designs for multifamily residential equipment. Values are climate-band
 *  representative — actual EFLH for any specific building will swing ±20%
 *  with envelope quality, internal gains, and operating setpoints. */
export const COOLING_EFLH_BY_CZ: Record<ClimateZoneKey, number> = {
  "1A - Miami": 2400,
  "2A - Houston": 2000,
  "2B - Phoenix": 2200,
  "3A - Atlanta": 1500,
  "3B - LA": 1200,
  "3C - SF": 600,
  "4A - NYC": 1100,
  "4C - Seattle": 500,
  "5A - Chicago": 800,
  "5B - Denver": 1000,
  "6A - Minneapolis": 600,
  "7 - Duluth": 400,
};

/** Heating Equivalent Full-Load Hours by climate zone. Same sources as the
 *  cooling table above. Values reflect a heat-pump-equipped apartment;
 *  resistance-heated apartments see slightly higher EFLH (less aggressive
 *  setpoint scheduling) but the calculator treats them uniformly here for
 *  parity. */
export const HEATING_EFLH_BY_CZ: Record<ClimateZoneKey, number> = {
  "1A - Miami": 200,
  "2A - Houston": 800,
  "2B - Phoenix": 600,
  "3A - Atlanta": 1300,
  "3B - LA": 700,
  "3C - SF": 1200,
  "4A - NYC": 1900,
  "4C - Seattle": 2000,
  "5A - Chicago": 2500,
  "5B - Denver": 2300,
  "6A - Minneapolis": 2900,
  "7 - Duluth": 3300,
};

/** Cooling-degree-day distribution by month (Jan→Dec). Each row sums to ~1.0.
 *  Heating EFLH is allocated by `MONTHLY_HDD_FRAC[archetype]` from the shared
 *  constants module; cooling by these. Hot/mixed climates have longer cooling
 *  seasons + smaller seasonal swings; cold climates concentrate cooling in
 *  three midsummer months. */
export const MONTHLY_CDD_FRAC: Record<HDDArchetype, number[]> = {
  hot: [0.03, 0.03, 0.05, 0.07, 0.10, 0.12, 0.13, 0.13, 0.11, 0.09, 0.08, 0.06],
  mixed: [0.01, 0.01, 0.02, 0.05, 0.10, 0.16, 0.21, 0.20, 0.13, 0.07, 0.03, 0.01],
  cold: [0.0, 0.0, 0.01, 0.04, 0.09, 0.18, 0.27, 0.23, 0.13, 0.04, 0.01, 0.0],
  very_cold: [0.0, 0.0, 0.0, 0.02, 0.08, 0.20, 0.30, 0.25, 0.12, 0.03, 0.0, 0.0],
};

/** Map climate zone → archetype. Used to look up monthly HDD / CDD fraction
 *  arrays. Aligned with the DHW calculator's archetype binning so both
 *  domains share the same seasonal profile assumptions. */
export function archetypeForClimateZone(cz: ClimateZoneKey): HDDArchetype {
  if (cz.startsWith("1A") || cz.startsWith("2A") || cz.startsWith("2B")) return "hot";
  if (cz.startsWith("3")) return "mixed";
  if (cz.startsWith("4") || cz.startsWith("5")) return "cold";
  return "very_cold"; // 6, 7, 8
}

/** Compute annual kWh for one end-use given capacity, EFLH, and an
 *  efficiency rating. The metric switch handles the BTU/Wh vs dimensionless
 *  COP unit difference. */
function computeAnnualKWh(
  capacityBtuh: number,
  eflhHours: number,
  efficiency: number,
  metric: CoolingEffMetric | HeatingEffMetric,
): number {
  if (capacityBtuh <= 0 || eflhHours <= 0) return 0;
  if (metric === "resistance") {
    return (capacityBtuh * eflhHours) / BTU_PER_KWH;
  }
  if (metric === "COP") {
    const cop = Math.max(0.1, efficiency);
    return (capacityBtuh * eflhHours) / (cop * BTU_PER_KWH);
  }
  // SEER2, EER, HSPF2 — all BTU per Wh ratings
  const rating = Math.max(0.1, efficiency);
  return (capacityBtuh * eflhHours) / (rating * 1000);
}

/** Convert a rated efficiency to a dimensionless seasonal COP for display.
 *  Useful for the per-end-use card: users want a single dimensionless COP
 *  to mentally compare "this thing runs at X×". */
function efficiencyToCOP(
  efficiency: number,
  metric: CoolingEffMetric | HeatingEffMetric,
): number {
  if (metric === "resistance") return 1.0;
  if (metric === "COP") return efficiency;
  // BTU/Wh → COP: 1 W = 3.412 BTU/h, so rating[BTU/Wh] / 3.412 = COP.
  return efficiency / 3.412;
}

/** Build per-end-use rollup with both per-apt and whole-building views. */
function computeEndUse(
  endUse: "cooling" | "heating",
  capacityBtuh: number,
  eflhHours: number,
  ratedEfficiency: number,
  metric: CoolingEffMetric | HeatingEffMetric,
  apartmentCount: number,
  elecRate: number,
  emissionFactor: number,
): InUnitHvacEndUseResult {
  const perAptKWh = computeAnnualKWh(capacityBtuh, eflhHours, ratedEfficiency, metric);
  const perAptCost = perAptKWh * elecRate;
  const perAptCarbon = perAptKWh * emissionFactor;
  const aptCount = Math.max(0, apartmentCount);
  const buildingKWh = perAptKWh * aptCount;
  return {
    endUse,
    ratedEfficiency,
    effectiveCOP: efficiencyToCOP(ratedEfficiency, metric),
    capacityBtuh,
    eflhHours,
    perAptKWh,
    perAptCost,
    perAptCarbon,
    buildingKWh,
    buildingCost: buildingKWh * elecRate,
    buildingCarbon: buildingKWh * emissionFactor,
  };
}

/** Normalize an array so it sums to exactly 1.0 — handy because the
 *  published HDD/CDD fraction tables are rounded for readability and don't
 *  always sum to exactly 1. Without this, the monthly rollup drifts ~5%
 *  from the annual. */
function normalizeFractions(arr: readonly number[]): number[] {
  const sum = arr.reduce((s, v) => s + v, 0);
  if (sum <= 0) return arr.slice();
  return arr.map((v) => v / sum);
}

/** Build the 12-row monthly model. Cooling kWh distributes across the year
 *  by `MONTHLY_CDD_FRAC[archetype]`; heating kWh by `MONTHLY_HDD_FRAC`.
 *  Both fraction arrays are normalized so the monthly rollup matches the
 *  building annual exactly, regardless of any small rounding in the
 *  source-data tables. */
function buildMonthly(
  cooling: InUnitHvacEndUseResult,
  heating: InUnitHvacEndUseResult,
  archetype: HDDArchetype,
  elecRate: number,
  emissionFactor: number,
): InUnitHvacMonthlyResults {
  const cdd = normalizeFractions(MONTHLY_CDD_FRAC[archetype]);
  const hdd = normalizeFractions(MONTHLY_HDD_FRAC[archetype]);
  const monthly: InUnitHvacMonthlyRow[] = MONTHS.map((mName, m) => {
    const coolKWh = cooling.buildingKWh * cdd[m];
    const heatKWh = heating.buildingKWh * hdd[m];
    const totalEnergy = coolKWh + heatKWh;
    return {
      month: mName,
      monthIdx: m,
      daysInMonth: MONTH_DAYS[m],
      coolingKWh: coolKWh,
      heatingKWh: heatKWh,
      totalEnergy,
      totalCost: totalEnergy * elecRate,
      totalCarbon: totalEnergy * emissionFactor,
      unit: "kWh" as const,
    };
  });
  // Aggregate from monthly so any tiny float drift lives in one place + matches
  // what the chart displays. After normalization the sum equals
  // (cooling.buildingKWh + heating.buildingKWh) within float tolerance.
  const monthlyAnnualEnergy = monthly.reduce((s, r) => s + r.totalEnergy, 0);
  const monthlyAnnualCost = monthly.reduce((s, r) => s + r.totalCost, 0);
  const monthlyAnnualCarbon = monthly.reduce((s, r) => s + r.totalCarbon, 0);
  return {
    monthly,
    monthlyAnnualEnergy,
    monthlyAnnualCost,
    monthlyAnnualCarbon,
    monthlyUnit: "kWh",
  };
}

/** Generate compliance + advisory flags. Non-fatal — purely informational
 *  to nudge users toward code-compliant retrofit choices. */
function buildFlags(
  inputs: InUnitHvacInputs,
  cooling: InUnitHvacEndUseResult,
  heating: InUnitHvacEndUseResult,
  archetype: HDDArchetype,
): InUnitHvacComplianceFlag[] {
  const flags: InUnitHvacComplianceFlag[] = [];

  // ── Resistance heat in cold climates ─────────────────────────────────
  if (
    inputs.heatingEfficiencyMetric === "resistance" &&
    (archetype === "cold" || archetype === "very_cold")
  ) {
    flags.push({
      level: "warn",
      code: "Electrification advisory",
      msg: `Electric resistance heat in CZ${inputs.climateZone.split(" ")[0]} is the most expensive way to heat an apartment. A heat pump retrofit (HSPF2 ≥ 8.5 standard, ≥ 10.0 cold-climate) typically cuts heating kWh by 50–70% in this climate band — see the Retrofit Comparison tab.`,
    });
  }

  // ── ASHRAE 90.1-2022 §6.4 minimum efficiency check ───────────────────
  // PTAC/PTHP minimum EER 9.5 for cooling; SEER2 14.0 for split / packaged.
  if (
    (inputs.systemType === "ptac_resistance" || inputs.systemType === "pthp") &&
    inputs.coolingEfficiencyMetric === "EER" &&
    inputs.coolingEfficiency < 9.5
  ) {
    flags.push({
      level: "warn",
      code: "ASHRAE 90.1-2022 §6.4.1.4",
      msg: `Cooling EER ${inputs.coolingEfficiency.toFixed(1)} is below the ASHRAE 90.1-2022 minimum of 9.5 for PTAC/PTHP units. New equipment installed today must meet or exceed this floor.`,
    });
  }
  if (
    (inputs.systemType === "minisplit_hp" ||
      inputs.systemType === "minisplit_cool_resist" ||
      inputs.systemType === "ccshp" ||
      inputs.systemType === "central_split_hp" ||
      inputs.systemType === "central_split_ac_resist") &&
    inputs.coolingEfficiencyMetric === "SEER2" &&
    inputs.coolingEfficiency < 14.0
  ) {
    flags.push({
      level: "warn",
      code: "DOE Federal Minimum (2023)",
      msg: `Cooling SEER2 ${inputs.coolingEfficiency.toFixed(1)} is below the 2023 DOE federal minimum of 14.0 for split / packaged AC and HP equipment. New installations must meet this.`,
    });
  }

  // ── ENERGY STAR threshold check (informational) ───────────────────────
  if (
    (inputs.systemType === "minisplit_hp" ||
      inputs.systemType === "central_split_hp") &&
    inputs.coolingEfficiencyMetric === "SEER2" &&
    inputs.coolingEfficiency < 16.0
  ) {
    flags.push({
      level: "info",
      code: "ENERGY STAR Central AC/HP v6.1",
      msg: `Cooling SEER2 ${inputs.coolingEfficiency.toFixed(1)} meets DOE federal minimum but does not qualify for the ENERGY STAR label (≥ 16.0). ENERGY STAR-listed equipment is typically required for utility rebate programs.`,
    });
  }
  if (
    (inputs.systemType === "minisplit_hp" ||
      inputs.systemType === "central_split_hp") &&
    inputs.heatingEfficiencyMetric === "HSPF2" &&
    inputs.heatingEfficiency < 8.5
  ) {
    flags.push({
      level: "info",
      code: "ENERGY STAR Central AC/HP v6.1",
      msg: `Heating HSPF2 ${inputs.heatingEfficiency.toFixed(1)} does not meet the ENERGY STAR threshold of 8.5. Most utility heat-pump rebates require ENERGY STAR equipment.`,
    });
  }

  // ── NEEP Cold Climate suggestion in cold climates ────────────────────
  if (
    (inputs.systemType === "minisplit_hp" ||
      inputs.systemType === "central_split_hp") &&
    (archetype === "cold" || archetype === "very_cold") &&
    inputs.heatingEfficiencyMetric === "HSPF2" &&
    inputs.heatingEfficiency < 10.0
  ) {
    flags.push({
      level: "info",
      code: "NEEP Cold Climate ASHP",
      msg: `In CZ${inputs.climateZone.split(" ")[0]}, a standard heat pump (HSPF2 < 10.0) loses ~50% of capacity at 5°F and shifts heavily to resistance backup. Consider a NEEP Cold Climate ASHP (HSPF2 ≥ 10.0, capacity retention ≥ 70% at 5°F) — option "ccshp" (ductless) or specify HSPF2 ≥ 10.0 on a ducted central system in the system selector.`,
    });
  }

  // ── Heat pump in moderate climate (the easy win) ─────────────────────
  if (
    inputs.heatingEfficiencyMetric === "resistance" &&
    (archetype === "hot" || archetype === "mixed")
  ) {
    flags.push({
      level: "info",
      code: "Electrification advisory",
      msg: `Resistance heat is operationally expensive even in mild climates. A standard heat pump (PTHP at COP 3.0 or mini-split at HSPF2 8.5) typically pays back in 4–7 years on heating savings alone in CZ${inputs.climateZone.split(" ")[0]}.`,
    });
  }

  // ── EFLH override sanity ─────────────────────────────────────────────
  if (cooling.eflhHours > 4000) {
    flags.push({
      level: "warn",
      code: "EFLH sanity",
      msg: `Cooling EFLH ${cooling.eflhHours} hr is unusually high (>4000). Typical residential cooling EFLH falls 200–2400 hr depending on climate. Double-check the override or use the climate-zone default.`,
    });
  }
  if (heating.eflhHours > 5000) {
    flags.push({
      level: "warn",
      code: "EFLH sanity",
      msg: `Heating EFLH ${heating.eflhHours} hr is unusually high (>5000). Typical residential heating EFLH falls 200–3300 hr. Double-check the override.`,
    });
  }

  // ── All-clear for compliant equipment ────────────────────────────────
  const hasError = flags.some((f) => f.level === "warn" || f.level === "error");
  if (!hasError) {
    flags.push({
      level: "ok",
      code: "ASHRAE 90.1-2022 §6.4 / DOE 2023",
      msg: "Selected equipment efficiencies meet current code minimums. No compliance issues detected.",
    });
  }

  return flags;
}

export function runCalc(input: InUnitHvacInputs): InUnitHvacResult {
  const {
    apartmentCount,
    climateZone,
    coolingCapacityBtuh,
    coolingEfficiency,
    coolingEfficiencyMetric,
    heatingCapacityBtuh,
    heatingEfficiency,
    heatingEfficiencyMetric,
    coolingEflhOverride,
    heatingEflhOverride,
    elecRate,
    gridSubregion,
    customEF,
  } = input;

  const emissionFactor =
    gridSubregion === "Custom" ? customEF : (GRID_EF[gridSubregion] ?? customEF);

  // EFLH: user override (non-zero) wins over climate-zone lookup.
  const coolingEflh =
    coolingEflhOverride > 0
      ? coolingEflhOverride
      : (COOLING_EFLH_BY_CZ[climateZone] ?? 1000);
  const heatingEflh =
    heatingEflhOverride > 0
      ? heatingEflhOverride
      : (HEATING_EFLH_BY_CZ[climateZone] ?? 1500);

  const aptCount = Math.max(0, apartmentCount);

  const cooling = computeEndUse(
    "cooling",
    Math.max(0, coolingCapacityBtuh),
    coolingEflh,
    coolingEfficiency,
    coolingEfficiencyMetric,
    aptCount,
    elecRate,
    emissionFactor,
  );

  const heating = computeEndUse(
    "heating",
    Math.max(0, heatingCapacityBtuh),
    heatingEflh,
    heatingEfficiency,
    heatingEfficiencyMetric,
    aptCount,
    elecRate,
    emissionFactor,
  );

  const totalAnnualKWh = cooling.buildingKWh + heating.buildingKWh;
  const totalAnnualCost = cooling.buildingCost + heating.buildingCost;
  const totalAnnualCarbon = cooling.buildingCarbon + heating.buildingCarbon;

  // 1 ton refrigeration = 12,000 BTU/h
  const totalConnectedTons = (coolingCapacityBtuh * aptCount) / 12000;

  const archetype = archetypeForClimateZone(climateZone);
  const monthly = buildMonthly(cooling, heating, archetype, elecRate, emissionFactor);
  const flags = buildFlags(input, cooling, heating, archetype);

  // Sanity: ensure the climate zone is one we've cataloged. CLIMATE_DESIGN
  // is the source of truth for valid zone keys; if a stored input ever drifts
  // we surface a soft flag rather than throwing.
  if (!CLIMATE_DESIGN[climateZone]) {
    flags.unshift({
      level: "warn",
      code: "Unknown climate zone",
      msg: `Climate zone "${climateZone}" is not recognized; using fallback EFLH defaults. Pick one of the supported zones in the Equipment tab.`,
    });
  }

  return {
    apartmentCount: aptCount,
    cooling,
    heating,
    totalAnnualKWh,
    totalAnnualCost,
    totalAnnualCarbon,
    totalConnectedTons,
    flags,
    monthly,
  };
}
