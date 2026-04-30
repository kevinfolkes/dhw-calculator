/**
 * Recirculation-loop standby loss model.
 *
 * Simplified: bare copper at 1" nominal loses ~0.4 BTU/hr/ft per °F of
 * pipe-ambient ΔT. Insulation reduces this by 1 / (1 + R / 0.35), where 0.35
 * is the bare-pipe resistance baseline.
 *
 * Returns combined supply+return loss.
 */
import {
  RECIRC_CONTROL_LOSS_MULTIPLIER,
  type RecircControlMode,
} from "./constants";

export interface RecircLossInput {
  /** Recirculation loop length, one-way (ft). Supply+return = 2× this. */
  loopLengthFt: number;
  /** Pipe insulation R-value */
  insulationR: number;
  /** Loop return water temp (°F) */
  returnTempF: number;
  /** Ambient air temp surrounding the pipes (°F) */
  ambientPipeF: number;
}

export interface RecircLossResult {
  lossBTUH: number;
  lossKW: number;
}

/**
 * Pure physics: continuous-pumping recirc loop standby loss. The control-mode
 * multiplier is applied separately by `applyRecircControl`.
 */
export function recircStandbyLoss(input: RecircLossInput): RecircLossResult {
  const bareLossPerFt = (input.returnTempF - input.ambientPipeF) * 0.4;
  const insulatedLossPerFt = bareLossPerFt / (1 + input.insulationR / 0.35);
  const lossBTUH = insulatedLossPerFt * input.loopLengthFt * 2;
  return { lossBTUH, lossKW: lossBTUH / 3412 };
}

/**
 * Resolves the effective recirc-loss multiplier for a given control mode.
 *
 * For `time_clock` mode the multiplier scales with the user's selected
 * hours-per-day, but with a 0.75 weighting to reflect that schedules
 * typically exclude overnight hours when standby losses matter most:
 *
 *   multiplier_time_clock = (hoursPerDay / 24) × 0.75
 *
 * At the spec-default 16 hr/day this yields 0.50, matching the static value
 * in RECIRC_CONTROL_LOSS_MULTIPLIER. For all other modes the multiplier is
 * the static lookup value.
 *
 * Sources: ASHRAE 90.1-2022 §6.5.5; ACEEE multifamily distribution studies;
 * SoCalGas / Taco / Watts demand-control pilot data.
 */
export function recircControlMultiplier(
  mode: RecircControlMode,
  timeClockHoursPerDay: number,
): number {
  if (mode === "time_clock") {
    const clamped = Math.max(0, Math.min(24, timeClockHoursPerDay));
    return (clamped / 24) * 0.75;
  }
  return RECIRC_CONTROL_LOSS_MULTIPLIER[mode];
}

/**
 * Applies the recirc control-mode multiplier to a raw (continuous-pumping)
 * loss result. Returns the adjusted loss in both BTU/hr and kW. The 1.0
 * multiplier on `"continuous"` mode is a no-op so legacy inputs without a
 * `recircControl` field produce identical results.
 */
export function applyRecircControl(
  raw: RecircLossResult,
  mode: RecircControlMode,
  timeClockHoursPerDay: number,
): RecircLossResult & { multiplier: number } {
  const m = recircControlMultiplier(mode, timeClockHoursPerDay);
  return {
    lossBTUH: raw.lossBTUH * m,
    lossKW: raw.lossKW * m,
    multiplier: m,
  };
}
