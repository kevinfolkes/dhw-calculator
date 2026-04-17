import { describe, it, expect } from "vitest";
import { huntersGPM } from "./hunter";

describe("huntersGPM", () => {
  it("returns 0 for zero or negative WSFU", () => {
    expect(huntersGPM(0)).toBe(0);
    expect(huntersGPM(-5)).toBe(0);
  });

  it("modified curve is lower than classical at every sample point", () => {
    for (const wsfu of [1, 10, 50, 200, 800]) {
      expect(huntersGPM(wsfu, true)).toBeLessThan(huntersGPM(wsfu, false));
    }
  });

  it("modified curve matches known ASPE points within ±5%", () => {
    // Spot checks calibrated to published piecewise fits
    expect(huntersGPM(1, true)).toBeCloseTo(3.3, 1);
    expect(huntersGPM(20, true)).toBeCloseTo(16.05, 1);
    expect(huntersGPM(100, true)).toBeCloseTo(37, 0);
  });

  it("classical curve matches the piecewise fit within ±1 GPM at sample points", () => {
    expect(huntersGPM(1, false)).toBeCloseTo(4.2, 0);
    expect(huntersGPM(20, false)).toBeCloseTo(24, 0);
    expect(huntersGPM(100, false)).toBeCloseTo(53, 0);
  });

  it("is monotonically non-decreasing with WSFU", () => {
    let prev = 0;
    for (let wsfu = 0; wsfu <= 1000; wsfu += 25) {
      const gpm = huntersGPM(wsfu, true);
      expect(gpm).toBeGreaterThanOrEqual(prev);
      prev = gpm;
    }
  });
});
