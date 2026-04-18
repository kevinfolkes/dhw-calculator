/**
 * Typed input shape for the DHW calculator. Mirrors the React state surface of
 * the original artifact, but consolidated into a single object so it can be
 * serialized (URL params, localStorage, PDF export) and threaded through a
 * single pure `runCalc()` function.
 */
import type {
  ClimateZoneKey,
  EnvelopeKey,
  GasTankSize,
  GasTankType,
  GasTanklessInput,
  GridSubregion,
  HPWHTankSize,
  HPWHTier,
  OccupancyProfile,
} from "@/lib/engineering/constants";
import type { Refrigerant } from "@/lib/engineering/hpwh";
import type { SystemTypeKey } from "@/lib/engineering/system-types";

export type DemandMethod = "ashrae" | "hunter" | "occupancy";

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
  inletWaterF: number;
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

  // Fixture flow rates (GPM), used by tankless peak-demand calc
  fixtureGPM: FixtureGPM;
}

export const DEFAULT_INPUTS: DhwInputs = {
  systemType: "central_hpwh",
  unitsStudio: 0,
  units1BR: 20,
  units2BR: 30,
  units3BR: 10,
  occupancyProfile: "medium",
  climateZone: "5A - Chicago",
  inletWaterF: 50,
  storageSetpointF: 140,
  deliveryF: 120,
  demandMethod: "ashrae",
  occupantsPerUnit: { br0: 1.0, br1: 1.5, br2: 2.5, br3: 3.5 },
  gpcd: 20,
  recircLoopLengthFt: 800,
  pipeInsulationR: 4,
  recircReturnTempF: 125,
  ambientPipeF: 70,
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
  fixtureGPM: { ...DEFAULT_FIXTURE_GPM },
};
