/**
 * Climate helpers — maps ASHRAE climate zones to monthly archetypes and
 * generates monthly ambient/inlet water profiles used by the energy model.
 *
 * Reference: ASHRAE Handbook Fundamentals Ch. 32 / Burch & Christensen 2007.
 */
import {
  CLIMATE_DESIGN,
  MONTHLY_AMBIENT_AMPLITUDE_F,
  type ClimateZoneKey,
  type HDDArchetype,
} from "./constants";

/**
 * Map an ASHRAE climate zone string ("5A - Chicago") to a monthly-HDD archetype.
 */
export function getMonthlyHDDArchetype(climateZoneStr: string): HDDArchetype {
  const zone = parseInt(climateZoneStr, 10);
  if (zone <= 2) return "hot";
  if (zone <= 4) return "mixed";
  if (zone <= 6) return "cold";
  return "very_cold";
}

/**
 * Monthly outdoor ambient offset (°F) from annual mean. Month 0 = January
 * (coldest), month 6 = July (warmest). Amplitude varies by climate archetype.
 */
export function monthlyAmbientAdjustment(month: number, climateZoneStr: string): number {
  const archetype = getMonthlyHDDArchetype(climateZoneStr);
  const amp = MONTHLY_AMBIENT_AMPLITUDE_F[archetype];
  return -amp * Math.cos((2 * Math.PI * month) / 12);
}

/**
 * Monthly inlet water temperature offset from annual mean. Ground water lags
 * air temp by ~1.5 months and has ~45% the amplitude.
 */
export function monthlyInletAdjustment(month: number, climateZoneStr: string): number {
  const archetype = getMonthlyHDDArchetype(climateZoneStr);
  const amp = MONTHLY_AMBIENT_AMPLITUDE_F[archetype] * 0.45;
  const lag = 1.5;
  return -amp * Math.cos((2 * Math.PI * (month - lag)) / 12);
}

/**
 * Annual mean inlet water temperature (°F) for a climate zone.
 * Ref: Burch & Christensen 2007 — groundwater annual mean ≈ annual mean air temp.
 */
export function deriveInletWaterF(climateZoneStr: string): number {
  const design = CLIMATE_DESIGN[climateZoneStr as ClimateZoneKey];
  if (!design) return 50;
  return Math.round(design.avgAnnual);
}

/**
 * Winter-design (coldest-month) inlet water temperature (°F). Used for
 * worst-case tank FHR sizing. Applies the cold-side extreme of the monthly
 * inlet adjustment curve to the annual mean.
 */
export function winterDesignInletF(climateZoneStr: string): number {
  const mean = deriveInletWaterF(climateZoneStr);
  // January (month 0) is the coldest month in the monthly inlet curve.
  return Math.round(mean + monthlyInletAdjustment(0, climateZoneStr));
}
