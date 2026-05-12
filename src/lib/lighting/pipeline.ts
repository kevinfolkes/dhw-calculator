/**
 * Lighting calculator pipeline. Pure function: `LightingInputs → LightingResult`.
 *
 * Math (per category):
 *   connectedWatts   = count × wattsPerFixture
 *   nominalAnnualHrs = hoursPerDay × 365
 *   effectiveHrs     = nominalAnnualHrs × (1 − occupancySensorReduction)
 *                                       × (1 − daylightCredit)
 *   annualKWh        = connectedWatts × effectiveHrs / 1000
 *   annualCost       = annualKWh × elecRate
 *   annualCarbon     = annualKWh × emissionFactor[gridSubregion]
 *
 * Building rollup is the sum across all categories. LPD (W/ft²) = sum of
 * connected watts / total building sqft; checked against ASHRAE 90.1-2022
 * §9.5.1 Table 9.5.1 building-area method limits (~0.45–0.65 W/ft² for
 * residential multifamily).
 *
 * Monthly profile is essentially uniform: lighting demand doesn't vary
 * meaningfully with climate (corridors stay lit year-round, in-unit usage
 * has a small winter bump but it's well within the ±5% noise of metered
 * data). Each monthly row is annual × (daysInMonth / 365) — accurate enough
 * for the rollup.
 */
import { GRID_EF, MONTH_DAYS, MONTHS } from "@/lib/engineering/constants";
import {
  LIGHTING_CATEGORIES,
  type LightingInputs,
  type LightingCategoryConfig,
  type LightingCategory,
} from "./inputs";
import type {
  LightingComplianceFlag,
  LightingMonthlyResults,
  LightingMonthlyRow,
  LightingCategoryResult,
  LightingResult,
} from "./types";

/** ASHRAE 90.1-2022 §9.5.1 Building-Area Method LPD limit for residential
 *  multifamily, used as the compliance benchmark. Real spec is space-by-
 *  space; this single number is the simple advisory threshold. */
const ASHRAE_RESIDENTIAL_MF_LPD_LIMIT = 0.45;

/** Effective annual operating hours after occupancy + daylight reductions. */
function effectiveAnnualHours(c: LightingCategoryConfig): number {
  const nominal = c.hoursPerDay * 365;
  const occMult = 1 - clamp01(c.occupancySensorReduction);
  const dayMult = 1 - clamp01(c.daylightCredit);
  return nominal * occMult * dayMult;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function computeCategory(
  category: LightingCategory,
  config: LightingCategoryConfig,
  elecRate: number,
  emissionFactor: number,
): LightingCategoryResult {
  const connectedWatts = Math.max(0, config.count) * Math.max(0, config.wattsPerFixture);
  const annualHours = effectiveAnnualHours(config);
  const annualKWh = (connectedWatts * annualHours) / 1000;
  return {
    category,
    connectedWatts,
    annualHours,
    annualKWh,
    annualCost: annualKWh * elecRate,
    annualCarbon: annualKWh * emissionFactor,
  };
}

function buildMonthly(
  annualKWh: number,
  annualCost: number,
  annualCarbon: number,
): LightingMonthlyResults {
  const monthly: LightingMonthlyRow[] = MONTHS.map((mName, m) => {
    // Day-count weighting — lighting load is uniform per day, so each month
    // gets its share of the annual based on daysInMonth / 365.
    const share = MONTH_DAYS[m] / 365;
    return {
      month: mName,
      monthIdx: m,
      daysInMonth: MONTH_DAYS[m],
      totalEnergy: annualKWh * share,
      totalCost: annualCost * share,
      totalCarbon: annualCarbon * share,
      unit: "kWh" as const,
    };
  });
  return {
    monthly,
    monthlyAnnualEnergy: annualKWh,
    monthlyAnnualCost: annualCost,
    monthlyAnnualCarbon: annualCarbon,
    monthlyUnit: "kWh",
  };
}

function buildFlags(
  lpd: number,
  totalBuildingSqft: number,
  categoryResults: LightingCategoryResult[],
  inputs: LightingInputs,
): LightingComplianceFlag[] {
  const flags: LightingComplianceFlag[] = [];

  // ── ASHRAE 90.1 §9.5.1 LPD compliance ────────────────────────────────
  if (totalBuildingSqft <= 0) {
    flags.push({
      level: "warn",
      code: "ASHRAE 90.1-2022 §9.5.1",
      msg: "Total building sqft is zero — LPD cannot be computed. Enter the conditioned + non-conditioned interior area to evaluate compliance.",
    });
  } else if (lpd > ASHRAE_RESIDENTIAL_MF_LPD_LIMIT) {
    flags.push({
      level: "warn",
      code: "ASHRAE 90.1-2022 §9.5.1",
      msg: `Building-method LPD = ${lpd.toFixed(2)} W/ft² exceeds the residential multifamily limit of ${ASHRAE_RESIDENTIAL_MF_LPD_LIMIT.toFixed(2)} W/ft². LED retrofit and/or controls upgrades typically bring this into compliance.`,
    });
  } else {
    flags.push({
      level: "ok",
      code: "ASHRAE 90.1-2022 §9.5.1",
      msg: `Building-method LPD = ${lpd.toFixed(2)} W/ft² is within the residential multifamily limit of ${ASHRAE_RESIDENTIAL_MF_LPD_LIMIT.toFixed(2)} W/ft².`,
    });
  }

  // ── ASHRAE 90.1 §9.4 Controls ────────────────────────────────────────
  // Corridors and stairwells require automatic occupancy / step-dimming
  // controls per §9.4. Flag info-level when controls are absent.
  const corridor = inputs.categories.corridor;
  const stairwell = inputs.categories.stairwell;
  if (corridor.count > 0 && corridor.occupancySensorReduction === 0) {
    flags.push({
      level: "info",
      code: "ASHRAE 90.1-2022 §9.4.1",
      msg: "Corridors should have automatic step-dimming or occupancy controls — typical savings 25–50% of base operating hours. Bumping the corridor occupancy-sensor reduction to 0.30 reflects a code-compliant retrofit.",
    });
  }
  if (stairwell.count > 0 && stairwell.occupancySensorReduction === 0) {
    flags.push({
      level: "info",
      code: "ASHRAE 90.1-2022 §9.4.1 (e)",
      msg: "Stairwells require occupancy-controlled step-dimming or bi-level controls — typical savings 40–60% of base operating hours. Bumping the stairwell occupancy-sensor reduction to 0.50 reflects a code-compliant retrofit.",
    });
  }

  // ── Incandescent / fluorescent flags (DOE phaseout) ──────────────────
  // 100W+ fixtures are highly suggestive of HID / metal halide on the
  // exterior side, or fluorescent troffers indoors. LED retrofit candidates.
  const exteriorPole = categoryResults.find((c) => c.category === "exteriorSite");
  if (
    exteriorPole &&
    exteriorPole.connectedWatts > 0 &&
    inputs.categories.exteriorSite.wattsPerFixture >= 175
  ) {
    flags.push({
      level: "info",
      code: "DOE LED retrofit",
      msg: "Exterior site fixtures ≥ 175W typically indicate HID / metal-halide poles. LED replacements (~70W) cut energy ~70% with no compromise in lumen output and eliminate ballast maintenance.",
    });
  }
  const corridorRes = categoryResults.find((c) => c.category === "corridor");
  if (
    corridorRes &&
    corridorRes.connectedWatts > 0 &&
    inputs.categories.corridor.wattsPerFixture >= 40
  ) {
    flags.push({
      level: "info",
      code: "DOE LED retrofit",
      msg: "Corridor fixtures ≥ 40W are likely incandescent or first-generation CFL. Modern LED equivalents are 8–15W per fixture (>75% energy reduction) and last 5–10× longer.",
    });
  }

  return flags;
}

export function runCalc(input: LightingInputs): LightingResult {
  const { totalBuildingSqft, elecRate, gridSubregion, customEF } = input;
  const emissionFactor =
    gridSubregion === "Custom" ? customEF : (GRID_EF[gridSubregion] ?? customEF);

  // Per-category results (in declared category order so the UI table
  // renders consistently).
  const categories: LightingCategoryResult[] = LIGHTING_CATEGORIES.map((cat) =>
    computeCategory(cat, input.categories[cat], elecRate, emissionFactor),
  );

  const totalConnectedWatts = categories.reduce((s, c) => s + c.connectedWatts, 0);
  const annualKWh = categories.reduce((s, c) => s + c.annualKWh, 0);
  const annualCost = categories.reduce((s, c) => s + c.annualCost, 0);
  const annualCarbon = categories.reduce((s, c) => s + c.annualCarbon, 0);

  const lpd = totalBuildingSqft > 0 ? totalConnectedWatts / totalBuildingSqft : 0;

  // Hour-savings rollup for the Calculations tab — sum across categories
  // of (nominal − effective after each control type).
  let occupancySensorHoursSaved = 0;
  let daylightHoursSaved = 0;
  for (const cat of LIGHTING_CATEGORIES) {
    const c = input.categories[cat];
    const nominal = c.hoursPerDay * 365;
    const occShare = clamp01(c.occupancySensorReduction);
    const dayShare = clamp01(c.daylightCredit);
    const fixtures = Math.max(0, c.count);
    occupancySensorHoursSaved += nominal * occShare * fixtures;
    // Daylight applies AFTER occupancy reduction in the multiplicative
    // model — so its incremental hours saved are taken from the post-occ
    // baseline, not nominal.
    daylightHoursSaved += nominal * (1 - occShare) * dayShare * fixtures;
  }

  const monthly = buildMonthly(annualKWh, annualCost, annualCarbon);
  const flags = buildFlags(lpd, totalBuildingSqft, categories, input);

  return {
    categories,
    totalConnectedWatts,
    lpdWattsPerSqft: lpd,
    annualKWh,
    annualCost,
    annualCarbon,
    occupancySensorHoursSaved,
    daylightHoursSaved,
    flags,
    monthly,
  };
}
