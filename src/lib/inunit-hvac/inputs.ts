/**
 * Typed input shape for the in-unit HVAC calculator. Per-apartment cooling +
 * heating equipment serving each unit individually — distinct from a central
 * boiler/chiller plant or rooftop packaged unit. Mirrors the `LightingInputs`
 * pattern: a single object that can be serialized (URL params, localStorage,
 * report library) and threaded through a pure `runCalc()`.
 *
 * Engineering scope: the six common in-unit HVAC archetypes in U.S.
 * multifamily housing — PTAC, PTHP, ductless mini-split (cooling-only or
 * heat pump), window AC, cold-climate heat pump. Each apartment is assumed
 * to share the same equipment spec; for mixed-equipment buildings the user
 * runs the calculator twice and adds the rollups.
 *
 * References:
 *   - ASHRAE 90.1-2022 §6.4 (Minimum Equipment Efficiency)
 *   - AHRI 210/240 (Performance Rating of Unitary AC and HP Equipment)
 *   - AHRI 310/380 (Standard for Packaged Terminal AC and Heat Pumps)
 *   - ENERGY STAR Central AC and HP Specification v6.1 (2023)
 *   - DOE Federal Minimum Efficiencies for HVAC equipment (2023+)
 *   - NEEP Cold Climate ASHP Specification + Product List
 *   - DOE Building America MF HVAC reference designs (EFLH benchmarks)
 *   - ASHRAE 90.1-2022 Appendix G3.1.3.10 (Equivalent Full-Load Hours)
 *   - EPA eGRID 2022 subregion emission factors
 */
import type { ClimateZoneKey, GridSubregion } from "@/lib/engineering/constants";

/** The six in-unit HVAC archetypes the calculator models. Each combines a
 *  cooling-side technology with a heating-side technology — heat pumps cover
 *  both, while resistance heat is paired with a separate cooling unit (PTAC,
 *  mini-split, or window AC). */
export type InUnitHvacSystemType =
  | "ptac_resistance"        // PTAC chassis — cooling + electric resistance heat
  | "pthp"                   // Packaged Terminal Heat Pump — cooling + HP heating
  | "minisplit_hp"           // Ductless mini-split heat pump (ENERGY STAR baseline)
  | "minisplit_cool_resist"  // Ductless mini-split cooling + electric baseboards
  | "window_ac_resist"       // Window-unit AC + electric baseboards (legacy MF)
  | "ccshp"                  // Cold-climate ductless mini-split (NEEP CCHP listed)
  | "central_split_hp"       // Ducted central split heat pump (outdoor condenser + indoor AHU + ducts)
  | "central_split_ac_resist"; // Ducted central split AC + electric resistance heat strip in AHU

/** Cooling-side rating metric. SEER2 (current AHRI 210/240 standard since
 *  2023) for residential central + mini-split equipment; EER (steady-state)
 *  for through-wall PTAC/PTHP and window units rated under AHRI 310/380. */
export type CoolingEffMetric = "SEER2" | "EER";

/** Heating-side rating metric. HSPF2 (current AHRI 210/240) for mini-split
 *  heat pumps; COP for steady-state-rated heat pumps (PTHPs rated under
 *  AHRI 310/380); "resistance" denotes electric baseboard / strip with COP
 *  fixed at 1.0 by physics. */
export type HeatingEffMetric = "HSPF2" | "COP" | "resistance";

export interface InUnitHvacInputs {
  /** Number of apartments served by these equipment specs. The whole-building
   *  rollup is per-apartment × this count. */
  apartmentCount: number;
  /** Climate zone for EFLH lookup. Same enum as DHW so users get the same
   *  set everywhere. */
  climateZone: ClimateZoneKey;
  /** Selected system archetype. Drives default field values + which
   *  efficiency metric is appropriate for cooling/heating sides. */
  systemType: InUnitHvacSystemType;

  // ─── Per-apartment cooling equipment ───────────────────────────────────
  /** Per-apartment cooling capacity at design conditions (BTU/h). Typical
   *  multifamily apartment loads: 6,000 BTU/h (studio < 400 sf), 9,000 BTU/h
   *  (1BR), 12,000 BTU/h (2BR), 18,000–24,000 BTU/h (3BR or large open plan).
   *  Use Manual J or rated equipment nameplate. */
  coolingCapacityBtuh: number;
  /** Cooling efficiency value. Interpretation depends on `coolingEfficiencyMetric`:
   *   - SEER2: BTU/Wh seasonal — typical 14–22 for current mini-splits
   *   - EER:   BTU/Wh steady-state — typical 9.0–12.5 for PTAC / window AC */
  coolingEfficiency: number;
  coolingEfficiencyMetric: CoolingEffMetric;

  // ─── Per-apartment heating equipment ───────────────────────────────────
  /** Per-apartment heating capacity at design conditions (BTU/h). For heat
   *  pumps this is the nameplate AHRI 47°F output; cold-climate units retain
   *  ~75–90% of capacity at 5°F. For resistance baseboards it's the kW × 3412
   *  thermal output. Typical MF apartment: 9,000–18,000 BTU/h. */
  heatingCapacityBtuh: number;
  /** Heating efficiency value. Interpretation depends on `heatingEfficiencyMetric`:
   *   - HSPF2: BTU/Wh seasonal — typical 7.5–11.5 for current mini-splits
   *   - COP:   dimensionless output/input — typical 2.7–4.0 for HPs
   *   - resistance: ignored (always treated as 1.0 internally) */
  heatingEfficiency: number;
  heatingEfficiencyMetric: HeatingEffMetric;

  // ─── EFLH overrides ─────────────────────────────────────────────────────
  /** Optional override for cooling Equivalent Full-Load Hours. 0 (default)
   *  means use the climate-zone lookup. Useful when a user has metered or
   *  simulated EFLH that better reflects their building's specifics. */
  coolingEflhOverride: number;
  /** Optional override for heating EFLH. Same convention. */
  heatingEflhOverride: number;

  // ─── Economics ──────────────────────────────────────────────────────────
  /** Site electricity rate ($/kWh). Drives the annual cost calc. In-unit
   *  HVAC is typically tenant-billed; the user's own electric rate captures
   *  the resident-paid energy cost at the meter. */
  elecRate: number;
  /** EPA eGRID subregion for emission factor lookup. */
  gridSubregion: GridSubregion;
  /** Custom emission factor (lb CO₂e/kWh) used when `gridSubregion === "Custom"`. */
  customEF: number;
}

/** Per-system-type metadata: human label, default capacities + efficiency
 *  values + metrics, and a brief description for the UI. Used to populate
 *  defaults when the user switches `systemType`, and as the canonical
 *  reference for what's "code-minimum" for that archetype. */
export interface InUnitHvacSystemSpec {
  label: string;
  /** Cooling defaults */
  coolingMetric: CoolingEffMetric;
  coolingEff: number;
  coolingBtuh: number;
  /** Heating defaults */
  heatingMetric: HeatingEffMetric;
  heatingEff: number;
  heatingBtuh: number;
  /** Short marketing-style description shown next to the system selector. */
  description: string;
  /** Engineering source / minimum compliance reference. */
  reference: string;
}

export const INUNIT_HVAC_SYSTEM_SPECS: Record<InUnitHvacSystemType, InUnitHvacSystemSpec> = {
  ptac_resistance: {
    label: "PTAC + electric resistance heat",
    coolingMetric: "EER",
    coolingEff: 9.5,
    coolingBtuh: 9000,
    heatingMetric: "resistance",
    heatingEff: 1.0,
    heatingBtuh: 12000,
    description:
      "Through-wall packaged terminal AC unit (cooling-only) paired with electric resistance strip heat in the same chassis. Default in 1980s–2010s mid-rise MF. Cheap to install, expensive to operate in cold climates.",
    reference: "ASHRAE 90.1-2022 §6.4.1.4 PTAC minimum EER 9.5; AHRI 310/380 rating",
  },
  pthp: {
    label: "PTHP (packaged terminal heat pump)",
    coolingMetric: "EER",
    coolingEff: 11.0,
    coolingBtuh: 9000,
    heatingMetric: "COP",
    heatingEff: 3.0,
    heatingBtuh: 9000,
    description:
      "Same form factor as PTAC but reverses the refrigeration cycle to heat in winter. ~2–3× cheaper to operate than resistance below the balance point (typically ~35°F). Strip backup engages in very cold ambients.",
    reference: "ASHRAE 90.1-2022 §6.4.1.4 PTHP minimum COP 3.0; AHRI 310/380 rating",
  },
  minisplit_hp: {
    label: "Ductless mini-split heat pump",
    coolingMetric: "SEER2",
    coolingEff: 16.0,
    coolingBtuh: 9000,
    heatingMetric: "HSPF2",
    heatingEff: 8.5,
    heatingBtuh: 12000,
    description:
      "Wall-mounted ductless heat pump — single zone, inverter-driven compressor. Current ENERGY STAR baseline. Suitable for most MF retrofits in climate zones 1A–5B.",
    reference: "ENERGY STAR Central AC/HP v6.1 minimum SEER2 16.0 / HSPF2 8.5",
  },
  minisplit_cool_resist: {
    label: "Mini-split cooling + electric baseboard heat",
    coolingMetric: "SEER2",
    coolingEff: 14.0,
    coolingBtuh: 9000,
    heatingMetric: "resistance",
    heatingEff: 1.0,
    heatingBtuh: 12000,
    description:
      "Ductless cooling-only mini-split paired with electric resistance baseboards. Common in apartments where the existing baseboards stay and AC is added later. Heating is expensive — same operating cost as straight resistance.",
    reference: "DOE Federal Minimum SEER2 14.0 (2023); resistance COP fixed at 1.0",
  },
  window_ac_resist: {
    label: "Window AC + electric resistance heat",
    coolingMetric: "EER",
    coolingEff: 10.5,
    coolingBtuh: 8000,
    heatingMetric: "resistance",
    heatingEff: 1.0,
    heatingBtuh: 12000,
    description:
      "Window-mounted room AC paired with electric baseboards or wall-mounted resistance heaters. Pre-2000s urban multifamily default. High operating cost, poor envelope (window seal leaks).",
    reference: "ENERGY STAR Room AC minimum CEER 10.5; resistance COP 1.0",
  },
  ccshp: {
    label: "Cold-climate ductless heat pump",
    coolingMetric: "SEER2",
    coolingEff: 18.0,
    coolingBtuh: 9000,
    heatingMetric: "HSPF2",
    heatingEff: 10.5,
    heatingBtuh: 12000,
    description:
      "Premium NEEP-listed cold-climate heat pump. Maintains ≥ 70% rated capacity at 5°F (vs ~50% for standard HP). Required for full electrification in climate zones 5A+ without significant resistance backup.",
    reference: "NEEP Cold Climate ASHP Specification — HSPF2 ≥ 10.0 + capacity retention at 5°F",
  },
  central_split_hp: {
    label: "Ducted central split heat pump",
    coolingMetric: "SEER2",
    coolingEff: 16.0,
    coolingBtuh: 18000,
    heatingMetric: "HSPF2",
    heatingEff: 8.5,
    heatingBtuh: 18000,
    description:
      "Outdoor condensing unit (roof or balcony) refrigerant-piped to an indoor air handler in an apartment closet, attic, or mechanical chase, distributing conditioned air through apartment ductwork from a single thermostat. Common in townhouse-style MF, garden apartments, and newer mid-rise built since ~2015. Same AHRI 210/240 rating standard as ductless mini-splits — SEER2/HSPF2 ratings already include ~5% typical duct distribution loss.",
    reference: "ENERGY STAR Central AC/HP v6.1 minimum SEER2 16.0 / HSPF2 8.5; AHRI 210/240 rating",
  },
  central_split_ac_resist: {
    label: "Ducted central split AC + electric resistance heat",
    coolingMetric: "SEER2",
    coolingEff: 14.0,
    coolingBtuh: 18000,
    heatingMetric: "resistance",
    heatingEff: 1.0,
    heatingBtuh: 18000,
    description:
      "Outdoor condensing unit + indoor air handler with cooling coil + electric resistance heat strip in the AHU + apartment ductwork. Heating runs on pure electric resistance (COP 1.0); cooling cycle is identical to a ducted central HP. Common in pre-2010s townhouse and garden-style MF in moderate climates — the heat-pump variant has displaced this for new construction. Strong retrofit target: same outdoor unit footprint, dramatic heating savings.",
    reference: "DOE Federal Minimum SEER2 14.0 (2023); AHRI 210/240 cooling rating; resistance COP fixed at 1.0",
  },
};

/** Tier-keyed defaults that match a "typical" 60-unit mid-rise MF building
 *  in CZ4A (NYC) running PTAC+resistance — the most common pre-retrofit
 *  baseline in U.S. multifamily housing built 1970–2010. */
export const DEFAULT_INPUTS: InUnitHvacInputs = {
  apartmentCount: 60,
  climateZone: "4A - NYC",
  systemType: "ptac_resistance",
  coolingCapacityBtuh: 9000,
  coolingEfficiency: 9.5,
  coolingEfficiencyMetric: "EER",
  heatingCapacityBtuh: 12000,
  heatingEfficiency: 1.0,
  heatingEfficiencyMetric: "resistance",
  coolingEflhOverride: 0,
  heatingEflhOverride: 0,
  elecRate: 0.18, // ConEd-ish baseline
  gridSubregion: "RFCE (Mid-Atl)",
  customEF: 0.7,
};

/** Heat-pump retrofit preset — replaces PTAC+resistance with an ENERGY STAR
 *  ductless mini-split heat pump. Surfaced as the "Apply heat-pump retrofit"
 *  one-click on the Retrofit Comparison tab. */
export const DEFAULT_HP_RETROFIT: InUnitHvacInputs = {
  ...DEFAULT_INPUTS,
  systemType: "minisplit_hp",
  coolingCapacityBtuh: 9000,
  coolingEfficiency: 16.0,
  coolingEfficiencyMetric: "SEER2",
  heatingCapacityBtuh: 12000,
  heatingEfficiency: 8.5,
  heatingEfficiencyMetric: "HSPF2",
};

/** Cold-climate retrofit preset — for buildings in CZ5A+ where the standard
 *  mini-split's heating capacity drops too aggressively in winter. */
export const DEFAULT_CCHP_RETROFIT: InUnitHvacInputs = {
  ...DEFAULT_INPUTS,
  systemType: "ccshp",
  coolingCapacityBtuh: 9000,
  coolingEfficiency: 18.0,
  coolingEfficiencyMetric: "SEER2",
  heatingCapacityBtuh: 12000,
  heatingEfficiency: 10.5,
  heatingEfficiencyMetric: "HSPF2",
};

/** High-efficiency ducted central heat pump retrofit preset. Use when the
 *  current install is already a ducted central split (HP or AC+strip) and
 *  the user wants to compare against a same-format upgrade — preserves the
 *  duct system and outdoor-unit pad while bumping efficiency to ENERGY STAR
 *  Premium tier (SEER2 18 / HSPF2 10). */
export const DEFAULT_CENTRAL_HP_RETROFIT: InUnitHvacInputs = {
  ...DEFAULT_INPUTS,
  systemType: "central_split_hp",
  coolingCapacityBtuh: 18000,
  coolingEfficiency: 18.0,
  coolingEfficiencyMetric: "SEER2",
  heatingCapacityBtuh: 18000,
  heatingEfficiency: 10.0,
  heatingEfficiencyMetric: "HSPF2",
};
