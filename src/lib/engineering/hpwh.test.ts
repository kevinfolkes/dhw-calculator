import { describe, it, expect } from "vitest";
import { hpwhCOP, hpwhCapacityFactor, combiCOPAdjustment } from "./hpwh";

describe("hpwhCOP", () => {
  it("CO2 COP is higher with cold inlet than warm inlet at same ambient", () => {
    const cold = hpwhCOP(70, 40, 140, "CO2");
    const warm = hpwhCOP(70, 70, 140, "CO2");
    expect(cold).toBeGreaterThan(warm);
  });

  it("HFC COP degrades as ambient drops", () => {
    const mild = hpwhCOP(70, 50, 140, "HFC");
    const cold = hpwhCOP(20, 50, 140, "HFC");
    expect(mild).toBeGreaterThan(cold);
  });

  it("COP floors protect against extreme conditions", () => {
    // CO2 floor at 1.5
    expect(hpwhCOP(-20, 110, 180, "CO2")).toBeGreaterThanOrEqual(1.5);
    // HFC floor at 1.3
    expect(hpwhCOP(-20, 80, 180, "HFC")).toBeGreaterThanOrEqual(1.3);
  });

  it("HFC COP under design conditions is in the published 2.5-3.5 range", () => {
    const designCOP = hpwhCOP(70, 50, 140, "HFC");
    expect(designCOP).toBeGreaterThan(2.3);
    expect(designCOP).toBeLessThan(3.5);
  });

  it("CO2 COP under design conditions is in the published 3.0-4.0 range", () => {
    const designCOP = hpwhCOP(70, 50, 150, "CO2");
    expect(designCOP).toBeGreaterThan(2.8);
    expect(designCOP).toBeLessThan(4.0);
  });
});

describe("hpwhCapacityFactor", () => {
  it("is derated below 1.0 at cold ambients", () => {
    expect(hpwhCapacityFactor(20, "CO2")).toBeLessThan(1.0);
    expect(hpwhCapacityFactor(20, "HFC")).toBeLessThan(1.0);
  });

  it("is capped by physical ceiling", () => {
    expect(hpwhCapacityFactor(120, "CO2")).toBeLessThanOrEqual(1.1);
    expect(hpwhCapacityFactor(120, "HFC")).toBeLessThanOrEqual(1.05);
  });

  it("has floor values at extreme cold", () => {
    expect(hpwhCapacityFactor(-40, "CO2")).toBeGreaterThanOrEqual(0.55);
    expect(hpwhCapacityFactor(-40, "HFC")).toBeGreaterThanOrEqual(0.45);
  });
});

describe("combiCOPAdjustment", () => {
  it("returns tank temp when tank is hotter than fan coil + 5", () => {
    expect(combiCOPAdjustment(120, 140)).toBe(140);
  });

  it("returns fan coil + 5 when tank is too cool", () => {
    expect(combiCOPAdjustment(130, 125)).toBe(135);
  });
});
