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
