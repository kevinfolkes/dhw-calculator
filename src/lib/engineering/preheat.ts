/**
 * Preheat modifier math (Phase D).
 *
 * Two architectural modifiers that lift the effective inlet water temperature
 * before the primary DHW system runs its calc:
 *
 *  1. Solar thermal — a glazed flat-plate collector array feeds a solar
 *     storage tank that pre-heats inlet water. Modeled at monthly granularity
 *     using a simplified solar-fraction lookup keyed on collector area,
 *     climate-archetype insolation, and the monthly DHW load.
 *
 *  2. Drainwater heat recovery (DWHR) — vertical falling-film HX captures
 *     waste heat from drain water and pre-heats the cold supply. Modeled as
 *     a constant inlet lift (annual average) since DWHR only operates during
 *     simultaneous draw events; the residential energy balance over a month
 *     reduces to effectiveness × coverage × (drainTemp - inlet).
 *
 * References:
 *   - ASHRAE Handbook Applications Ch. 36 (Solar Energy Use)
 *   - ASHRAE 93 (collector test method)
 *   - CSA B55.1 / B55.2 (DWHR test + installation standard)
 *   - NREL DWHR field studies (Schoenbauer 2012/2017)
 */
import {
  SOLAR_COLLECTOR_DEFAULT_ETA,
  SOLAR_INSOLATION_BTU_PER_SQFT_PER_DAY,
  type HDDArchetype,
} from "./constants";

/** Hard ceiling on monthly solar fraction. Even oversized arrays asymptote
 *  around 80–85% due to overnight + shoulder draws the storage tank can't
 *  cover without backup. */
const SOLAR_FRACTION_CEILING = 0.85;

/** Tiny denominator guard so a near-zero monthly DHW load doesn't blow up
 *  the SF calc (the result clamps to 0 before this matters in practice, but
 *  the epsilon keeps the math finite). */
const DHW_BTU_EPSILON = 1;

/**
 * Monthly solar fraction (0..0.85): the share of monthly DHW energy supplied
 * by the solar collector array. Capped at 0.85 to reflect the practical
 * limit imposed by overnight / shoulder draws no array can cover.
 *
 * Inputs:
 *   - month: 0..11 (Jan..Dec)
 *   - collectorAreaSqft: total aperture area (≥ 0)
 *   - archetype: climate archetype keying the insolation lookup
 *   - monthlyDHW_BTU: total DHW thermal load for the month at the system
 *     boundary (not site BTU — the load the solar tank is competing for)
 *   - eta: collector efficiency (dimensionless, default 0.55)
 *   - daysInMonth: number of days in the month (28..31)
 */
export function solarMonthlyFraction(
  month: number,
  collectorAreaSqft: number,
  archetype: HDDArchetype,
  monthlyDHW_BTU: number,
  daysInMonth: number,
  eta: number = SOLAR_COLLECTOR_DEFAULT_ETA,
): number {
  if (collectorAreaSqft <= 0) return 0;
  const dailyInsolation = SOLAR_INSOLATION_BTU_PER_SQFT_PER_DAY[archetype][month];
  const monthlyCollected =
    collectorAreaSqft * dailyInsolation * eta * daysInMonth;
  const sf = monthlyCollected / (monthlyDHW_BTU + DHW_BTU_EPSILON);
  if (!Number.isFinite(sf) || sf <= 0) return 0;
  return Math.min(SOLAR_FRACTION_CEILING, sf);
}

/**
 * Convert a monthly solar fraction into an inlet temperature lift (°F).
 *
 * Energy-balance simplification: pre-heating the inlet by SF × (setpoint −
 * baseInlet) reduces the primary heater's monthly thermal load by SF ×
 * (setpoint − baseInlet) × (lb·avgDayDemand·days), which is exactly the
 * monthly load × SF the solar collector covers. Real systems pre-heat
 * through a separate solar storage tank that the primary tops up — the lift
 * formulation gets the same kWh/therms reduction at the primary heater
 * without modeling two tanks.
 */
export function solarMonthlyLiftF(
  month: number,
  collectorAreaSqft: number,
  archetype: HDDArchetype,
  monthlyDHW_BTU: number,
  daysInMonth: number,
  setpointF: number,
  baseInletF: number,
  eta: number = SOLAR_COLLECTOR_DEFAULT_ETA,
): number {
  const sf = solarMonthlyFraction(
    month,
    collectorAreaSqft,
    archetype,
    monthlyDHW_BTU,
    daysInMonth,
    eta,
  );
  const deltaT = Math.max(0, setpointF - baseInletF);
  return sf * deltaT;
}

/**
 * Constant inlet lift (°F) from a DWHR unit. DWHR only operates during
 * simultaneous draw (shower running with concurrent drain flow). For typical
 * residential use patterns the constant-lift approximation across the whole
 * monthly inlet reproduces measured savings within ±10% — see NREL DWHR
 * studies (Schoenbauer 2012/2017).
 *
 * Result is clamped to be non-negative and never exceeds the available
 * (drainTempF − baseInletF) ΔT — no DWHR can pump heat against gravity.
 */
export function dwhrLiftF(
  effectiveness: number,
  coverage: number,
  drainTempF: number,
  baseInletF: number,
): number {
  const eff = Math.min(1, Math.max(0, effectiveness));
  const cov = Math.min(1, Math.max(0, coverage));
  const deltaT = Math.max(0, drainTempF - baseInletF);
  return eff * cov * deltaT;
}

/**
 * Combine solar and DWHR inlet lifts. Both modifiers add, but the combined
 * lift is bounded at 0.95 × (setpoint − baseInlet) so the math never
 * approaches the asymptotic case of "preheat == setpoint" (zero primary
 * load, division-by-zero risk in downstream rise-driven calcs).
 */
export function combinedPreheatLiftF(
  solarLiftF: number,
  dwhrLift: number,
  setpointF: number,
  baseInletF: number,
): number {
  const naive = Math.max(0, solarLiftF) + Math.max(0, dwhrLift);
  const ceiling = 0.95 * Math.max(0, setpointF - baseInletF);
  return Math.min(naive, ceiling);
}
