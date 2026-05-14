/**
 * Derived metrics that aren't part of `runCalc`'s primary return shape but
 * are useful for consumers (UI tabs, exports, the Compare view). Kept in a
 * separate file so the pipeline stays focused on the core math and these
 * presentation-layer adapters live alongside the inputs/types they depend
 * on without bloating the pipeline file.
 */
import type { DhwInputs } from "./inputs";
import type { CalcResult } from "./types";
import { GAS_TANKLESS_WH } from "@/lib/engineering/constants";

/** Labeled efficiency value suitable for inclusion in a submittal, saved
 *  report, or Compare-tab column. */
export interface ReportingEfficiency {
  /** Short label naming what kind of efficiency this is — varies by system
   *  type because UEF (in-unit), thermal η (central boiler), and COP (HP)
   *  are different metrics. */
  label: string;
  /** Numeric value. For UEF / thermal η this is a fraction in [0, 1]; for
   *  COP it's a dimensionless ratio ≥ 1. */
  value: number;
  /** Pre-formatted display string with units suitable for a one-line
   *  report row. Includes the atmospheric/condensing/tankless qualifier
   *  where it matters. */
  display: string;
  /** Which metric family this is — lets consumers decide whether percent
   *  formatting or raw number is appropriate. */
  metric: "UEF" | "thermal_eff" | "COP" | "fixed";
}

/**
 * Resolve the right efficiency to surface for the chosen system, with a
 * label that names the metric correctly. Used by all export paths
 * (PDF / DOCX / Excel / CSV) and by the Compare tab so they all agree on
 * what "efficiency" means for a given system.
 *
 * Why this exists: central gas systems use `inputs.gasEfficiency` (a
 * boiler thermal η, typically 78–95%). In-unit gas tank systems use the
 * rating-table UEF (atmospheric: 0.64; condensing: 0.80–0.90 by size).
 * In-unit gas tankless systems use the tankless UEF for the chosen MBH
 * input. Hard-coding `inputs.gasEfficiency` in an exported report — as
 * `submittal.ts` did before this fix — silently misreported any in-unit
 * gas system as 95% efficient regardless of the user's atmospheric vs
 * condensing choice. That bug is now centralized here so it can't
 * re-appear in a copy-paste.
 *
 * Returns null when the system has no single gas-side efficiency to
 * report (pure HPWH, where COP belongs on a different row).
 */
export function resolveReportingEfficiency(
  inputs: DhwInputs,
  result: CalcResult,
): ReportingEfficiency | null {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const uef = (n: number) => n.toFixed(2);

  switch (inputs.systemType) {
    // ── In-unit gas tank (atmospheric OR condensing) ─────────────────────
    case "inunit_gas_tank":
    case "inunit_combi_gas": {
      const u = result.inUnitGas.gasTankUEF;
      return {
        label: `UEF (${inputs.gasTankType})`,
        value: u,
        display: `${uef(u)} UEF (${inputs.gasTankType}, ${inputs.gasTankSize}-gal)`,
        metric: "UEF",
      };
    }

    // ── In-unit gas tankless ─────────────────────────────────────────────
    case "inunit_gas_tankless": {
      const u = result.inUnitGas.tanklessSpec.uef;
      return {
        label: "UEF (tankless)",
        value: u,
        display: `${uef(u)} UEF (tankless, ${inputs.gasTanklessInput} MBH)`,
        metric: "UEF",
      };
    }

    // ── In-unit combi gas tankless (separate MBH input from the
    //    DHW-only tankless path; uses GAS_TANKLESS_WH lookup directly). ─
    case "inunit_combi_gas_tankless": {
      const spec = GAS_TANKLESS_WH[inputs.inunitGasTanklessCombiInput];
      const u = spec.uef;
      return {
        label: "UEF (combi tankless)",
        value: u,
        display: `${uef(u)} UEF (combi tankless, ${inputs.inunitGasTanklessCombiInput} MBH)`,
        metric: "UEF",
      };
    }

    // ── Central gas plants — use the user-entered boiler efficiency. ─────
    case "central_gas":
    case "central_gas_tankless":
    case "central_steam_hx":
    case "central_chp": {
      return {
        label: "Gas thermal efficiency",
        value: inputs.gasEfficiency,
        display: `${pct(inputs.gasEfficiency)} (${inputs.centralBoilerType})`,
        metric: "thermal_eff",
      };
    }

    // ── Central indirect — combined gas η × HX effectiveness. ────────────
    case "central_indirect": {
      return {
        label: "Effective η (gas × HX)",
        value: result.effectiveGasEfficiency,
        display: `${pct(result.effectiveGasEfficiency)} (gas ${pct(inputs.gasEfficiency)} × HX ${pct(inputs.indirectHXEffectiveness)})`,
        metric: "thermal_eff",
      };
    }

    // ── Central hybrid — HPWH carries baseload; gas backup runs at
    //    gasEfficiency. Report the backup leg's efficiency. ───────────────
    case "central_hybrid": {
      return {
        label: "Gas backup efficiency",
        value: inputs.gasEfficiency,
        display: `${pct(inputs.gasEfficiency)} (${inputs.centralBoilerType} backup)`,
        metric: "thermal_eff",
      };
    }

    // ── Resistance equipment — COP = 1.0 by physics. ─────────────────────
    case "central_resistance":
    case "inunit_resistance":
    case "inunit_combi_resistance": {
      return {
        label: "Equipment efficiency",
        value: 1.0,
        display: "100% (electric resistance)",
        metric: "fixed",
      };
    }

    // ── Pure HPWH systems — no single gas η to report. ───────────────────
    case "central_hpwh":
    case "central_per_floor":
    case "central_hrc":
    case "central_wastewater_hp":
    case "inunit_hpwh":
    case "inunit_combi":
      return null;
  }
}
