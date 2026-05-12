/**
 * One-shot helper that prints the actual calculator values for every case
 * tested in src/lib/calc/calibration.test.ts. Used to populate the
 * docs/calibration.md table with concrete observed numbers; run with:
 *   npx tsx scripts/calibration-values.ts
 */
import { runCalc } from "../src/lib/calc/pipeline";
import { DEFAULT_INPUTS } from "../src/lib/calc/inputs";
import { huntersGPM } from "../src/lib/engineering/hunter";
import { deriveInletWaterF, winterDesignInletF } from "../src/lib/engineering/climate";

const def = runCalc(DEFAULT_INPUTS);
const gas = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
const inGas = runCalc({ ...DEFAULT_INPUTS, systemType: "inunit_gas_tank" });
const inHpwh = runCalc({ ...DEFAULT_INPUTS, systemType: "inunit_hpwh" });
const inRes = runCalc({ ...DEFAULT_INPUTS, systemType: "inunit_resistance" });
const hpwh = runCalc({ ...DEFAULT_INPUTS, systemType: "central_hpwh" });
const ww = runCalc({ ...DEFAULT_INPUTS, systemType: "central_wastewater_hp" });
const res = runCalc({ ...DEFAULT_INPUTS, systemType: "central_resistance" });
const hrc = runCalc({ ...DEFAULT_INPUTS, systemType: "central_hrc" });
const perFloor = runCalc({ ...DEFAULT_INPUTS, systemType: "central_per_floor" });
const chp = runCalc({ ...DEFAULT_INPUTS, systemType: "central_chp" });
const chp75 = runCalc({
  ...DEFAULT_INPUTS,
  systemType: "central_chp",
  chpElectricKW: 75,
  chpAnnualRunHours: 7000,
});
const dem = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", recircControl: "demand" });
const tc16 = runCalc({
  ...DEFAULT_INPUTS,
  systemType: "central_gas",
  recircControl: "time_clock",
  timeClockHoursPerDay: 16,
});
const cascade4 = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", boilerCount: 4 });
const atm = runCalc({
  ...DEFAULT_INPUTS,
  systemType: "central_gas",
  centralBoilerType: "non_condensing",
  gasEfficiency: 0.78,
});
const dwhr = runCalc({
  ...DEFAULT_INPUTS,
  systemType: "central_gas",
  preheat: "dwhr",
  dwhrEffectiveness: 0.5,
  dwhrCoverage: 0.5,
});
const solar = runCalc({
  ...DEFAULT_INPUTS,
  systemType: "central_gas",
  climateZone: "4A - NYC",
  preheat: "solar",
  solarCollectorAreaSqft: 600,
  solarStorageGal: 400,
});
const hrcSmall = runCalc({
  ...DEFAULT_INPUTS,
  systemType: "central_hrc",
  hrcCoolingTons: 5,
  hrcYearRoundCoolingFraction: 0.3,
});
const groundDul = runCalc({
  ...DEFAULT_INPUTS,
  systemType: "central_hpwh",
  climateZone: "7 - Duluth",
  hpwhSourceMode: "ground_loop",
});
const airDul = runCalc({
  ...DEFAULT_INPUTS,
  systemType: "central_hpwh",
  climateZone: "7 - Duluth",
  hpwhSourceMode: "air_mech_room",
});

const fmt = (n: number, p = 1) => Number.isFinite(n) ? n.toFixed(p) : "n/a";

console.log("=== ASHRAE Apps Ch. 51 ===");
console.log(`avg/raw daily ratio: ${fmt(def.avgDayDemand / (def.totalOccupants * 20), 3)}`);
console.log(`peakDay/avg ratio:   ${fmt(def.peakDayDemand / def.avgDayDemand, 3)}`);
console.log(`peakHour/peakDay:    ${fmt(def.peakHourDemand / def.peakDayDemand, 3)}`);
console.log(`storage hours:       ${fmt(gas.storageVolGal / gas.peakHourDemand, 2)}`);
console.log(`BTU/hr per occupant: ${fmt(gas.totalBTUH / gas.totalOccupants, 0)}`);

console.log("\n=== ASPE Hunter ===");
console.log(`90 WSFU mod:    ${fmt(huntersGPM(90, true))} GPM`);
console.log(`200 WSFU mod:   ${fmt(huntersGPM(200, true))} GPM`);
console.log(`100 mod (disc): 99=${fmt(huntersGPM(99, true))} 100=${fmt(huntersGPM(100, true))} 101=${fmt(huntersGPM(101, true))}`);

console.log("\n=== Burch & Christensen inlet ===");
console.log(`5A Chicago annual:     ${deriveInletWaterF("5A - Chicago")}°F`);
console.log(`2A Houston annual:     ${deriveInletWaterF("2A - Houston")}°F`);
console.log(`5A Chicago winter:     ${winterDesignInletF("5A - Chicago")}°F`);

console.log("\n=== HPWH performance ===");
console.log(`Central HPWH annualCOP:        ${fmt(hpwh.annualCOP, 2)}`);
console.log(`Wastewater effectiveCOP:       ${fmt(ww.wastewaterEffectiveCOP, 2)}`);
console.log(`Duluth ground vs air COP:      g=${fmt(groundDul.annualCOP, 2)} a=${fmt(airDul.annualCOP, 2)}`);

console.log("\n=== Gas baselines ===");
console.log(`Central gas therms/unit:           ${fmt(gas.annualGasTherms / gas.totalUnits)}`);
console.log(`Atm vs cond ratio:                 ${fmt(atm.annualGasTherms / gas.annualGasTherms, 3)}`);

console.log("\n=== In-unit ===");
console.log(`In-unit gas tank therms/unit:      ${fmt(inGas.annualGasTherms / inGas.totalUnits)}`);
console.log(`In-unit HPWH kWh/unit:             ${fmt(inHpwh.annualHPWHKWh_total / inHpwh.totalUnits, 0)}`);
console.log(`In-unit resistance kWh/unit:       ${fmt(inRes.annualResistanceKWh / inRes.totalUnits, 0)}`);

console.log("\n=== Recirc ===");
console.log(`Raw recirc loss BTU/hr:    ${fmt(gas.recircLossRawBTUH, 0)}`);
console.log(`Demand reduction:          ${fmt(1 - dem.recircLossBTUH / gas.recircLossBTUH, 3)}`);
console.log(`Time-clock 16hr reduction: ${fmt(1 - tc16.recircLossBTUH / gas.recircLossBTUH, 3)}`);

console.log("\n=== Carbon ===");
console.log(`MROW lb CO2/kWh:     ${fmt(hpwh.annualHPWHCarbon / hpwh.annualHPWHKWh_total, 3)}`);
console.log(`Gas  lb CO2/therm:   ${fmt(gas.annualGasCarbon / gas.annualGasTherms, 3)}`);

console.log("\n=== Preheat ===");
console.log(`DWHR lift @ 50%/50%:    ${fmt(dwhr.annualDwhrLiftF, 2)}°F`);
console.log(`Solar 600sqft 4A NYC:   ${fmt(solar.annualSolarFraction, 4)} fraction`);

console.log("\n=== Cascade ===");
console.log(`4-boiler cascade gas reduction: ${fmt(1 - cascade4.annualGasTherms / gas.annualGasTherms, 4)}`);

console.log("\n=== Cross-system ===");
console.log(`Resistance/HPWH ratio:         ${fmt(res.annualResistanceKWh / hpwh.annualHPWHKWh_total, 2)}`);
console.log(`HRC reduction vs central gas:  ${fmt(1 - hrc.annualGasTherms / gas.annualGasTherms, 3)}`);
console.log(`Small HRC coverage:            ${fmt(hrcSmall.hrcCoverageFraction, 3)}`);
console.log(`Per-floor recirc loss BTU/hr:  ${fmt(perFloor.recircLossBTUH, 0)} (vs central HPWH ${fmt(hpwh.recircLossBTUH, 0)})`);

console.log("\n=== CHP ===");
console.log(`35 kW CHP coverage:                  ${fmt(chp.chpCoverageFraction, 3)}`);
console.log(`75 kW CHP annual generated kWh:      ${fmt(chp75.chpAnnualElectricGeneratedKWh, 0)}`);
