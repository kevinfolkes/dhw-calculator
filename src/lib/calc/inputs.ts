/**
 * Typed input shape for the DHW calculator. Mirrors the React state surface of
 * the original artifact, but consolidated into a single object so it can be
 * serialized (URL params, localStorage, PDF export) and threaded through a
 * single pure `runCalc()` function.
 */
import type {
  CascadeRedundancy,
  CentralBoilerType,
  CentralGasTanklessInput,
  ClimateZoneKey,
  EnvelopeKey,
  GasTankSize,
  GasTankType,
  GasTanklessInput,
  GridSubregion,
  HPWHTankSize,
  HPWHTier,
  InunitGasBufferTankSize,
  InunitResistanceTankSize,
  OccupancyProfile,
  RecircControlMode,
} from "@/lib/engineering/constants";
import type { Refrigerant } from "@/lib/engineering/hpwh";
import type { SystemTypeKey } from "@/lib/engineering/system-types";

export type DemandMethod = "ashrae" | "hunter" | "occupancy";

/**
 * Preheat modifier (Phase D). Pre-heats incoming cold water before any
 * primary system runs:
 *   - "none": no preheat (default)
 *   - "solar": solar thermal collector array + storage tank
 *   - "dwhr": drainwater heat recovery on showers / fixtures
 *   - "solar+dwhr": both modifiers active simultaneously
 *
 * Preheat applies as a temperature lift on the resolved inlet (either
 * climate-derived or manual override). Affects every system type uniformly
 * via a single integration point in the pipeline.
 */
export type PreheatType = "none" | "solar" | "dwhr" | "solar+dwhr";

export interface UnitCount {
  br0: number;
  br1: number;
  br2: number;
  br3: number;
}

/**
 * Per-fixture average hot-water flow (GPM). Used by the tankless peak-demand
 * calculation and surfaced in the demand tab so users can override defaults
 * with measured or spec'd values. Defaults are typical WaterSense / low-flow
 * values (2021 IPC compliant).
 */
export interface FixtureGPM {
  lavatory: number;
  kitchen: number;
  shower: number;
  tub: number;
  dishwasher: number;
  washer: number;
}

export const DEFAULT_FIXTURE_GPM: FixtureGPM = {
  lavatory: 0.5,   // WaterSense lav faucet max
  kitchen: 1.5,    // typical low-flow kitchen aerator
  shower: 2.0,     // federal max; WaterSense = 1.8
  tub: 4.0,        // tub spout at full flow
  dishwasher: 1.5, // fill rate (hot side)
  washer: 1.5,     // residential clothes washer hot fill
};

export interface DhwInputs {
  systemType: SystemTypeKey;

  // Building
  unitsStudio: number;
  units1BR: number;
  units2BR: number;
  units3BR: number;
  occupancyProfile: OccupancyProfile;
  climateZone: ClimateZoneKey;
  /** null → derive from climate-zone annual mean (Burch & Christensen 2007) */
  inletWaterF: number | null;
  storageSetpointF: number;
  deliveryF: number;

  // Demand
  demandMethod: DemandMethod;
  occupantsPerUnit: UnitCount;
  gpcd: number;

  // Distribution
  recircLoopLengthFt: number;
  pipeInsulationR: number;
  recircReturnTempF: number;
  ambientPipeF: number;

  // Central tech
  /**
   * Boiler type for central_gas, central_indirect, and the gas backup leg of
   * central_hybrid. Drives the default `gasEfficiency` shown next to the
   * manual override and the cost-model multiplier (non-condensing boilers
   * cost ~28% less for the same input MBH). Stays "condensing" for systems
   * where the distinction does not apply (no observable effect).
   */
  centralBoilerType: CentralBoilerType;
  /**
   * Number of boilers in a cascade for `central_gas`, `central_indirect`,
   * and the gas backup leg of `central_hybrid`. 1 = single-boiler plant
   * (default, preserves existing behavior); 2–8 = cascade modulating plant.
   * Cascade plants get a part-load efficiency bonus (+1% per boiler, capped
   * at +3%) and a manifold/control cost premium (+5% per boiler).
   */
  boilerCount: number;
  /**
   * Cascade redundancy mode. "N" = total installed capacity equals the
   * design duty (no redundancy). "N+1" = total installed capacity is
   * grossed up so any (N-1) boilers cover the design load — costs scale
   * with installed capacity, not active duty. Standard practice for
   * critical multifamily DHW plants serving 50+ units.
   */
  cascadeRedundancy: CascadeRedundancy;
  gasEfficiency: number;
  hpwhRefrigerant: Refrigerant;
  /** null → derive from mech room annual */
  hpwhAmbientF: number | null;
  swingTankEnabled: boolean;
  /** Efficiency tier for any heat-pump system (central + in-unit + combi) */
  hpwhTier: HPWHTier;

  // Utility / carbon
  elecRate: number;
  gasRate: number;
  gridSubregion: GridSubregion;
  customEF: number;

  // In-unit combi
  avgUnitSqft: UnitCount;
  envelopePreset: EnvelopeKey;
  indoorDesignF: number;
  combiTankSize: HPWHTankSize;
  fanCoilSupplyF: number;
  bufferTankEnabled: boolean;
  combiDHWSetpointF: number;
  hpwhOpLimitF: number;
  ventilationLoadPerUnit: number;

  // In-unit gas tank
  gasTankSize: GasTankSize;
  gasTankType: GasTankType;
  gasTankSetpointF: number;

  // In-unit gas tankless
  gasTanklessInput: GasTanklessInput;
  tanklessDesignRiseF: number;
  tanklessSimultaneousFixtures: number;
  gasTanklessSetpointF: number;

  // Central gas tankless (modulating condensing tankless central plant)
  /** Selected per-unit input rating for a central tankless module (MBH) */
  centralGasTanklessInput: CentralGasTanklessInput;

  // Central indirect (boiler + indirect tank / plate HX)
  /** Heat-exchanger transfer effectiveness from boiler loop to potable side
   *  for a central indirect system. Multiplied with `gasEfficiency` to obtain
   *  the overall system efficiency. Typical 0.88–0.95 for plate HX or modern
   *  indirect-fired tanks. */
  indirectHXEffectiveness: number;

  // Central hybrid (HPWH baseload + gas peak/backup)
  /** Fraction of peak DHW load assigned to the HPWH at design conditions.
   *  Remainder goes to the gas backup. Range 0.40–0.90 — values below 0.40
   *  defeat the HPWH benefit, values above 0.90 leave the gas backup
   *  undersized for cold-snap recovery. Default 0.65 reflects typical CZ4A+
   *  electrification practice (HPWH carries shoulder, gas covers winter peaks). */
  hybridSplitRatio: number;
  /** Type of gas backup paired with the HPWH on a `central_hybrid` plant.
   *  Both options use the same gas-efficiency math; the distinction drives the
   *  cost model (boiler is more expensive than a condensing tank) and the
   *  archetype label. */
  hybridGasBackupType: "tank" | "boiler";

  // Central steam-to-DHW HX (district or in-building steam → indirect tank)
  /** Overall efficiency of the steam source upstream of the building. For
   *  district steam this is plant efficiency × mains/distribution loss
   *  (typical 0.65). For in-building generated steam this is boiler
   *  efficiency × in-building distribution (typical 0.85). Range 0.60–0.90. */
  steamSourceEfficiency: number;
  /** Heat-exchanger transfer effectiveness from steam side to potable side
   *  on a `central_steam_hx` system. Plate or shell-and-tube HX with clean
   *  surfaces — typical 0.88–0.95. Range 0.80–0.98. */
  steamHXEffectiveness: number;
  /** Steam supply pressure (PSIG) at the building HX. Sets the steam
   *  saturation temperature (~227°F at 5 PSIG); the storage setpoint must
   *  stay below saturation − ~20°F approach for the HX to deliver design
   *  capacity. Informational only — used to flag infeasible setpoints. */
  steamSupplyPressurePSIG: number;

  // In-unit combi gas tankless (modulating tankless + buffer tank)
  /** Selected per-unit input rating (MBH) for the modulating condensing
   *  tankless module on a `inunit_combi_gas_tankless` system. Reuses the
   *  same SKU ladder as the DHW-only `inunit_gas_tankless` (150 / 180 / 199
   *  MBH). The DHW-side capacity check is identical; the combi variant
   *  additionally pairs the unit with a buffer tank on the heating loop. */
  inunitGasTanklessCombiInput: GasTanklessInput;
  /** Buffer tank gallon size for the heating loop on
   *  `inunit_combi_gas_tankless`. Prevents burner short-cycling on low
   *  partial-load heating calls. Auto-sized from min_fire × 5-min runtime
   *  / (8.33 × 15°F swing); the user can override to step up the SKU. */
  inunitGasCombiBufferTankSize: InunitGasBufferTankSize;

  // Central per-floor / per-stack decentralized HPWH (Phase F)
  /** Number of independent HPWH plants serving the building on a
   *  `central_per_floor` system. Each zone serves `totalUnits / zoneCount`
   *  units with its own short recirc loop. Range 2–20; default 4 reflects
   *  one plant per floor on a 4-story mid-rise. Per-zone recirc loop length
   *  scales as `recircLoopLengthFt / zoneCount`, and per-zone HPWH kW is
   *  selected from the standard `CENTRAL_HPWH_KW` ladder for the per-zone
   *  share of design BTU/hr. */
  perFloorZoneCount: number;

  // Central heat-recovery chiller integration (Phase F)
  /** Total building cooling tonnage on a `central_hrc` system. Drives the
   *  available heat-recovery capacity from the chiller condenser side.
   *  Range 10–500. */
  hrcCoolingTons: number;
  /** Fraction of the cooling load that operates year-round on a `central_hrc`
   *  system (1.0 for data centers, ~0.6 for mixed-use with retail or large
   *  server rooms, ~0.3 for residential AC). Drives DHW recovery
   *  availability. Range 0.0–1.0. */
  hrcYearRoundCoolingFraction: number;
  /** Combined cooling + heating COP when the chiller is operating in heat-
   *  recovery mode on a `central_hrc` system. Heat rejected to DHW per BTU
   *  of cooling delivered = `cooling_BTU × COP / (COP − 1)`. Range 2.5–6.0;
   *  default 4.0 reflects a typical CenTraVac / AquaForce in HR mode. */
  hrcCOPHeatRecovery: number;

  // Central wastewater / sewer-source heat pump (Phase F)
  /** Average wastewater source temperature at the building tap on a
   *  `central_wastewater_hp` system. Varies by climate and building activity
   *  (residential bias toward shower-heated water keeps the sewer warm).
   *  Range 50–70°F; default 60°F. */
  wastewaterSourceTempF: number;
  /** Heat pump COP at the wastewater source temperature. Higher than air-
   *  source HPWH because the source is warm + stable year-round. Range
   *  3.0–6.0; default 4.5 reflects typical SHARC / Huber field data. */
  wastewaterCOP: number;

  // In-unit electric resistance (DHW-only and combi variants)
  /** Selected per-unit electric resistance tank size (gal). Used by both
   *  `inunit_resistance` (DHW-only) and `inunit_combi_resistance` (DHW +
   *  hydronic). For the combi variant the tank's kW input is the hard
   *  ceiling on per-unit heating capacity — there's no compressor or
   *  burner reserve beyond the element rating. */
  inunitResistanceTankSize: InunitResistanceTankSize;

  // Fixture flow rates (GPM), used by tankless peak-demand calc
  fixtureGPM: FixtureGPM;

  // Preheat modifiers (Phase D) — architectural addition that lifts the
  // effective inlet water temp before any primary system runs. Applies to
  // every system type uniformly via a single point of integration in the
  // pipeline. Default `preheat: "none"` preserves baseline behavior.
  /** Selected preheat configuration: none, solar thermal, DWHR, or both. */
  preheat: PreheatType;
  /** Solar collector aperture area (ft²). Drives the monthly solar fraction
   *  via climate-archetype insolation tables. Range 0–1000+ for multifamily;
   *  default 0 (so enabling solar without choosing an area produces a
   *  zero-fraction result, not a runtime nudge). */
  solarCollectorAreaSqft: number;
  /** Solar storage tank size (gal). Informational only at the current
   *  modeling fidelity — the monthly-energy balance assumes the tank is
   *  large enough to absorb daily peak collection. Range 40–500. */
  solarStorageGal: number;
  /** DWHR unit effectiveness (dimensionless 0–1). Vertical falling-film
   *  units typically rate 0.40–0.60 per CSA B55.2; 0.50 default. */
  dwhrEffectiveness: number;
  /** Fraction of fixtures (typically showers) plumbed through the DWHR
   *  unit. Sinks rarely benefit because their drain temp doesn't develop
   *  enough ΔT before reaching the trap. Default 0.5. */
  dwhrCoverage: number;

  // Recirculation control modifier (Phase E) — scales the recirc-loop
  // standby loss based on how the recirc pump is controlled. Only affects
  // systems with `hasRecirc: true` (all central). Default `"continuous"`
  // preserves baseline behavior for any saved scenarios that pre-date
  // Phase E.
  /** Selected recirculation pump control mode: continuous, time-clock,
   *  demand-controlled, or aquastat. Sources: ASHRAE 90.1-2022 §6.5.5;
   *  ACEEE multifamily distribution studies. */
  recircControl: RecircControlMode;
  /** Pump operating hours per day for `time_clock` mode (range 8–24).
   *  Default 16 hr/day produces a 0.50 multiplier matching the spec
   *  baseline. Multiplier formula: `(hoursPerDay / 24) × 0.75` — the
   *  0.75 factor reflects that scheduled-pump savings beat strict
   *  pro-rata because typical schedules exclude overnight hours when
   *  standby losses matter most. Ignored for non-time_clock modes. */
  timeClockHoursPerDay: number;
}

export const DEFAULT_INPUTS: DhwInputs = {
  systemType: "central_hpwh",
  unitsStudio: 0,
  units1BR: 20,
  units2BR: 30,
  units3BR: 10,
  occupancyProfile: "medium",
  climateZone: "5A - Chicago",
  inletWaterF: null,
  storageSetpointF: 140,
  deliveryF: 120,
  demandMethod: "ashrae",
  occupantsPerUnit: { br0: 1.0, br1: 1.5, br2: 2.5, br3: 3.5 },
  gpcd: 20,
  recircLoopLengthFt: 800,
  pipeInsulationR: 4,
  recircReturnTempF: 125,
  ambientPipeF: 70,
  centralBoilerType: "condensing",
  boilerCount: 1,
  cascadeRedundancy: "N",
  gasEfficiency: 0.95,
  hpwhRefrigerant: "CO2",
  hpwhAmbientF: null,
  swingTankEnabled: true,
  hpwhTier: "energy_star",
  elecRate: 0.14,
  gasRate: 1.20,
  gridSubregion: "MROW (Upper MW)",
  customEF: 0.70,
  avgUnitSqft: { br0: 450, br1: 650, br2: 900, br3: 1200 },
  envelopePreset: "code2021",
  indoorDesignF: 70,
  combiTankSize: 80,
  fanCoilSupplyF: 125,
  bufferTankEnabled: false,
  combiDHWSetpointF: 130,
  hpwhOpLimitF: 37,
  ventilationLoadPerUnit: 40,
  gasTankSize: 50,
  gasTankType: "condensing",
  gasTankSetpointF: 125,
  gasTanklessInput: 199,
  tanklessDesignRiseF: 70,
  tanklessSimultaneousFixtures: 2,
  gasTanklessSetpointF: 120,
  centralGasTanklessInput: 1000,
  indirectHXEffectiveness: 0.92,
  hybridSplitRatio: 0.65,
  hybridGasBackupType: "tank",
  steamSourceEfficiency: 0.75,
  steamHXEffectiveness: 0.90,
  steamSupplyPressurePSIG: 5,
  inunitGasTanklessCombiInput: 199,
  inunitGasCombiBufferTankSize: 40,
  inunitResistanceTankSize: 50,
  perFloorZoneCount: 4,
  hrcCoolingTons: 50,
  hrcYearRoundCoolingFraction: 0.6,
  hrcCOPHeatRecovery: 4.0,
  wastewaterSourceTempF: 60,
  wastewaterCOP: 4.5,
  fixtureGPM: { ...DEFAULT_FIXTURE_GPM },
  preheat: "none",
  solarCollectorAreaSqft: 0,
  solarStorageGal: 80,
  dwhrEffectiveness: 0.50,
  dwhrCoverage: 0.5,
  recircControl: "continuous",
  timeClockHoursPerDay: 16,
};
