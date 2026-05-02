import { describe, it, expect } from "vitest";
import { runCalc } from "./pipeline";
import { DEFAULT_INPUTS } from "./inputs";

describe("runCalc (integration)", () => {
  it("returns a 12-month monthly array summing to annual rollup", () => {
    const r = runCalc(DEFAULT_INPUTS);
    expect(r.monthly.monthly.length).toBe(12);
    const sum = r.monthly.monthly.reduce((s, m) => s + m.totalEnergy, 0);
    expect(sum).toBeCloseTo(r.monthly.monthlyAnnualEnergy, 0);
  });

  it("reports required recovery BTU/hr higher than peak-draw BTU/hr (includes recirc)", () => {
    const r = runCalc(DEFAULT_INPUTS);
    expect(r.totalBTUH).toBeGreaterThan(r.recoveryBTUH);
  });

  it("HPWH annual energy is lower than resistance for the same load", () => {
    const r = runCalc(DEFAULT_INPUTS);
    expect(r.annualHPWHKWh_total).toBeLessThan(r.annualResistanceKWh);
  });

  it("switching to central_gas produces therms, not kWh", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    expect(r.monthly.monthlyUnit).toBe("therms");
  });

  it("in-unit combi produces both heating and DHW energy", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: "inunit_combi" });
    const heat = r.monthly.monthly.reduce((s, m) => s + m.heatingEnergy, 0);
    const dhw = r.monthly.monthly.reduce((s, m) => s + m.dhwEnergy, 0);
    expect(heat).toBeGreaterThan(0);
    expect(dhw).toBeGreaterThan(0);
  });

  it("auto-size returns a recommended size for every supported system type", () => {
    const systems = [
      "central_gas", "central_gas_tankless", "central_indirect",
      "central_hybrid", "central_steam_hx",
      "central_resistance", "central_hpwh",
      "central_per_floor", "central_hrc", "central_wastewater_hp",
      "central_chp",
      "inunit_gas_tank", "inunit_gas_tankless", "inunit_hpwh",
      "inunit_combi", "inunit_combi_gas",
      "inunit_combi_gas_tankless", "inunit_resistance", "inunit_combi_resistance",
    ] as const;
    for (const sys of systems) {
      const r = runCalc({ ...DEFAULT_INPUTS, systemType: sys });
      expect(r.autoSize).not.toBeNull();
      expect(r.autoSize!.recommended).toBeDefined();
    }
  });

  it("inunit_combi_gas produces therms with both DHW and heating components", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: "inunit_combi_gas" });
    expect(r.monthly.monthlyUnit).toBe("therms");
    expect(r.monthly.monthlyAnnualDHW).toBeGreaterThan(0);
    expect(r.monthly.monthlyAnnualHeating).toBeGreaterThan(0);
  });

  it("per-apartment monthly DHW equals building DHW / totalUnits for in-unit systems", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: "inunit_hpwh" });
    const jan = r.monthly.monthly[0];
    const expected = jan.dhwEnergy / r.totalUnits;
    expect(jan.dhwPerApt).toBeCloseTo(expected, 0);
  });

  it("flags Legionella warning when storage <140°F", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, storageSetpointF: 130 });
    const has = r.flags.some(f => f.code.includes("188-2021") && f.msg.includes("Legionella"));
    expect(has).toBe(true);
  });

  it("peak-hour demand is never negative", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, units1BR: 0, units2BR: 0, units3BR: 0 });
    expect(r.peakHourDemand).toBeGreaterThanOrEqual(0);
  });
});

describe("central_gas_tankless", () => {
  it("computes non-NaN, sane peak instantaneous capacity and annual energy", () => {
    const result = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas_tankless" });
    expect(result.totalBTUH).toBeGreaterThan(0);
    expect(result.annualGasTherms).toBeGreaterThan(0);
    expect(result.autoSize?.recommended).toBeTruthy();
    // Tankless has no primary storage
    expect(result.storageVolGal).toBe(0);
    expect(result.centralTanklessPeakGPMRequired).toBeGreaterThan(0);
    expect(result.centralTanklessCapacityGPM).toBeGreaterThan(0);
    // Therms output expected for a gas system
    expect(result.monthly.monthlyUnit).toBe("therms");
  });
});

describe("central_indirect", () => {
  it("computes non-NaN, sane storage + boiler sizing with HX effectiveness", () => {
    const result = runCalc({ ...DEFAULT_INPUTS, systemType: "central_indirect" });
    expect(result.storageVolGal).toBeGreaterThan(0);
    // Higher boiler input than direct due to HX loss
    expect(result.gasInputBTUH).toBeGreaterThan(result.totalBTUH);
    expect(result.autoSize?.recommended).toBeTruthy();
    expect(result.effectiveGasEfficiency).toBeLessThan(DEFAULT_INPUTS.gasEfficiency);
    expect(result.monthly.monthlyUnit).toBe("therms");
  });
});

describe("central_hybrid", () => {
  it("computes both HPWH and gas energy contributions", () => {
    const result = runCalc({ ...DEFAULT_INPUTS, systemType: "central_hybrid" });
    expect(result.totalBTUH).toBeGreaterThan(0);
    expect(result.annualGasTherms).toBeGreaterThan(0);
    expect(result.annualElectricKWh).toBeGreaterThan(0);
    expect(result.autoSize?.recommended).toBeTruthy();
  });
});

describe("central_steam_hx", () => {
  it("derates required input by combined source × HX efficiency", () => {
    const result = runCalc({ ...DEFAULT_INPUTS, systemType: "central_steam_hx" });
    expect(result.storageVolGal).toBeGreaterThan(0);
    expect(result.gasInputBTUH).toBeGreaterThan(result.totalBTUH); // higher than direct due to source+HX losses
    expect(result.autoSize?.recommended).toBeTruthy();
  });
});

describe("inunit_combi_gas_tankless", () => {
  it("computes peak GPM, buffer requirements, and reports therms", () => {
    const result = runCalc({ ...DEFAULT_INPUTS, systemType: "inunit_combi_gas_tankless" });
    expect(result.totalBTUH).toBeGreaterThan(0);
    expect(result.inunitGasCombiPeakInstantGPM).toBeGreaterThan(0);
    expect(result.inunitGasCombiBufferRequiredGal).toBeGreaterThan(0);
    expect(result.inunitGasCombiBufferSelectedGal).toBeGreaterThanOrEqual(
      result.inunitGasCombiBufferRequiredGal,
    );
    expect(result.autoSize?.recommended).toBeTruthy();
    expect(result.monthly.monthlyUnit).toBe("therms");
    expect(result.monthly.monthlyAnnualHeating).toBeGreaterThan(0);
    expect(result.monthly.monthlyAnnualDHW).toBeGreaterThan(0);
  });

  it("does not leak buffer fields onto unrelated systems", () => {
    const gas = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    expect(gas.inunitGasCombiBufferRequiredGal).toBe(0);
    expect(gas.inunitGasCombiBufferSelectedGal).toBe(0);
    expect(gas.inunitGasCombiPeakInstantGPM).toBe(0);
  });
});

describe("inunit_resistance", () => {
  it("produces kWh (not therms) and non-zero annual electric", () => {
    const result = runCalc({ ...DEFAULT_INPUTS, systemType: "inunit_resistance" });
    expect(result.totalBTUH).toBeGreaterThan(0);
    expect(result.monthly.monthlyUnit).toBe("kWh");
    expect(result.annualElectricKWh).toBeGreaterThan(0);
    expect(result.monthly.monthlyAnnualHeating).toBe(0);
    expect(result.autoSize?.recommended).toBeTruthy();
  });
});

describe("inunit_combi_resistance", () => {
  it("produces both DHW and heating kWh, both billed at elec rate", () => {
    const result = runCalc({ ...DEFAULT_INPUTS, systemType: "inunit_combi_resistance" });
    expect(result.totalBTUH).toBeGreaterThan(0);
    expect(result.monthly.monthlyUnit).toBe("kWh");
    expect(result.monthly.monthlyAnnualDHW).toBeGreaterThan(0);
    expect(result.monthly.monthlyAnnualHeating).toBeGreaterThan(0);
    expect(result.annualElectricKWh).toBeGreaterThan(result.annualResistanceKWh * 0); // sanity
    expect(result.autoSize?.recommended).toBeTruthy();
  });
});

describe("central boiler type", () => {
  it("non_condensing central_gas costs less than condensing at the same recommendation", () => {
    const cond = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", centralBoilerType: "condensing", gasEfficiency: 0.95 });
    const nonCond = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", centralBoilerType: "non_condensing", gasEfficiency: 0.78 });
    const condCap = cond.autoSize?.recommended?.capCost ?? 0;
    const nonCondCap = nonCond.autoSize?.recommended?.capCost ?? 0;
    expect(nonCondCap).toBeLessThan(condCap); // ~28% discount
    expect(nonCondCap).toBeGreaterThan(0);
  });

  it("non_condensing burns more fuel for the same demand (lower efficiency)", () => {
    const cond = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", centralBoilerType: "condensing", gasEfficiency: 0.95 });
    const nonCond = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", centralBoilerType: "non_condensing", gasEfficiency: 0.78 });
    expect(nonCond.annualGasTherms).toBeGreaterThan(cond.annualGasTherms);
  });

  it("central_indirect non_condensing also gets the cost discount", () => {
    const cond = runCalc({ ...DEFAULT_INPUTS, systemType: "central_indirect", centralBoilerType: "condensing" });
    const nonCond = runCalc({ ...DEFAULT_INPUTS, systemType: "central_indirect", centralBoilerType: "non_condensing" });
    const condCap = cond.autoSize?.recommended?.capCost ?? 0;
    const nonCondCap = nonCond.autoSize?.recommended?.capCost ?? 0;
    expect(nonCondCap).toBeLessThan(condCap);
  });
});

describe("preheat modifiers (Phase D)", () => {
  it("solar-only preheat reduces annual gas therms vs preheat=none", () => {
    const baseline = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    const withSolar = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      preheat: "solar",
      solarCollectorAreaSqft: 200,
    });
    expect(withSolar.annualGasTherms).toBeLessThan(baseline.annualGasTherms);
    expect(withSolar.annualSolarFraction).toBeGreaterThan(0);
    expect(withSolar.annualSolarFraction).toBeLessThanOrEqual(0.85);
    expect(withSolar.annualPreheatLiftF).toBeGreaterThan(0);
    expect(withSolar.preheatType).toBe("solar");
    // Monthly fractions must all be within [0, 0.85]
    for (const sf of withSolar.monthlySolarFractions) {
      expect(sf).toBeGreaterThanOrEqual(0);
      expect(sf).toBeLessThanOrEqual(0.85);
    }
  });

  it("dwhr-only preheat reduces annual gas therms vs preheat=none", () => {
    const baseline = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    const withDwhr = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      preheat: "dwhr",
      dwhrEffectiveness: 0.55,
      dwhrCoverage: 0.6,
    });
    expect(withDwhr.annualGasTherms).toBeLessThan(baseline.annualGasTherms);
    expect(withDwhr.annualDwhrLiftF).toBeGreaterThan(0);
    // DWHR-only should have zero solar fraction even though preheat is active
    expect(withDwhr.annualSolarFraction).toBe(0);
  });

  it("solar+dwhr saves more therms than either alone", () => {
    const both = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      preheat: "solar+dwhr",
      solarCollectorAreaSqft: 200,
      dwhrEffectiveness: 0.55,
      dwhrCoverage: 0.6,
    });
    const solarOnly = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      preheat: "solar",
      solarCollectorAreaSqft: 200,
    });
    const dwhrOnly = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      preheat: "dwhr",
      dwhrEffectiveness: 0.55,
      dwhrCoverage: 0.6,
    });
    expect(both.annualGasTherms).toBeLessThanOrEqual(solarOnly.annualGasTherms);
    expect(both.annualGasTherms).toBeLessThanOrEqual(dwhrOnly.annualGasTherms);
    // Combined lift respects the 0.95 × ΔT cap
    const ceiling = 0.95 * (both.climate.avgAnnual !== 0
      ? DEFAULT_INPUTS.storageSetpointF - both.effectiveInletF + both.annualPreheatLiftF
      : 1);
    expect(both.annualPreheatLiftF).toBeLessThanOrEqual(ceiling + 0.01);
  });

  it("preheat=none returns sentinel zero values for all preheat fields", () => {
    const r = runCalc({ ...DEFAULT_INPUTS });
    expect(r.preheatType).toBe("none");
    expect(r.annualSolarFraction).toBe(0);
    expect(r.annualDwhrLiftF).toBe(0);
    expect(r.annualPreheatLiftF).toBe(0);
    expect(r.monthlySolarFractions.length).toBe(12);
    for (const sf of r.monthlySolarFractions) {
      expect(sf).toBe(0);
    }
  });

  it("solar lift is larger in summer than in winter (insolation curve)", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      preheat: "solar",
      solarCollectorAreaSqft: 200,
    });
    const jan = r.monthlySolarFractions[0];
    const jul = r.monthlySolarFractions[6];
    expect(jul).toBeGreaterThan(jan);
  });
});

describe("recirc control modes (Phase E)", () => {
  it("demand-controlled produces lower annual energy than continuous (central_gas)", () => {
    const continuous = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      recircControl: "continuous",
    });
    const demand = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      recircControl: "demand",
    });
    expect(demand.annualGasTherms).toBeLessThan(continuous.annualGasTherms);
    expect(demand.recircLossBTUH).toBeLessThan(continuous.recircLossBTUH);
    expect(demand.recircControlMultiplier).toBeCloseTo(0.30, 4);
    expect(continuous.recircControlMultiplier).toBeCloseTo(1.0, 4);
    expect(demand.recircLossSavingsBTUH).toBeGreaterThan(0);
    expect(continuous.recircLossSavingsBTUH).toBe(0);
  });

  it("aquastat falls between time_clock and continuous", () => {
    const continuous = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      recircControl: "continuous",
    });
    const timeClock = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      recircControl: "time_clock",
      timeClockHoursPerDay: 16,
    });
    const aquastat = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      recircControl: "aquastat",
    });
    // time_clock @16hr → 0.50, aquastat → 0.65, continuous → 1.0
    expect(timeClock.recircLossBTUH).toBeLessThan(aquastat.recircLossBTUH);
    expect(aquastat.recircLossBTUH).toBeLessThan(continuous.recircLossBTUH);
  });

  it("non-recirc system (inunit_hpwh) ignores recircControl on totals", () => {
    const a = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "inunit_hpwh",
      recircControl: "continuous",
    });
    const b = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "inunit_hpwh",
      recircControl: "demand",
    });
    // In-unit systems have no recirc loop applied to user-facing fields:
    // multiplier is sentinel zero, savings zero, regardless of mode.
    expect(a.recircControlMultiplier).toBe(0);
    expect(b.recircControlMultiplier).toBe(0);
    expect(a.recircLossSavingsBTUH).toBe(0);
    expect(b.recircLossSavingsBTUH).toBe(0);
    // Annual energy unaffected
    expect(b.monthly.monthlyAnnualEnergy).toBeCloseTo(a.monthly.monthlyAnnualEnergy, 1);
  });

  it("time_clock at 24 hr/day produces a 0.75 multiplier (close to but less than continuous)", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_gas",
      recircControl: "time_clock",
      timeClockHoursPerDay: 24,
    });
    expect(r.recircControlMultiplier).toBeCloseTo(0.75, 4);
    expect(r.recircLossBTUH).toBeCloseTo(r.recircLossRawBTUH * 0.75, 0);
  });

  it("default recircControl is 'continuous' so legacy scenarios match pre-Phase-E values", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    expect(r.recircControl).toBe("continuous");
    expect(r.recircControlMultiplier).toBeCloseTo(1.0, 4);
    expect(r.recircLossBTUH).toBeCloseTo(r.recircLossRawBTUH, 0);
    expect(r.recircLossSavingsBTUH).toBe(0);
  });
});

describe("central_per_floor (Phase F)", () => {
  it("computes per-zone kW + total installed kW, sane positive values", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: "central_per_floor", perFloorZoneCount: 4 });
    expect(r.totalBTUH).toBeGreaterThan(0);
    expect(Number.isNaN(r.totalBTUH)).toBe(false);
    expect(r.perFloorPerZoneKW).toBeGreaterThan(0);
    expect(r.perFloorTotalInstalledKW).toBeGreaterThan(r.perFloorPerZoneKW);
    expect(r.perFloorRecircLossReduction).toBeGreaterThan(0);
    expect(r.autoSize?.recommended).toBeTruthy();
    // Recirc loss is reduced vs single full-length loop (the system-specific
    // invariant of per-floor decentralization)
    expect(r.recircLossBTUH).toBeLessThan(r.recircLossRawBTUH);
    // Pure-electric HPWH: kWh > 0 and reported in kWh.
    expect(r.annualElectricKWh).toBeGreaterThan(0);
    expect(r.monthly.monthlyUnit).toBe("kWh");
  });

  it("more zones means lower recirc loss (system-specific invariant)", () => {
    const z2 = runCalc({ ...DEFAULT_INPUTS, systemType: "central_per_floor", perFloorZoneCount: 2 });
    const z8 = runCalc({ ...DEFAULT_INPUTS, systemType: "central_per_floor", perFloorZoneCount: 8 });
    expect(z8.recircLossBTUH).toBeLessThan(z2.recircLossBTUH);
    expect(z8.perFloorRecircLossReduction).toBeGreaterThan(z2.perFloorRecircLossReduction);
  });

  it("does not leak per-floor fields onto unrelated systems", () => {
    const gas = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    expect(gas.perFloorPerZoneKW).toBe(0);
    expect(gas.perFloorTotalInstalledKW).toBe(0);
    expect(gas.perFloorRecircLossReduction).toBe(0);
  });
});

describe("central_hrc (Phase F)", () => {
  it("computes capacity, coverage, both electric and gas annual streams", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: "central_hrc" });
    expect(r.totalBTUH).toBeGreaterThan(0);
    expect(r.hrcCapacityBTUH).toBeGreaterThan(0);
    expect(r.hrcAnnualContributionBTU).toBeGreaterThan(0);
    expect(r.hrcCoverageFraction).toBeGreaterThan(0);
    expect(r.hrcCoverageFraction).toBeLessThanOrEqual(1);
    // Both electric (HRC) and gas (backup) streams are non-negative
    expect(r.annualHPWHKWh_total).toBeGreaterThanOrEqual(0);
    expect(r.annualGasTherms).toBeGreaterThanOrEqual(0);
    expect(r.autoSize?.recommended).toBeTruthy();
  });

  it("higher year-round cooling fraction means more HRC coverage (system-specific invariant)", () => {
    // Use a small cooling tonnage so the HRC capacity is the binding
    // constraint — otherwise both runs cap at 100% coverage.
    const lowYR = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_hrc",
      hrcCoolingTons: 5,
      hrcYearRoundCoolingFraction: 0.2,
    });
    const highYR = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_hrc",
      hrcCoolingTons: 5,
      hrcYearRoundCoolingFraction: 1.0,
    });
    expect(highYR.hrcCoverageFraction).toBeGreaterThan(lowYR.hrcCoverageFraction);
    expect(highYR.annualGasTherms).toBeLessThan(lowYR.annualGasTherms);
  });

  it("does not leak HRC fields onto unrelated systems", () => {
    const gas = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    expect(gas.hrcCapacityBTUH).toBe(0);
    expect(gas.hrcAnnualContributionBTU).toBe(0);
    expect(gas.hrcCoverageFraction).toBe(0);
  });
});

describe("central_wastewater_hp (Phase F)", () => {
  it("uses configured COP, no air-temp derate, pure-electric annual energy", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: "central_wastewater_hp" });
    expect(r.totalBTUH).toBeGreaterThan(0);
    expect(r.wastewaterEffectiveCOP).toBeCloseTo(DEFAULT_INPUTS.wastewaterCOP, 2);
    expect(r.annualGasTherms).toBe(0);
    expect(r.annualElectricKWh).toBeGreaterThan(0);
    expect(r.autoSize?.recommended).toBeTruthy();
    expect(r.monthly.monthlyUnit).toBe("kWh");
  });

  it("higher wastewater COP means lower annual electric (system-specific invariant)", () => {
    const lowCOP = runCalc({ ...DEFAULT_INPUTS, systemType: "central_wastewater_hp", wastewaterCOP: 3.0 });
    const highCOP = runCalc({ ...DEFAULT_INPUTS, systemType: "central_wastewater_hp", wastewaterCOP: 6.0 });
    expect(highCOP.annualHPWHKWh_total).toBeLessThan(lowCOP.annualHPWHKWh_total);
  });

  it("does not leak wastewater fields onto unrelated systems", () => {
    const gas = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    expect(gas.wastewaterEffectiveCOP).toBe(0);
  });
});

describe("multi-boiler cascade", () => {
  it("4-boiler cascade burns less gas than single-boiler (part-load efficiency bonus)", () => {
    const single = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", boilerCount: 1 });
    const cascade = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", boilerCount: 4 });
    expect(cascade.annualGasTherms).toBeLessThan(single.annualGasTherms);
  });

  it("cascade efficiency bonus caps at 4 boilers", () => {
    const four = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", boilerCount: 4 });
    const eight = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", boilerCount: 8 });
    expect(eight.annualGasTherms).toBeCloseTo(four.annualGasTherms, 0);
  });

  it("cascade premium increases capCost", () => {
    const single = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", boilerCount: 1 });
    const four = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", boilerCount: 4 });
    const singleCap = single.autoSize?.recommended?.capCost ?? 0;
    const fourCap = four.autoSize?.recommended?.capCost ?? 0;
    expect(fourCap).toBeGreaterThan(singleCap);
  });

  it("N+1 redundancy increases capCost vs N at the same boiler count", () => {
    const n = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", boilerCount: 4, cascadeRedundancy: "N" });
    const np1 = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas", boilerCount: 4, cascadeRedundancy: "N+1" });
    const nCap = n.autoSize?.recommended?.capCost ?? 0;
    const np1Cap = np1.autoSize?.recommended?.capCost ?? 0;
    expect(np1Cap).toBeGreaterThan(nCap);
  });

  it("cascade params have no effect on non-cascade-eligible systems (HPWH)", () => {
    const single = runCalc({ ...DEFAULT_INPUTS, systemType: "central_hpwh", boilerCount: 1 });
    const four = runCalc({ ...DEFAULT_INPUTS, systemType: "central_hpwh", boilerCount: 4 });
    expect(four.annualHPWHKWh_total).toBeCloseTo(single.annualHPWHKWh_total, 0);
  });

  it("central_indirect cascade applies efficiency bonus to the boiler side", () => {
    const single = runCalc({ ...DEFAULT_INPUTS, systemType: "central_indirect", boilerCount: 1 });
    const four = runCalc({ ...DEFAULT_INPUTS, systemType: "central_indirect", boilerCount: 4 });
    expect(four.annualGasTherms).toBeLessThan(single.annualGasTherms);
  });
});

describe("Phase G — HPWH source-coupling modifier (ground_loop)", () => {
  it("ground_loop on central_hpwh produces lower annual kWh than air_mech_room in cold climate (monthly model)", () => {
    // CZ7 Duluth — monthly air-coupled mech room dips well below ground-loop
    // temp in winter (Duluth Jan ≈ 37°F vs 50°F ground), so the monthly-
    // aggregated electric energy must be lower for ground-coupled.
    // (The pipeline's `annualHPWHKWh_total` single-COP rollup uses the
    // climate's mechRoomAnnual which is held conservative — typically ≥
    // ground-loop temp — so we compare the monthly aggregation instead,
    // which is what the Energy / Compare tabs actually display.)
    const baseInputs = {
      ...DEFAULT_INPUTS,
      systemType: "central_hpwh" as const,
      climateZone: "7 - Duluth" as const,
      hpwhAmbientF: null,
    };
    const air = runCalc({ ...baseInputs, hpwhSourceMode: "air_mech_room" });
    const ground = runCalc({ ...baseInputs, hpwhSourceMode: "ground_loop" });
    // Monthly-aggregated electric energy (kWh) — this is what users see on
    // the Energy / monthly-model tabs.
    const airMonthlyTotal = air.monthly.monthly.reduce((s, m) => s + m.totalEnergy, 0);
    const groundMonthlyTotal = ground.monthly.monthly.reduce(
      (s, m) => s + m.totalEnergy,
      0,
    );
    expect(groundMonthlyTotal).toBeLessThan(airMonthlyTotal);
    expect(ground.hpwhEffectiveSourceTempF).toBe(50);
  });

  it("ground_loop has NO effect on inunit_hpwh (closet HPWHs always air-coupled)", () => {
    const air = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "inunit_hpwh",
      hpwhSourceMode: "air_mech_room",
    });
    const ground = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "inunit_hpwh",
      hpwhSourceMode: "ground_loop",
    });
    // The pipeline-level `hpwhEffectiveSourceTempF` sentinel must be 0 for
    // the in-unit case (system not eligible for ground-loop override).
    expect(air.hpwhEffectiveSourceTempF).toBe(0);
    expect(ground.hpwhEffectiveSourceTempF).toBe(0);
    // Annual energy must match exactly — no ground-loop override applied.
    expect(ground.annualHPWHKWh_total).toBeCloseTo(air.annualHPWHKWh_total, 4);
  });
});

describe("Phase G — central_chp cogeneration", () => {
  it("central_chp with default inputs produces non-zero chp* result fields", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: "central_chp" });
    expect(r.chpHeatRecoveryBTUH).toBeGreaterThan(0);
    expect(r.chpAnnualRecoveryBTU).toBeGreaterThan(0);
    expect(r.chpAnnualContributionBTU).toBeGreaterThan(0);
    expect(r.chpCoverageFraction).toBeGreaterThan(0);
    expect(r.chpAnnualElectricGeneratedKWh).toBeGreaterThan(0);
    // chpAnnualRecoveryBTU = chpHeatRecoveryBTUH × runHours
    expect(r.chpAnnualRecoveryBTU).toBeCloseTo(
      r.chpHeatRecoveryBTUH * DEFAULT_INPUTS.chpAnnualRunHours,
      0,
    );
    // chpAnnualElectricGeneratedKWh = electric kW × run hours
    expect(r.chpAnnualElectricGeneratedKWh).toBeCloseTo(
      DEFAULT_INPUTS.chpElectricKW * DEFAULT_INPUTS.chpAnnualRunHours,
      0,
    );
  });

  it("central_chp annualGasTherms is significantly less than central_gas at the same load", () => {
    const gas = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    const chp = runCalc({ ...DEFAULT_INPUTS, systemType: "central_chp" });
    // CHP recovers most of the DHW load — annualGasTherms must be at least
    // 30% lower than the equivalent central_gas plant.
    expect(chp.annualGasTherms).toBeLessThan(gas.annualGasTherms * 0.70);
  });

  it("central_chp with chpAnnualRunHours=0 falls back to backup gas only (no CHP contribution)", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_chp",
      chpAnnualRunHours: 0,
    });
    expect(r.chpAnnualContributionBTU).toBe(0);
    expect(r.chpCoverageFraction).toBe(0);
    expect(r.chpAnnualElectricGeneratedKWh).toBe(0);
    // The backup gas should now cover the full annual DHW load — therms
    // should approximately match a central_gas plant at the same load.
    const gas = runCalc({ ...DEFAULT_INPUTS, systemType: "central_gas" });
    expect(r.annualGasTherms).toBeCloseTo(gas.annualGasTherms, 0);
  });

  it("non-CHP systems return chp* fields as 0 (sentinel)", () => {
    const systems = [
      "central_gas",
      "central_hpwh",
      "central_resistance",
      "inunit_hpwh",
      "inunit_gas_tank",
    ] as const;
    for (const sys of systems) {
      const r = runCalc({ ...DEFAULT_INPUTS, systemType: sys });
      expect(r.chpHeatRecoveryBTUH).toBe(0);
      expect(r.chpAnnualRecoveryBTU).toBe(0);
      expect(r.chpAnnualContributionBTU).toBe(0);
      expect(r.chpCoverageFraction).toBe(0);
      expect(r.chpAnnualElectricGeneratedKWh).toBe(0);
    }
  });
});
