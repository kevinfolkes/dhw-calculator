/**
 * Result type for the multifamily lighting calculator. Mirrors the
 * `CalcResult` pattern from DHW: a typed record of every output the UI
 * needs, plus monthly arrays for charting.
 *
 * The `monthly` block intentionally mirrors DHW's `MonthlyResults` shape
 * (`monthlyAnnualEnergy / Cost / Carbon` + `monthlyUnit`) so the same
 * Compare-tab metric helpers can read either domain — see the DHW Compare
 * tab's `annualCost(r)` / `annualKWh(r)` helpers from the v0.4.1 fix.
 */
import type { LightingCategory } from "./inputs";

/** Per-category annual rollup. Surfaced in the Equipment + Energy tabs so
 *  users can see which category dominates the load. */
export interface LightingCategoryResult {
  category: LightingCategory;
  /** Total connected wattage = count × wattsPerFixture (W). */
  connectedWatts: number;
  /** Effective annual operating hours after occupancy + daylight reductions. */
  annualHours: number;
  /** Annual electricity consumption (kWh). */
  annualKWh: number;
  /** Annual energy cost ($). */
  annualCost: number;
  /** Annual carbon emissions (lb CO₂e). */
  annualCarbon: number;
}

export interface LightingMonthlyRow {
  month: string;
  monthIdx: number;
  daysInMonth: number;
  /** Total kWh consumed across all categories during this month. */
  totalEnergy: number;
  totalCost: number;
  totalCarbon: number;
  /** Unit label (always "kWh" for lighting — no fuel switching). */
  unit: "kWh";
}

export interface LightingMonthlyResults {
  monthly: LightingMonthlyRow[];
  monthlyAnnualEnergy: number;
  monthlyAnnualCost: number;
  monthlyAnnualCarbon: number;
  /** Always "kWh" for lighting. Mirrors DHW's `monthlyUnit` field so
   *  cross-domain Compare-tab helpers can read the same field name. */
  monthlyUnit: "kWh";
}

export interface LightingComplianceFlag {
  level: "ok" | "info" | "warn" | "error";
  code: string;
  msg: string;
}

export interface LightingResult {
  /** Per-category breakdown for the Energy tab table. */
  categories: LightingCategoryResult[];
  /** Total connected wattage across every category (W). */
  totalConnectedWatts: number;
  /** Building-method LPD = totalConnectedWatts / totalBuildingSqft (W/ft²). */
  lpdWattsPerSqft: number;
  /** Annual electricity (kWh) — sum of category annuals. */
  annualKWh: number;
  /** Annual cost ($). */
  annualCost: number;
  /** Annual carbon (lb CO₂e). */
  annualCarbon: number;
  /** Annual fixture-hours saved by occupancy sensors across all categories.
   *  Surfaced in the calculations tab so users can see how much each
   *  control choice contributes. */
  occupancySensorHoursSaved: number;
  /** Annual fixture-hours saved by daylight credits. */
  daylightHoursSaved: number;
  /** Compliance + advisory flags (analogue to DHW `flags`). */
  flags: LightingComplianceFlag[];
  /** Monthly model — 12 rows summing to the annual rollup. Lighting load
   *  is largely uniform month-to-month (no climate sensitivity), so each
   *  row is roughly annual/12 with day-count adjustment. Surfaced in the
   *  Energy tab for chart parity with DHW. */
  monthly: LightingMonthlyResults;
}
