/**
 * Recirculation-loop standby loss model.
 *
 * Simplified: bare copper at 1" nominal loses ~0.4 BTU/hr/ft per °F of
 * pipe-ambient ΔT. Insulation reduces this by 1 / (1 + R / 0.35), where 0.35
 * is the bare-pipe resistance baseline.
 *
 * Returns combined supply+return loss.
 */
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

export function recircStandbyLoss(input: RecircLossInput): RecircLossResult {
  const bareLossPerFt = (input.returnTempF - input.ambientPipeF) * 0.4;
  const insulatedLossPerFt = bareLossPerFt / (1 + input.insulationR / 0.35);
  const lossBTUH = insulatedLossPerFt * input.loopLengthFt * 2;
  return { lossBTUH, lossKW: lossBTUH / 3412 };
}
