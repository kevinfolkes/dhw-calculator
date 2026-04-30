import type {
  ClimateDesign,
  GasTankSpec,
  GasTanklessSpec,
  HPWHTankSpec,
  RecircControlMode,
} from "@/lib/engineering/constants";
import type { PreheatType } from "./inputs";

export interface ComplianceFlag {
  level: "ok" | "info" | "warn" | "error";
  code: string;
  msg: string;
}

export interface CombiResults {
  dhwGPH_0BR: number;
  dhwGPH_1BR: number;
  dhwGPH_2BR: number;
  dhwGPH_3BR: number;
  designDeltaT: number;
  envFactor: number;
  heatingLoad_0BR: number;
  heatingLoad_1BR: number;
  heatingLoad_2BR: number;
  heatingLoad_3BR: number;
  totalHeatingLoad: number;
  dhwPeakInstantaneous_0BR: number;
  dhwPeakInstantaneous_1BR: number;
  dhwPeakInstantaneous_2BR: number;
  dhwPeakInstantaneous_3BR: number;
  tankSpec: HPWHTankSpec;
  fhr: number;
  dhwMetByFHR: boolean;
  worstPeakDHW: number;
  combiCOP_heating: number;
  combiCOP_dhw: number;
  effectiveTankSetpointForHeating: number;
  combiCompressorOutputBTUH_0BR: number;
  combiCompressorOutputBTUH_1BR: number;
  combiCompressorOutputBTUH_2BR: number;
  combiCompressorOutputBTUH_3BR: number;
  heatingMetByHPWH_0BR: boolean;
  heatingMetByHPWH_1BR: boolean;
  heatingMetByHPWH_2BR: boolean;
  heatingMetByHPWH_3BR: boolean;
  resistanceBackup_0BR: number;
  resistanceBackup_1BR: number;
  resistanceBackup_2BR: number;
  resistanceBackup_3BR: number;
  needsFullResistanceBackup: boolean;
  combi0BRAnnual: { heating: number; dhw: number; total: number };
  combi1BRAnnual: { heating: number; dhw: number; total: number };
  combi2BRAnnual: { heating: number; dhw: number; total: number };
  combi3BRAnnual: { heating: number; dhw: number; total: number };
  combiTotalAnnualKWh: number;
  combiTotalAnnualCost: number;
  combiTotalAnnualCarbon: number;
  buildingPeakDemandKW_combi: number;
  perUnitElecDemand: number;
  ventLoadPerUnit: number;
  seasonalCOP_heating: number;
  seasonalCOP_dhw: number;
}

export interface InUnitGasResults {
  gasTankSpec: GasTankSpec;
  gasTankUEF: number;
  gasTankFHR: number;
  gasTankFHRMet: boolean;
  gasTankInputMBH: number;
  gasTankOutputMBH: number;
  gasTankRiseF: number;
  gasTankRecoveryGPH: number;
  gasTankAnnualTherms_perUnit: number;
  gasTankBuildingTherms: number;
  gasTankBuildingCost: number;
  gasTankBuildingCarbon: number;
  gasTankCFH_perUnit: number;
  buildingGasDemandCFH: number;
  gasDiversityFactor: number;
  perUnitPeakGPH: number;
  tanklessSpec: GasTanklessSpec;
  tanklessPeakGPM: number;
  tanklessRequiredBTUH: number;
  tanklessCapacityAtRise: number;
  tanklessMetsDemand: boolean;
  tanklessAnnualTherms_perUnit: number;
  tanklessBuildingTherms: number;
  tanklessBuildingCost: number;
  tanklessBuildingCarbon: number;
  tanklessCFH_perUnit: number;
  tanklessBuildingDemandCFH: number;
}

export interface MonthlyRow {
  month: string;
  monthIdx: number;
  daysInMonth: number;
  monthAmbient: number;
  monthMechRoom: number;
  monthInlet: number;
  monthCOP_dhw: number;
  monthCOP_heating: number;
  monthResistanceShare: number;
  dhwEnergy: number;
  heatingEnergy: number;
  totalEnergy: number;
  /** Per-apartment DHW energy (kWh or therms, depending on unit) */
  dhwPerApt: number;
  /** Per-apartment heating energy (only non-zero for combi systems) */
  heatingPerApt: number;
  /** Per-apartment total energy */
  totalPerApt: number;
  dhwCost: number;
  heatingCost: number;
  totalCost: number;
  dhwCarbon: number;
  heatingCarbon: number;
  totalCarbon: number;
  unit: "kWh" | "therms" | "";
}

export interface MonthlyResults {
  monthly: MonthlyRow[];
  monthlyAnnualEnergy: number;
  monthlyAnnualDHW: number;
  monthlyAnnualHeating: number;
  monthlyAnnualCost: number;
  monthlyAnnualCarbon: number;
  monthlyUnit: "kWh" | "therms" | "";
  dhwFraction: number;
  heatingFraction: number;
}

export interface SizingRec {
  capCost: number;
  annCost: number;
  total15?: number;
  /** Optional secondary equipment value (e.g. for hybrid systems where the
   *  primary `cap` is HPWH kW and `cap2` is the gas-backup MBH). */
  cap2?: number | string;
  /** Unit label for `cap2` (e.g. "MBH input"). */
  cap2Unit?: string;
  [k: string]: unknown;
}

export interface AutoSizeResult {
  system: string;
  minimum?: SizingRec;
  recommended?: SizingRec;
  lifecycle?: SizingRec | null;
  reqPeakHourGPH?: number;
  reqOutputMBH?: number;
  reqOutputKW?: number;
  reqFHR?: number;
  reqPeakGPM?: number;
  reqInputMBH_derated?: number;
  worstHeatingLoad?: number | null;
}

export interface CalcResult {
  totalUnits: number;
  totalOccupants: number;
  hotWSFU: number;
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
  demandASHRAE_MH: number;
  demandHunter_MH: number;
  demandOccupancy_MH: number;
  peakGPM_modified: number;
  peakGPM_classical: number;
  /** Peak instantaneous per-apartment simultaneous-fixture flow (top-N × 85%),
   *  in GPM. Drives tankless sizing directly, and is surfaced as a secondary
   *  sanity check for storage-tank systems (can the tank supply this burst?). */
  peakInstantGPM: number;
  /** peakInstantGPM × 60 — what the tank would consume if the peak burst
   *  were sustained for an hour. Compared against tank FHR for tank systems. */
  peakInstantGPH: number;
  /** Number of simultaneous fixtures assumed in the peak burst. */
  peakInstantFixtureCount: number;
  diversityFactor: number;
  peakHourDemand: number;
  peakDayDemand: number;
  avgDayDemand: number;
  recircLossBTUH: number;
  recircLossKW: number;
  storageVolGal: number;
  storageVolGal_nominal: number;
  temperedCapacityGal: number;
  recoveryGPH: number;
  recoveryBTUH: number;
  recoveryKW: number;
  totalBTUH: number;
  totalKW: number;
  gasInputBTUH: number;
  resistanceInputKW: number;
  cop: number;
  capFactor: number;
  hpwhInputKW: number;
  hpwhNameplateKW: number;
  swingTankKW: number;
  effectiveHpwhAmbient: number;
  annualCOP: number;
  annualGasTherms: number;
  annualResistanceKWh: number;
  annualHPWHKWh_total: number;
  annualGasCost: number;
  annualResistanceCost: number;
  annualHPWHCost: number;
  annualGasCarbon: number;
  annualResistanceCarbon: number;
  annualHPWHCarbon: number;
  flags: ComplianceFlag[];
  climate: ClimateDesign;
  temperatureRise: number;
  temperMultiplier: number;
  combi: CombiResults;
  inUnitGas: InUnitGasResults;
  monthly: MonthlyResults;
  autoSize: AutoSizeResult | null;
  /** Resolved inlet water temp (°F): user-supplied if set, otherwise derived
   *  from the climate zone annual mean (Burch & Christensen 2007). */
  effectiveInletF: number;
  /** Recommended buffer tank volume (gal) for combi HPWH systems with
   *  bufferTankEnabled. null when not applicable. */
  bufferTankVolumeGal: number | null;
  /** Peak instantaneous GPM the central tankless plant must deliver to meet
   *  peak hour demand (with ASHRAE Ch. 51 §"Instantaneous water heaters"
   *  1.5× margin on the average peak-hour rate). Only meaningful for
   *  `central_gas_tankless`; 0 for other system types. */
  centralTanklessPeakGPMRequired: number;
  /** Peak instantaneous GPM capacity of the selected central tankless input
   *  rating at the design ΔT. Only meaningful for `central_gas_tankless`;
   *  0 for other system types. */
  centralTanklessCapacityGPM: number;
  /** Whether the selected central tankless module covers the required peak
   *  instantaneous flow. Only meaningful for `central_gas_tankless`. */
  centralTanklessMetsDemand: boolean;
  /** Combined system efficiency for `central_indirect` (gasEfficiency × HX
   *  effectiveness). For other systems mirrors `gasEfficiency` so it can be
   *  surfaced uniformly in the equipment / calculations tabs. */
  effectiveGasEfficiency: number;
  /** HPWH-side design BTU/hr for `central_hybrid` (= split_ratio × totalBTUH).
   *  Zero for other system types. */
  hybridHpwhBTUH: number;
  /** Gas-backup output BTU/hr for `central_hybrid` (= (1 − split_ratio) ×
   *  totalBTUH). Zero for other system types. */
  hybridGasBTUH: number;
  /** Required gas-backup input rating (MBH) for `central_hybrid`
   *  (= hybridGasBTUH ÷ gasEfficiency ÷ 1000). Zero for other system types. */
  hybridGasInputMBH: number;
  /** Combined source × HX efficiency for `central_steam_hx`
   *  (= steamSourceEfficiency × steamHXEffectiveness). Equal to
   *  `effectiveGasEfficiency` for that system; defaults to `gasEfficiency`
   *  for other system types so it can be surfaced uniformly. */
  steamCombinedEfficiency: number;
  /** True when the storage setpoint is at least 20°F below the steam
   *  saturation temperature at the supplied pressure — i.e. the HX can
   *  physically deliver the design rise. Always true for non-steam systems. */
  steamApproachOK: boolean;
  /** Total annual electric energy attributable to the configured system
   *  type (kWh). For pure-gas systems (central_gas, central_indirect,
   *  central_steam_hx, central_gas_tankless, in-unit gas) this is 0; for
   *  HPWH and resistance systems it equals the per-tech annual; for
   *  `central_hybrid` it is the HPWH-side share. */
  annualElectricKWh: number;
  /** Required buffer tank volume (gal) for `inunit_combi_gas_tankless`
   *  derived from min_fire × 5-min runtime / (8.33 × 15°F swing).
   *  Surfaces the rule-of-thumb minimum so users can compare against the
   *  selected SKU. Zero for all other system types. */
  inunitGasCombiBufferRequiredGal: number;
  /** Selected buffer tank SKU (gal) for `inunit_combi_gas_tankless` —
   *  smallest INUNIT_GAS_BUFFER_TANK_SIZES entry ≥ the required value, or
   *  the user's manual override (whichever is larger). Zero for all other
   *  system types. */
  inunitGasCombiBufferSelectedGal: number;
  /** Peak instantaneous DHW-side GPM capacity for `inunit_combi_gas_tankless`
   *  at the configured tankless design rise. Computed from the user's
   *  selected per-unit input × tankless UEF. Zero for all other system
   *  types. */
  inunitGasCombiPeakInstantGPM: number;
  /** Echo of the selected preheat modifier ("none" | "solar" | "dwhr" |
   *  "solar+dwhr"). Lets tabs key off the result alone without re-reading
   *  inputs. */
  preheatType: PreheatType;
  /** Energy-weighted annual solar fraction (0..0.85). Sum-of-monthly-BTU
   *  contribution divided by the annual DHW load. Zero when solar is
   *  inactive. */
  annualSolarFraction: number;
  /** Constant DWHR inlet lift (°F) applied across all months. Zero when
   *  DWHR is inactive. */
  annualDwhrLiftF: number;
  /** Combined annual-average preheat lift (°F) applied to the design-day
   *  inlet. Zero when `preheatType === "none"`. */
  annualPreheatLiftF: number;
  /** Per-month solar fraction (0..0.85), 12 entries indexed Jan..Dec. All
   *  zero when solar is inactive. */
  monthlySolarFractions: number[];
  /** Echo of the selected recirc control mode (Phase E). For non-recirc
   *  systems this still echoes the user-entered value but the multiplier
   *  / savings fields are zeroed because there is no recirc loop. */
  recircControl: RecircControlMode;
  /** Effective multiplier applied to the raw recirc standby loss
   *  (continuous = 1.0, demand = 0.30, etc.). Zero for non-recirc systems
   *  so downstream tabs can detect "is the loop active?" with `> 0`. */
  recircControlMultiplier: number;
  /** BTU/hr of recirc loss avoided vs the continuous-pumping baseline
   *  (rawLoss − adjustedLoss). Always non-negative; zero for `continuous`
   *  mode and for systems without a recirc loop. */
  recircLossSavingsBTUH: number;
  /** Raw (continuous-pumping) recirc standby loss, BTU/hr. Surfaced for
   *  the Calculations / Current Design tabs so users can see the
   *  before / after comparison when a non-continuous mode is active.
   *  Equals `recircLossBTUH` for `continuous` mode. Zero for non-recirc
   *  systems. */
  recircLossRawBTUH: number;
}
