/**
 * Peak/avg demand calculations for three methods:
 *   - ASHRAE Ch. 51 Table 7 (per-apartment tabular)
 *   - Hunter / ASPE modified (fixture-unit to GPM with diversity)
 *   - Occupancy (gpcd × occupants with typical peaking factor)
 *
 * Output: peak hour, peak day, avg day GPH at delivered (not tempered) temp.
 */
import {
  ASHRAE_APT_DEMAND,
  WSFU,
  type OccupancyProfile,
} from "@/lib/engineering/constants";
import { huntersGPM } from "@/lib/engineering/hunter";
import type { DemandMethod } from "./inputs";

export interface DemandResult {
  peakHourGPH: number;
  peakDayGPH: number;
  avgDayGPH: number;
  // Raw per-method values for the side-by-side display
  ashraeMH: number;
  hunterMH: number;
  occupancyMH: number;
  peakGPM_modified: number;
  peakGPM_classical: number;
  hotWSFU: number;
  diversityFactor: number;
  totalOccupants: number;
  /** Per-unit-type WSFU, so the UI can show the assumed fixture mix */
  wsfuBreakdown: {
    br0: number;
    br1: number;
    br2: number;
    br3: number;
    br0Count: number;
    br1Count: number;
    br2Count: number;
    br3Count: number;
  };
}

/**
 * Per-unit-type fixture mix assumed by the Hunter/ASPE calculation.
 * Exposed so the demand tab can render a transparent breakdown. Studios
 * (br0) assume a single bathroom sink, kitchenette, shower, half-credit for
 * dishwasher and washer (shared-laundry-friendly).
 */
export const UNIT_FIXTURE_MIX = {
  br0: { lavatory: 1, kitchen: 1, shower: 1, tub: 0, dishwasher: 0.5, washer: 0.5 },
  br1: { lavatory: 2, kitchen: 1, shower: 1, tub: 0, dishwasher: 0, washer: 0.5 },
  br2: { lavatory: 3, kitchen: 1, shower: 1, tub: 0.5, dishwasher: 0.5, washer: 0.5 },
  br3: { lavatory: 4, kitchen: 1, shower: 1, tub: 1, dishwasher: 1, washer: 1 },
} as const;

export interface DemandInput {
  unitsStudio: number;
  units1BR: number;
  units2BR: number;
  units3BR: number;
  occupancyProfile: OccupancyProfile;
  demandMethod: DemandMethod;
  occupantsPerUnit: { br0: number; br1: number; br2: number; br3: number };
  gpcd: number;
}

export function computeDemand(input: DemandInput): DemandResult {
  const { unitsStudio, units1BR, units2BR, units3BR, occupancyProfile, demandMethod, occupantsPerUnit, gpcd } = input;
  const totalUnits = unitsStudio + units1BR + units2BR + units3BR;
  const p = ASHRAE_APT_DEMAND[occupancyProfile];

  const ashraeMH = totalUnits * p.mh;
  const ashraeMD = totalUnits * p.md;
  const ashraeAvg = totalUnits * p.avg;

  // Hunter / ASPE modified — aggregate WSFU across typical multifamily fixture mixes
  const wsfuPerUnit = (mix: (typeof UNIT_FIXTURE_MIX)[keyof typeof UNIT_FIXTURE_MIX]) =>
    WSFU.lavatory * mix.lavatory +
    WSFU.kitchen * mix.kitchen +
    WSFU.shower * mix.shower +
    WSFU.tub * mix.tub +
    WSFU.dishwasher * mix.dishwasher +
    WSFU.washer * mix.washer;
  const wsfu_br0 = wsfuPerUnit(UNIT_FIXTURE_MIX.br0);
  const wsfu_br1 = wsfuPerUnit(UNIT_FIXTURE_MIX.br1);
  const wsfu_br2 = wsfuPerUnit(UNIT_FIXTURE_MIX.br2);
  const wsfu_br3 = wsfuPerUnit(UNIT_FIXTURE_MIX.br3);
  const hotWSFU =
    unitsStudio * wsfu_br0 + units1BR * wsfu_br1 + units2BR * wsfu_br2 + units3BR * wsfu_br3;
  const peakGPM_modified = huntersGPM(hotWSFU, true);
  const peakGPM_classical = huntersGPM(hotWSFU, false);
  const diversityFactor = hotWSFU > 100 ? 0.55 : hotWSFU > 30 ? 0.65 : 0.80;
  const hunterMH = peakGPM_modified * 60 * diversityFactor;

  const totalOccupants =
    unitsStudio * occupantsPerUnit.br0 +
    units1BR * occupantsPerUnit.br1 +
    units2BR * occupantsPerUnit.br2 +
    units3BR * occupantsPerUnit.br3;
  const occupancyDay = totalOccupants * gpcd;
  const occupancyMH = occupancyDay * 0.25;

  let peakHourGPH: number, peakDayGPH: number, avgDayGPH: number;
  if (demandMethod === "ashrae") {
    peakHourGPH = ashraeMH;
    peakDayGPH = ashraeMD;
    avgDayGPH = ashraeAvg;
  } else if (demandMethod === "hunter") {
    peakHourGPH = hunterMH;
    peakDayGPH = hunterMH * 4;
    avgDayGPH = hunterMH * 3.2;
  } else {
    peakHourGPH = occupancyMH;
    peakDayGPH = occupancyDay;
    avgDayGPH = occupancyDay * 0.85;
  }

  return {
    peakHourGPH,
    peakDayGPH,
    avgDayGPH,
    ashraeMH,
    hunterMH,
    occupancyMH,
    peakGPM_modified,
    peakGPM_classical,
    hotWSFU,
    diversityFactor,
    totalOccupants,
    wsfuBreakdown: {
      br0: wsfu_br0,
      br1: wsfu_br1,
      br2: wsfu_br2,
      br3: wsfu_br3,
      br0Count: unitsStudio,
      br1Count: units1BR,
      br2Count: units2BR,
      br3Count: units3BR,
    },
  };
}
