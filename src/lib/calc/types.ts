import type { ClimateDesign, GasTankSpec, GasTanklessSpec, HPWHTankSpec } from "@/lib/engineering/constants";

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
}
