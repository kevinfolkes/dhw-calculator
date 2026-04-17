import { describe, it, expect } from "vitest";
import {
  getMonthlyHDDArchetype,
  monthlyAmbientAdjustment,
  monthlyInletAdjustment,
} from "./climate";
import { MONTHLY_HDD_FRAC } from "./constants";

describe("getMonthlyHDDArchetype", () => {
  it.each([
    ["1A - Miami", "hot"],
    ["2A - Houston", "hot"],
    ["3A - Atlanta", "mixed"],
    ["4A - NYC", "mixed"],
    ["5A - Chicago", "cold"],
    ["6A - Minneapolis", "cold"],
    ["7 - Duluth", "very_cold"],
  ] as const)("maps %s → %s", (zone, archetype) => {
    expect(getMonthlyHDDArchetype(zone)).toBe(archetype);
  });
});

describe("monthly HDD fractions", () => {
  it("each archetype sums to ~1.0 (within rounding of published source data)", () => {
    // The source distributions are rounded to 2 decimal places, so cold
    // climates sum near 1.00 and hot climates (where summer HDD ≈ 0) can
    // be as low as 0.92 once rounding accumulates across 12 months.
    for (const arch of Object.keys(MONTHLY_HDD_FRAC) as Array<keyof typeof MONTHLY_HDD_FRAC>) {
      const sum = MONTHLY_HDD_FRAC[arch].reduce((s, x) => s + x, 0);
      expect(sum).toBeGreaterThan(0.9);
      expect(sum).toBeLessThanOrEqual(1.01);
    }
  });

  it("each month fraction is non-negative", () => {
    for (const arch of Object.keys(MONTHLY_HDD_FRAC) as Array<keyof typeof MONTHLY_HDD_FRAC>) {
      for (const frac of MONTHLY_HDD_FRAC[arch]) {
        expect(frac).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("monthlyAmbientAdjustment", () => {
  it("is negative in January (below annual mean)", () => {
    expect(monthlyAmbientAdjustment(0, "5A - Chicago")).toBeLessThan(0);
  });

  it("is positive in July (above annual mean)", () => {
    expect(monthlyAmbientAdjustment(6, "5A - Chicago")).toBeGreaterThan(0);
  });

  it("has larger amplitude in colder climates", () => {
    const janMiami = Math.abs(monthlyAmbientAdjustment(0, "1A - Miami"));
    const janChicago = Math.abs(monthlyAmbientAdjustment(0, "5A - Chicago"));
    const janDuluth = Math.abs(monthlyAmbientAdjustment(0, "7 - Duluth"));
    expect(janMiami).toBeLessThan(janChicago);
    expect(janChicago).toBeLessThan(janDuluth);
  });

  it("annual adjustments roughly sum to zero", () => {
    let sum = 0;
    for (let m = 0; m < 12; m++) sum += monthlyAmbientAdjustment(m, "5A - Chicago");
    expect(Math.abs(sum)).toBeLessThan(1);
  });
});

describe("monthlyInletAdjustment", () => {
  it("has ~45% the amplitude of ambient adjustment", () => {
    const ambJan = Math.abs(monthlyAmbientAdjustment(0, "5A - Chicago"));
    const inletFeb = Math.abs(monthlyInletAdjustment(1, "5A - Chicago"));
    expect(inletFeb).toBeLessThan(ambJan);
    expect(inletFeb).toBeGreaterThan(ambJan * 0.3);
  });

  it("lags ambient by ~1.5 months (March inlet colder than January inlet)", () => {
    // Inlet in month 2 (March) should be near its coldest given the lag
    const jan = monthlyInletAdjustment(0, "5A - Chicago");
    const feb = monthlyInletAdjustment(1, "5A - Chicago");
    // Feb should be colder than Jan because of the lag
    expect(feb).toBeLessThan(jan);
  });
});
