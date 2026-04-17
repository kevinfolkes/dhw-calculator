/**
 * Simplified HPWH performance curves. These are piecewise fits to published
 * manufacturer data (Colmac CxA/CxV, SANCO2, Mitsubishi QAHV and typical HFC
 * residential HPWHs).
 *
 * For high-fidelity sizing, swap these for AHRI certified performance files.
 */

export type Refrigerant = "CO2" | "HFC";

/**
 * HPWH coefficient of performance as a function of ambient temperature, inlet
 * water temperature, and setpoint. Returns a dimensionless COP.
 */
export function hpwhCOP(
  ambientF: number,
  inletF: number,
  setpointF: number,
  refrigerant: Refrigerant,
): number {
  const dT = setpointF - inletF;
  const ambientC = ((ambientF - 32) * 5) / 9;
  if (refrigerant === "CO2") {
    // CO2 transcritical: high COP with cold inlet, degrades as inlet warms.
    const inletPenalty = Math.max(0, (inletF - 50) * 0.015);
    const ambientBoost = Math.max(-0.3, Math.min(0.8, (ambientC - 10) * 0.04));
    return Math.max(1.5, 3.2 + ambientBoost - inletPenalty);
  }
  // HFC (R134a/R513A/R454B): more ambient-sensitive, inlet less impactful.
  const ambientFactor = Math.max(-1.2, Math.min(0.6, (ambientC - 15) * 0.055));
  const liftPenalty = Math.max(0, (dT - 70) * 0.008);
  return Math.max(1.3, 2.9 + ambientFactor - liftPenalty);
}

/**
 * HPWH output capacity derate vs ambient. Returns a fraction (0–1.1) of
 * nameplate capacity available at the given ambient.
 */
export function hpwhCapacityFactor(ambientF: number, refrigerant: Refrigerant): number {
  const ambientC = ((ambientF - 32) * 5) / 9;
  if (refrigerant === "CO2") {
    return Math.max(0.55, Math.min(1.1, 0.75 + ambientC * 0.012));
  }
  return Math.max(0.45, Math.min(1.05, 0.70 + ambientC * 0.018));
}

/**
 * For combi systems, determine the effective tank setpoint the HPWH must
 * maintain in order to supply the fan coil with adequate ΔT. Tank must run
 * at ≥ (fanCoilSupply + 5°F) or the DHW setpoint, whichever is higher.
 */
export function combiCOPAdjustment(fanCoilSupplyF: number, tankF: number): number {
  return Math.max(tankF, fanCoilSupplyF + 5);
}
