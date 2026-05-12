/**
 * Result type for the in-unit HVAC calculator. Mirrors `LightingResult` and
 * `CalcResult`: a typed record of every output the UI needs, plus a 12-row
 * monthly array for charting.
 *
 * The `monthly` block intentionally mirrors DHW's and lighting's
 * `MonthlyResults` shape (`monthlyAnnualEnergy / Cost / Carbon` +
 * `monthlyUnit`) so the same Compare-tab metric helpers can read either
 * domain — see DHW's v0.4.1 Compare-tab fix.
 */

/** Per-end-use rollup (cooling / heating). Surfaced separately so the
 *  Energy tab can show users which side of the load dominates and where
 *  retrofit savings will accrue. */
export interface InUnitHvacEndUseResult {
  endUse: "cooling" | "heating";
  /** Rated efficiency value as entered (SEER2 / EER / HSPF2 / COP / 1.0). */
  ratedEfficiency: number;
  /** Effective dimensionless COP used in the calc. Resistance = 1.0; SEER2 /
   *  HSPF2 / EER are converted to a dimensionless COP via the BTU↔Wh constant
   *  for display purposes only — the underlying math uses the raw BTU/Wh
   *  rating. */
  effectiveCOP: number;
  /** Per-apartment design capacity at AHRI rating point (BTU/h). */
  capacityBtuh: number;
  /** Equivalent Full-Load Hours used in the calc — either the climate-zone
   *  lookup or the user's override. */
  eflhHours: number;
  /** Per-apartment annual electricity (kWh). */
  perAptKWh: number;
  /** Per-apartment annual cost ($). */
  perAptCost: number;
  /** Per-apartment annual carbon (lb CO₂e). */
  perAptCarbon: number;
  /** Whole-building annual electricity (kWh). */
  buildingKWh: number;
  /** Whole-building annual cost ($). */
  buildingCost: number;
  /** Whole-building annual carbon (lb CO₂e). */
  buildingCarbon: number;
}

/** One month's energy/cost/carbon row, split by end use so the chart can
 *  stack cooling on heating. Values are climate-weighted via HDD/CDD shares
 *  for the building's climate archetype. */
export interface InUnitHvacMonthlyRow {
  month: string;
  monthIdx: number;
  daysInMonth: number;
  /** Cooling kWh attributed to this month. Cold-climate winter months will
   *  be near zero; subtropical climates carry cooling load year-round. */
  coolingKWh: number;
  /** Heating kWh attributed to this month. Hot-climate summer months will
   *  be near zero. */
  heatingKWh: number;
  /** coolingKWh + heatingKWh */
  totalEnergy: number;
  totalCost: number;
  totalCarbon: number;
  /** Always "kWh" — in-unit HVAC is pure-electric in every supported
   *  archetype. Field name matches lighting/DHW for cross-domain tooling. */
  unit: "kWh";
}

export interface InUnitHvacMonthlyResults {
  monthly: InUnitHvacMonthlyRow[];
  monthlyAnnualEnergy: number;
  monthlyAnnualCost: number;
  monthlyAnnualCarbon: number;
  /** Always "kWh". */
  monthlyUnit: "kWh";
}

export interface InUnitHvacComplianceFlag {
  level: "ok" | "info" | "warn" | "error";
  code: string;
  msg: string;
}

export interface InUnitHvacResult {
  /** Number of apartments multiplied through. Surfaced for the rollup. */
  apartmentCount: number;
  /** The cooling side rollup. */
  cooling: InUnitHvacEndUseResult;
  /** The heating side rollup. */
  heating: InUnitHvacEndUseResult;
  /** Whole-building annual electricity (kWh). */
  totalAnnualKWh: number;
  /** Whole-building annual cost ($). */
  totalAnnualCost: number;
  /** Whole-building annual carbon (lb CO₂e). */
  totalAnnualCarbon: number;
  /** Total connected cooling capacity (refrigeration tons; 12,000 BTU/h = 1
   *  ton). Useful for sizing rollups + fitting comparisons against central-
   *  plant alternatives. */
  totalConnectedTons: number;
  /** Compliance + advisory flags (analogue to DHW + lighting `flags`). */
  flags: InUnitHvacComplianceFlag[];
  /** Monthly model — 12 rows summing to the annual rollup. */
  monthly: InUnitHvacMonthlyResults;
}
