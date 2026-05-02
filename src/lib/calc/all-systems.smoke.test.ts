/**
 * Smoke-test sweep across every system type. Asserts that runCalc produces
 * finite, non-negative values for the most-relied-on outputs and that
 * auto-size returns a non-null recommendation. Intended as a regression
 * fence for taxonomy expansion — adding a new SystemTypeKey forces this
 * sweep to consider it.
 */
import { describe, it, expect } from "vitest";
import { runCalc } from "./pipeline";
import { DEFAULT_INPUTS } from "./inputs";
import { SYSTEM_TYPE_KEYS } from "@/lib/engineering/system-types";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

describe("all system types (smoke sweep)", () => {
  for (const sys of SYSTEM_TYPE_KEYS) {
    describe(sys, () => {
      const r = runCalc({ ...DEFAULT_INPUTS, systemType: sys });

      it("does not throw", () => {
        expect(r).toBeTruthy();
      });

      it("totalUnits and peakHourDemand are positive finite", () => {
        expect(isFiniteNumber(r.totalUnits)).toBe(true);
        expect(r.totalUnits).toBeGreaterThan(0);
        expect(isFiniteNumber(r.peakHourDemand)).toBe(true);
        expect(r.peakHourDemand).toBeGreaterThan(0);
      });

      it("totalBTUH is positive finite", () => {
        expect(isFiniteNumber(r.totalBTUH)).toBe(true);
        expect(r.totalBTUH).toBeGreaterThan(0);
      });

      it("autoSize.recommended is defined and finite", () => {
        const auto = r.autoSize;
        expect(auto).not.toBeNull();
        if (!auto) return;
        const rec = auto.recommended;
        expect(rec).toBeDefined();
        if (!rec) return;
        expect(isFiniteNumber(rec.capCost)).toBe(true);
        expect(rec.capCost).toBeGreaterThan(0);
        expect(isFiniteNumber(rec.annCost)).toBe(true);
        expect(rec.annCost).toBeGreaterThanOrEqual(0);
      });

      it("monthly model has 12 rows and finite totals", () => {
        expect(r.monthly.monthly.length).toBe(12);
        for (const m of r.monthly.monthly) {
          expect(isFiniteNumber(m.totalEnergy)).toBe(true);
          expect(m.totalEnergy).toBeGreaterThanOrEqual(0);
          expect(isFiniteNumber(m.totalCost)).toBe(true);
          expect(m.totalCost).toBeGreaterThanOrEqual(0);
          expect(isFiniteNumber(m.totalCarbon)).toBe(true);
          expect(m.totalCarbon).toBeGreaterThanOrEqual(0);
        }
        expect(isFiniteNumber(r.monthly.monthlyAnnualEnergy)).toBe(true);
        // For most systems annual energy is strictly positive. The lone
        // exception is `central_chp` when CHP recovery fully covers the
        // DHW load — by spec, only backup gas is counted as DHW-attributable
        // (the CHP fuel itself is on the building electric account), so
        // monthly therms can be zero. Allow zero in that specific case.
        if (sys === "central_chp" && r.chpCoverageFraction >= 0.999) {
          expect(r.monthly.monthlyAnnualEnergy).toBeGreaterThanOrEqual(0);
        } else {
          expect(r.monthly.monthlyAnnualEnergy).toBeGreaterThan(0);
        }
      });

      it("flags is an array (no broken compliance check)", () => {
        expect(Array.isArray(r.flags)).toBe(true);
      });

      it("effectiveInletF resolves to a sane value", () => {
        expect(isFiniteNumber(r.effectiveInletF)).toBe(true);
        expect(r.effectiveInletF).toBeGreaterThan(20);
        expect(r.effectiveInletF).toBeLessThan(90);
      });
    });
  }
});
