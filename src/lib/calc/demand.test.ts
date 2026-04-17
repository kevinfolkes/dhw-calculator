import { describe, it, expect } from "vitest";
import { computeDemand } from "./demand";

const baseline = {
  unitsStudio: 0,
  units1BR: 20,
  units2BR: 30,
  units3BR: 10,
  occupancyProfile: "medium" as const,
  occupantsPerUnit: { br0: 1.0, br1: 1.5, br2: 2.5, br3: 3.5 },
  gpcd: 20,
};

describe("computeDemand", () => {
  it("ASHRAE medium / 60 units ≈ 720 GPH peak hour (12.0 × 60)", () => {
    const r = computeDemand({ ...baseline, demandMethod: "ashrae" });
    expect(r.peakHourGPH).toBeCloseTo(720, 0);
  });

  it("all three demand methods return positive peak-hour values for a populated building", () => {
    const ashrae = computeDemand({ ...baseline, demandMethod: "ashrae" });
    const hunter = computeDemand({ ...baseline, demandMethod: "hunter" });
    const occ = computeDemand({ ...baseline, demandMethod: "occupancy" });
    expect(ashrae.peakHourGPH).toBeGreaterThan(0);
    expect(hunter.peakHourGPH).toBeGreaterThan(0);
    expect(occ.peakHourGPH).toBeGreaterThan(0);
  });

  it("diversity factor decreases with building size", () => {
    const small = computeDemand({ ...baseline, units1BR: 2, units2BR: 2, units3BR: 1, demandMethod: "hunter" });
    const large = computeDemand({ ...baseline, units1BR: 100, units2BR: 200, units3BR: 50, demandMethod: "hunter" });
    expect(small.diversityFactor).toBeGreaterThan(large.diversityFactor);
  });

  it("occupancy method: 60 units × (1.5+2.5+3.5 weighted) × 20 gpcd, 25% peak", () => {
    const r = computeDemand({ ...baseline, demandMethod: "occupancy" });
    const expectedOccupants = 20 * 1.5 + 30 * 2.5 + 10 * 3.5;
    expect(r.totalOccupants).toBe(expectedOccupants);
    expect(r.peakHourGPH).toBeCloseTo(expectedOccupants * 20 * 0.25, 0);
  });
});
