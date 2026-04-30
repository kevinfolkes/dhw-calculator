/**
 * Engineering constants for multifamily DHW sizing.
 *
 * References (all constants traceable to published standards):
 *   - ASHRAE HVAC Applications Handbook, Ch. 51 (Service Water Heating)
 *   - ASHRAE 90.1-2022 (Energy Standard)
 *   - ASHRAE 188-2021 (Legionellosis Risk Management)
 *   - ASPE Data Book Vol. 2, Ch. 5 (Cold & Hot Water Supply) — Modified Hunter
 *   - 2021 IPC / 2021 UPC (Water Supply Fixture Units)
 *   - EPA eGRID 2022 subregion emission factors
 *   - NOAA 30-year climate normals (HDD65, avg annual temps)
 *   - DOE UEF test procedure (AHRI 1300 / 1700 directories)
 *   - ACCA Manual J abbreviated method
 */

// ---------------------------------------------------------------------------
// ASHRAE Ch. 51 Table 7 — Hot Water Demand for Apartments (GPH per apartment)
// Values at 140°F storage; "max hour" = peak hour demand.
// ---------------------------------------------------------------------------
export type OccupancyProfile = "low" | "medium" | "high";

export interface ApartmentDemand {
  /** Max-hour demand GPH per apartment */
  mh: number;
  /** Max-day demand GPH per apartment */
  md: number;
  /** Avg-day demand GPH per apartment */
  avg: number;
  /** ASHRAE storage coefficient (× peak hour demand) */
  storageFrac: number;
  /** ASHRAE recovery coefficient (× peak hour demand) */
  recoveryFrac: number;
  label: string;
}

export const ASHRAE_APT_DEMAND: Record<OccupancyProfile, ApartmentDemand> = {
  low: { mh: 10.8, md: 42.8, avg: 34.6, storageFrac: 1.25, recoveryFrac: 0.30, label: "Low use (elderly/efficiency)" },
  medium: { mh: 12.0, md: 49.2, avg: 39.6, storageFrac: 1.25, recoveryFrac: 0.30, label: "Medium use (typical market-rate)" },
  high: { mh: 13.1, md: 55.6, avg: 44.6, storageFrac: 1.25, recoveryFrac: 0.30, label: "High use (family/luxury)" },
};

// ---------------------------------------------------------------------------
// Water Supply Fixture Units — IPC Table 604.3 (hot-water column)
// ---------------------------------------------------------------------------
export const WSFU = {
  lavatory: 0.75,
  kitchen: 1.0,
  shower: 1.5,
  tub: 1.5,
  dishwasher: 1.0,
  washer: 1.5,
} as const;

// ---------------------------------------------------------------------------
// EPA eGRID 2022 subregion emission factors (lb CO2e / kWh, rounded)
// ---------------------------------------------------------------------------
export type GridSubregion =
  | "CAMX (CA)"
  | "NWPP (PNW)"
  | "RMPA (Rockies)"
  | "ERCT (TX)"
  | "MROW (Upper MW)"
  | "RFCE (Mid-Atl)"
  | "NYUP (Upstate NY)"
  | "NEWE (New England)"
  | "SRSO (Southeast)"
  | "FRCC (FL)"
  | "Custom";

export const GRID_EF: Record<GridSubregion, number> = {
  "CAMX (CA)": 0.48,
  "NWPP (PNW)": 0.62,
  "RMPA (Rockies)": 1.1,
  "ERCT (TX)": 0.83,
  "MROW (Upper MW)": 1.04,
  "RFCE (Mid-Atl)": 0.65,
  "NYUP (Upstate NY)": 0.24,
  "NEWE (New England)": 0.52,
  "SRSO (Southeast)": 0.82,
  "FRCC (FL)": 0.83,
  Custom: 0.70,
};

/** Natural gas emission factor — EPA, lb CO2 / therm */
export const NG_LB_CO2_PER_THERM = 11.7;

// ---------------------------------------------------------------------------
// ASHRAE Fundamentals Ch. 14 climate design temps + NOAA HDD65 normals
// Mech rooms are modeled conservatively (typical enclosed basement/utility).
// ---------------------------------------------------------------------------
export interface ClimateDesign {
  /** 99.6% heating dry-bulb design temp (°F) */
  heatDB: number;
  /** Annual average outdoor temp (°F) */
  avgAnnual: number;
  /** Annual average mech-room ambient (°F) — conservative for HPWH intake */
  mechRoomAnnual: number;
  /** NOAA 30-yr normal HDD65 */
  hdd65: number;
}

export const CLIMATE_DESIGN: Record<string, ClimateDesign> = {
  "1A - Miami": { heatDB: 50, avgAnnual: 77, mechRoomAnnual: 72, hdd65: 141 },
  "2A - Houston": { heatDB: 30, avgAnnual: 68, mechRoomAnnual: 65, hdd65: 1525 },
  "2B - Phoenix": { heatDB: 36, avgAnnual: 72, mechRoomAnnual: 70, hdd65: 1125 },
  "3A - Atlanta": { heatDB: 22, avgAnnual: 61, mechRoomAnnual: 60, hdd65: 2827 },
  "3B - LA": { heatDB: 43, avgAnnual: 64, mechRoomAnnual: 64, hdd65: 1284 },
  "3C - SF": { heatDB: 38, avgAnnual: 57, mechRoomAnnual: 60, hdd65: 2608 },
  "4A - NYC": { heatDB: 14, avgAnnual: 55, mechRoomAnnual: 58, hdd65: 4754 },
  "4C - Seattle": { heatDB: 27, avgAnnual: 52, mechRoomAnnual: 55, hdd65: 4424 },
  "5A - Chicago": { heatDB: -2, avgAnnual: 50, mechRoomAnnual: 55, hdd65: 6311 },
  "5B - Denver": { heatDB: 3, avgAnnual: 51, mechRoomAnnual: 55, hdd65: 5947 },
  "6A - Minneapolis": { heatDB: -12, avgAnnual: 46, mechRoomAnnual: 52, hdd65: 7708 },
  "7 - Duluth": { heatDB: -20, avgAnnual: 40, mechRoomAnnual: 50, hdd65: 9391 },
};

export type ClimateZoneKey = keyof typeof CLIMATE_DESIGN;

// ---------------------------------------------------------------------------
// Monthly HDD distribution by archetype (NOAA 30-yr normals, aggregated)
// ---------------------------------------------------------------------------
export type HDDArchetype = "hot" | "mixed" | "cold" | "very_cold";

export const MONTHLY_HDD_FRAC: Record<HDDArchetype, number[]> = {
  hot:       [0.25, 0.20, 0.13, 0.05, 0.01, 0.00, 0.00, 0.00, 0.00, 0.04, 0.12, 0.20],
  mixed:     [0.19, 0.16, 0.12, 0.06, 0.02, 0.00, 0.00, 0.00, 0.01, 0.06, 0.12, 0.18],
  cold:      [0.17, 0.14, 0.11, 0.07, 0.03, 0.01, 0.00, 0.01, 0.03, 0.08, 0.13, 0.16],
  very_cold: [0.15, 0.13, 0.11, 0.08, 0.04, 0.02, 0.01, 0.02, 0.05, 0.09, 0.13, 0.15],
};

/** Annual air-temp amplitude (°F) around annual mean, by archetype */
export const MONTHLY_AMBIENT_AMPLITUDE_F: Record<HDDArchetype, number> = {
  hot: 12,
  mixed: 18,
  cold: 22,
  very_cold: 26,
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

// ---------------------------------------------------------------------------
// Envelope presets (ACCA Manual J abbreviated — UA/sqft/°F)
// ---------------------------------------------------------------------------
export type EnvelopeKey = "code2021" | "efficient" | "passive" | "retrofit";

export interface EnvelopePreset {
  factor: number;
  label: string;
}

export const ENVELOPE_PRESETS: Record<EnvelopeKey, EnvelopePreset> = {
  code2021: { factor: 0.035, label: "Code-minimum (2021 IECC)" },
  efficient: { factor: 0.025, label: "Above code / ENERGY STAR" },
  passive: { factor: 0.012, label: "Passive House / PHIUS" },
  retrofit: { factor: 0.055, label: "Older existing (pre-2000)" },
};

// ---------------------------------------------------------------------------
// In-unit HPWH first-hour rating (AHRI 1300 / ENERGY STAR)
// ---------------------------------------------------------------------------
export type HPWHTankSize = 50 | 66 | 80 | 120;

export interface HPWHTankSpec {
  /** First-hour rating, GPH */
  fhr: number;
  /** Uniform Energy Factor (DOE) */
  uef: number;
  /** Compressor input, kW */
  input_kw: number;
  /** Resistance backup, kW */
  resistance_kw: number;
}

export const HPWH_TANK_FHR: Record<HPWHTankSize, HPWHTankSpec> = {
  50: { fhr: 63, uef: 3.45, input_kw: 0.5, resistance_kw: 4.5 },
  66: { fhr: 72, uef: 3.75, input_kw: 0.5, resistance_kw: 4.5 },
  80: { fhr: 84, uef: 3.88, input_kw: 0.5, resistance_kw: 4.5 },
  120: { fhr: 120, uef: 3.45, input_kw: 1.0, resistance_kw: 6.0 },
};

// ---------------------------------------------------------------------------
// HPWH efficiency tiers (applies to central + in-unit + combi HPWH systems).
// The tier is a COP quality multiplier — it represents compressor type,
// heat-exchanger quality, and refrigerant choice. Applied at runtime to the
// climate-based hpwhCOP() output so the monthly COP, annual COP, and FHR
// checks all scale consistently. Default is ENERGY STAR (multiplier 1.00)
// which matches the values in HPWH_TANK_FHR, so existing inputs don't shift.
//
// References:
//   - ENERGY STAR Residential Water Heaters Specification v4.0 (2023)
//   - CEE Tier 3 Advanced HPWH specification
//   - AHRI 1300 certified performance ratings (representative ranges)
//   - NEEA Advanced Water Heating Specification (AWHS)
// ---------------------------------------------------------------------------
export type HPWHTier = "standard" | "energy_star" | "high_efficiency";

export interface HPWHTierSpec {
  /** Multiplier on the climate-derived COP from hpwhCOP() */
  copMultiplier: number;
  label: string;
  /** Short description for hint text */
  description: string;
  /** Representative UEF range for a typical 50–80 gal unit at this tier */
  uefRange: string;
}

export const HPWH_TIER_ADJUSTMENT: Record<HPWHTier, HPWHTierSpec> = {
  standard: {
    copMultiplier: 0.80,
    label: "Standard",
    description:
      "Older / budget single-speed HPWHs (e.g. Rheem Performance, Bradford W RE350S). HFC refrigerant, basic integration.",
    uefRange: "UEF 2.5–2.9",
  },
  energy_star: {
    copMultiplier: 1.00,
    label: "ENERGY STAR",
    description:
      "Current market baseline (e.g. AO Smith Voltex, Rheem ProTerra gen 2). Meets ENERGY STAR Residential WH v4.0 minimum.",
    uefRange: "UEF 3.3–3.9",
  },
  high_efficiency: {
    copMultiplier: 1.15,
    label: "High-efficiency",
    description:
      "Premium inverter-driven / advanced refrigerant (e.g. Rheem ProTerra Plus, Sanden CO2, Bradford AeroTherm Pro). Better part-load and cold-ambient performance.",
    uefRange: "UEF 3.9–4.3+",
  },
};

// ---------------------------------------------------------------------------
// Central boiler type (applies to central_gas, central_indirect, and the gas
// backup leg of central_hybrid). Picks the typical efficiency tier so the
// `gasEfficiency` field can show the right default-for-type alongside any
// manual override the user enters.
//
// Reference values:
//   - Condensing:     η ~0.92–0.97 (ASHRAE 90.1-2022 Table 7.8 minimum 0.90 thermal eff)
//   - Non-condensing: η ~0.78–0.84 (atmospheric / power-vent older equipment)
// ---------------------------------------------------------------------------
export type CentralBoilerType = "condensing" | "non_condensing";

export const CENTRAL_BOILER_DEFAULT_EFFICIENCY: Record<CentralBoilerType, number> = {
  condensing: 0.95,
  non_condensing: 0.78,
};

export const CENTRAL_BOILER_LABEL: Record<CentralBoilerType, string> = {
  condensing: "Condensing",
  non_condensing: "Non-condensing",
};

// Cost multiplier applied to the central boiler base cost when the boiler is
// non-condensing. Non-condensing boilers are simpler (no condensate handling,
// less stringent venting, less expensive heat exchangers) and run ~25–30%
// cheaper for the same input rating.
export const CENTRAL_BOILER_COST_FACTOR: Record<CentralBoilerType, number> = {
  condensing: 1.0,
  non_condensing: 0.72,
};

// ---------------------------------------------------------------------------
// Multi-boiler cascade modeling. Real central plants typically install 2–6
// modulating-condensing boilers in a primary/secondary loop with cascade
// staging controls. This captures three real-world effects the single-boiler
// model misses:
//
//  1. Manifold / cascade-controller premium on capex (~5% per added boiler).
//     Source: RSMeans 23 81 16, ASHRAE Apps Ch. 51 Table 9 commentary.
//  2. Part-load seasonal efficiency uplift from staging — at light loads
//     fewer boilers fire, each at a higher individual modulation point where
//     condensing efficiency peaks. Bonus +1% per added boiler up to a +3%
//     cap (diminishing returns past ~4 boilers).
//     Source: Lochinvar Knight Cascade application data; AERCO Innovation
//     cascade-staging seasonal-efficiency studies.
//  3. N+1 redundancy: when chosen, total installed MBH is grossed up so any
//     (N-1) boilers cover the design load — costs scale with the actual
//     installed capacity, not just the active duty.
// ---------------------------------------------------------------------------
export type CascadeRedundancy = "N" | "N+1";

/** Per-additional-boiler installed-cost premium (manifolds, controls, etc.) */
export const CASCADE_COST_PREMIUM_PER_BOILER = 0.05;

/** Per-additional-boiler seasonal-efficiency uplift (additive to gas η). */
export const CASCADE_EFFICIENCY_BONUS_PER_BOILER = 0.01;

/** Maximum cascade efficiency bonus (~3% — beyond ~4 boilers gains plateau). */
export const CASCADE_EFFICIENCY_BONUS_CAP = 0.03;

/** Returns the seasonal-efficiency bonus (0–0.03) for a given boiler count. */
export function cascadeEfficiencyBonus(boilerCount: number): number {
  const n = Math.max(1, Math.floor(boilerCount));
  return Math.min(CASCADE_EFFICIENCY_BONUS_CAP, CASCADE_EFFICIENCY_BONUS_PER_BOILER * (n - 1));
}

/** Returns the installed-cost premium multiplier (1.00–~1.35). */
export function cascadeCostPremium(boilerCount: number): number {
  const n = Math.max(1, Math.floor(boilerCount));
  return 1 + CASCADE_COST_PREMIUM_PER_BOILER * (n - 1);
}

/** Total installed MBH when applying N+1 redundancy. Returns the active duty
 *  unchanged for "N" mode. For "N+1" mode, total = activeDuty × N/(N-1) so
 *  any (N-1) boilers can cover the active load. */
export function totalInstalledMBHWithRedundancy(
  activeDutyMBH: number,
  boilerCount: number,
  redundancy: CascadeRedundancy,
): number {
  const n = Math.max(1, Math.floor(boilerCount));
  if (redundancy === "N" || n < 2) return activeDutyMBH;
  return activeDutyMBH * (n / (n - 1));
}

// ---------------------------------------------------------------------------
// In-unit gas tank WH (ENERGY STAR, AHRI Directory, DOE UEF)
// ---------------------------------------------------------------------------
export type GasTankSize = 40 | 50 | 75 | 100;
export type GasTankType = "atmospheric" | "condensing";

export interface GasTankSpec {
  input_mbh: number;
  fhr_atmospheric: number;
  fhr_condensing: number;
  uef_atmos: number;
  uef_cond: number;
}

export const GAS_TANK_WH: Record<GasTankSize, GasTankSpec> = {
  40: { input_mbh: 40, fhr_atmospheric: 67, fhr_condensing: 75, uef_atmos: 0.64, uef_cond: 0.80 },
  50: { input_mbh: 40, fhr_atmospheric: 75, fhr_condensing: 84, uef_atmos: 0.64, uef_cond: 0.82 },
  75: { input_mbh: 76, fhr_atmospheric: 129, fhr_condensing: 142, uef_atmos: 0.64, uef_cond: 0.88 },
  100: { input_mbh: 100, fhr_atmospheric: 175, fhr_condensing: 189, uef_atmos: 0.64, uef_cond: 0.90 },
};

// ---------------------------------------------------------------------------
// In-unit gas tankless WH (manufacturer data, AHRI 1700)
// ---------------------------------------------------------------------------
export type GasTanklessInput = 150 | 180 | 199;

export interface GasTanklessSpec {
  input_mbh: number;
  uef: number;
  peakGPM_35F: number;
  peakGPM_70F: number;
  modulation: string;
  venting: string;
}

export const GAS_TANKLESS_WH: Record<GasTanklessInput, GasTanklessSpec> = {
  150: { input_mbh: 150, uef: 0.82, peakGPM_35F: 4.5, peakGPM_70F: 2.3, modulation: "4:1", venting: "PVC/PP Cat IV" },
  180: { input_mbh: 180, uef: 0.93, peakGPM_35F: 5.5, peakGPM_70F: 2.8, modulation: "7:1", venting: "PVC/PP Cat IV" },
  199: { input_mbh: 199, uef: 0.96, peakGPM_35F: 6.5, peakGPM_70F: 3.3, modulation: "10:1", venting: "PVC/PP Cat IV" },
};

// ---------------------------------------------------------------------------
// Central equipment discrete sizes (for auto-sizing step-up logic)
// ---------------------------------------------------------------------------
export const CENTRAL_TANK_SIZES = [80, 100, 119, 175, 250, 400, 600, 800, 1000, 1500, 2000] as const;
export const CENTRAL_GAS_INPUT_MBH = [100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000] as const;
export const CENTRAL_GAS_TANKLESS_INPUT_MBH = [200, 400, 600, 1000, 1500, 2000, 3000, 4000] as const;
export type CentralGasTanklessInput = (typeof CENTRAL_GAS_TANKLESS_INPUT_MBH)[number];
export const CENTRAL_ELEC_KW = [12, 18, 27, 36, 54, 72, 108, 144, 180, 216, 288] as const;
export const CENTRAL_HPWH_KW = [15, 20, 30, 40, 60, 80, 120, 160, 200, 300] as const;

/**
 * Saturation temperature of steam at 5 PSIG (≈19.7 PSIA), used to flag
 * infeasible storage setpoints on `central_steam_hx`. The HX cannot heat
 * potable above (steam_sat_temp − ~20°F approach), so a 140°F setpoint with
 * 5 PSIG steam (~227°F sat) is comfortable, but a higher setpoint or a
 * lower supply pressure can violate the approach.
 */
export const STEAM_SATURATION_TEMP_F_AT_5PSIG = 227;

// ---------------------------------------------------------------------------
// In-unit gas combi tankless buffer tank SKU set. Used by
// `inunit_combi_gas_tankless` to prevent burner short-cycling on low
// partial-load heating calls. Sized off `min_fire_BTUH` (≈10% of max input
// for a modern condensing tankless) at a 15°F hydronic buffer swing, with a
// 5-minute minimum runtime target.
// ---------------------------------------------------------------------------
export const INUNIT_GAS_BUFFER_TANK_SIZES = [20, 40, 50, 80] as const;
export type InunitGasBufferTankSize = (typeof INUNIT_GAS_BUFFER_TANK_SIZES)[number];

// ---------------------------------------------------------------------------
// In-unit electric resistance tank water heater SKUs. Element kW is the
// hard ceiling on per-unit heating capacity for the combi-resistance variant.
// FHR / UEF values are AHRI 1300 representative ratings for current-spec
// electric resistance tanks.
// ---------------------------------------------------------------------------
export type InunitResistanceTankSize = 30 | 40 | 50 | 66 | 80;

export interface InunitResistanceTankSpec {
  /** First-hour rating, GPH */
  fhr: number;
  /** Uniform Energy Factor (DOE) */
  uef: number;
  /** Element input rating (kW) */
  kw: number;
}

export const INUNIT_RESISTANCE_TANK_SPEC: Record<InunitResistanceTankSize, InunitResistanceTankSpec> = {
  30: { fhr: 25, uef: 0.93, kw: 4.5 },
  40: { fhr: 32, uef: 0.92, kw: 4.5 },
  50: { fhr: 41, uef: 0.92, kw: 4.5 },
  66: { fhr: 53, uef: 0.91, kw: 5.5 },
  80: { fhr: 64, uef: 0.91, kw: 5.5 },
};

// ---------------------------------------------------------------------------
// Preheat modifier constants — Phase D
//
// Solar thermal:
//   Reference ASHRAE Handbook Applications Ch. 36 (Solar Energy Use); ASHRAE
//   93 (collector test method). Monthly insolation values (BTU/day/ft²) are
//   approximate averages of NREL TMY3 normals across each climate-archetype
//   band — intentionally coarse to avoid encoding latitude as a separate
//   input. eta_collector defaults to 0.55 (typical flat-plate annual avg).
//
// DWHR (drainwater heat recovery):
//   Reference CSA B55.1 / B55.2; NREL DWHR field studies (Schoenbauer 2012,
//   2017). Vertical units run 0.40–0.60 effectiveness; we default to 0.50.
//   Drain temp settles to ~95°F after shower mixing — well-documented value
//   used as the warm-side reference temp for the heat-exchange driving ΔT.
// ---------------------------------------------------------------------------

/**
 * Average daily clear-sky solar insolation (BTU/day per ft² of collector
 * aperture), by climate archetype and month index (0 = Jan). Derived from
 * NREL TMY3 normals aggregated across each archetype's representative cities.
 * Used by the solar-preheat model to estimate monthly solar fraction without
 * requiring full latitude / tilt / azimuth inputs.
 */
export const SOLAR_INSOLATION_BTU_PER_SQFT_PER_DAY: Record<HDDArchetype, number[]> = {
  hot:       [1100, 1300, 1600, 1850, 2000, 2050, 2000, 1900, 1700, 1450, 1200, 1050],
  mixed:     [800,  1050, 1400, 1700, 1900, 1950, 1900, 1750, 1500, 1200, 850,  700],
  cold:      [550,  850,  1200, 1500, 1700, 1800, 1750, 1550, 1250, 950,  600,  450],
  very_cold: [400,  650,  1000, 1350, 1600, 1700, 1650, 1400, 1100, 800,  450,  300],
};

/**
 * Annual-average flat-plate solar collector efficiency (dimensionless). Real
 * collectors test 0.40–0.65 depending on tilt, irradiance, and inlet temp.
 * 0.55 is a representative annual mean for typical multifamily applications.
 */
export const SOLAR_COLLECTOR_DEFAULT_ETA = 0.55;

/**
 * Default DWHR (drainwater heat recovery) effectiveness — fraction of the
 * available drain-side temperature lift transferred to the incoming cold
 * supply. Vertical falling-film units typically report 0.40–0.60 per CSA
 * B55.2; 0.50 is a conservative typical.
 */
export const DWHR_DEFAULT_EFFECTIVENESS = 0.50;

/**
 * Reference drain temperature (°F) after fixture mixing. Used as the warm
 * side of the DWHR ΔT. ~95°F reflects measured post-shower drain temps in
 * NREL studies (slightly cooled from the 105°F nominal shower temp by
 * splash and air contact in the trap stack).
 */
export const DWHR_DRAIN_TEMP_F = 95;

// ---------------------------------------------------------------------------
// Recirculation control modes — Phase E
//
// Modulates the recirc-loop pumping schedule, which scales the standby loss
// the loop produces. Only applies to systems with `hasRecirc: true` (all
// central systems). Default `"continuous"` preserves baseline behavior.
//
// References:
//   - ASHRAE 90.1-2022 §6.5.5 (recirc control requirements)
//   - ACEEE Multifamily Hot Water Distribution Studies
//   - SoCalGas / Taco / Watts demand-control pilot data
// ---------------------------------------------------------------------------
export type RecircControlMode = "continuous" | "time_clock" | "demand" | "aquastat";

/**
 * Multiplier applied to the raw recirc standby loss based on the selected
 * control mode. Demand-controlled and time-clock pumps drastically reduce
 * loop run time; aquastat-controlled pumps modulate by return temp and
 * recover roughly a third of the savings of full demand control.
 *
 * For `time_clock` the multiplier is recomputed dynamically from
 * `timeClockHoursPerDay` (see `applyRecircControl` in `recirc.ts`); the
 * value here is the spec-default at 16 hr/day.
 */
export const RECIRC_CONTROL_LOSS_MULTIPLIER: Record<RecircControlMode, number> = {
  continuous: 1.0,
  time_clock: 0.50,
  demand: 0.30,
  aquastat: 0.65,
};

export const RECIRC_CONTROL_LABEL: Record<RecircControlMode, string> = {
  continuous: "Continuous (always on)",
  time_clock: "Time-clock (scheduled)",
  demand: "Demand-controlled (flow-triggered)",
  aquastat: "Aquastat (return-temp modulated)",
};
