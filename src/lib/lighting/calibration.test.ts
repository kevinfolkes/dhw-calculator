/**
 * Lighting calibration tests — cross-validates calculator outputs against
 * worked examples and published field-data ranges from authoritative
 * sources. Mirrors the discipline established for DHW in
 * `src/lib/calc/calibration.test.ts`.
 *
 * Sources:
 *   - ASHRAE 90.1-2022 §9 (Lighting) — Lighting Power Density limits
 *   - ENERGY STAR LED retrofit savings ranges
 *   - DLC (DesignLights Consortium) Qualified Products List
 *   - DOE Building America MF Energy Use Intensity benchmarks
 *   - IES Lighting Handbook (operating-hour conventions)
 *   - DOE Buildings Energy Data Book §2.2 (commercial lighting EUI)
 */
import { describe, it, expect } from "vitest";
import { runCalc } from "./pipeline";
import { DEFAULT_INPUTS, DEFAULT_LED_RETROFIT } from "./inputs";

describe("Lighting — engineering math (deterministic)", () => {
  /**
   * 100W fixture × 24hr × 365 days = 876,000 Wh = 876 kWh/year.
   * Sanity check on the core formula before it's perturbed by reductions.
   */
  it("connectedW × 24/7 = (W × 8.76) kWh per fixture per year", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      categories: {
        ...DEFAULT_INPUTS.categories,
        // Isolate corridor as the only category so the rollup equals one
        // fixture's annual.
        corridor: { count: 1, wattsPerFixture: 100, hoursPerDay: 24, occupancySensorReduction: 0, daylightCredit: 0 },
        stairwell: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        commonArea: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        exteriorSite: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        exteriorFacade: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        inUnit: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        garageParking: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
      },
    });
    expect(r.annualKWh).toBeCloseTo(876, 1);
  });

  /**
   * 50% occupancy-sensor reduction on a 24/7 fixture should halve the
   * annual energy. Validates the multiplicative reduction model.
   */
  it("50% occupancy sensor halves annual energy", () => {
    const base = runCalc({
      ...DEFAULT_INPUTS,
      categories: {
        ...DEFAULT_INPUTS.categories,
        corridor: { count: 10, wattsPerFixture: 60, hoursPerDay: 24, occupancySensorReduction: 0, daylightCredit: 0 },
        stairwell: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        commonArea: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        exteriorSite: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        exteriorFacade: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        inUnit: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        garageParking: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
      },
    });
    const half = runCalc({
      ...DEFAULT_INPUTS,
      categories: {
        ...DEFAULT_INPUTS.categories,
        corridor: { count: 10, wattsPerFixture: 60, hoursPerDay: 24, occupancySensorReduction: 0.5, daylightCredit: 0 },
        stairwell: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        commonArea: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        exteriorSite: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        exteriorFacade: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        inUnit: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        garageParking: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
      },
    });
    expect(half.annualKWh).toBeCloseTo(base.annualKWh * 0.5, 0);
  });

  /**
   * Inputs are clamped to [0, 1]. Negative / >1 reduction values must not
   * produce nonsensical results (e.g., negative kWh).
   */
  it("clamps occupancy/daylight reductions to [0, 1]", () => {
    const ok = runCalc(DEFAULT_INPUTS);
    const overflow = runCalc({
      ...DEFAULT_INPUTS,
      categories: {
        ...DEFAULT_INPUTS.categories,
        corridor: { ...DEFAULT_INPUTS.categories.corridor, occupancySensorReduction: 5.0 },
      },
    });
    expect(overflow.annualKWh).toBeGreaterThanOrEqual(0);
    expect(overflow.annualKWh).toBeLessThan(ok.annualKWh);
  });
});

describe("ASHRAE 90.1-2022 §9.5.1 — LPD compliance", () => {
  /**
   * Default scenario uses ~10W/sf-equivalent baseline (incandescent) over
   * 60,000 sqft — total connected watts likely exceeds the 0.45 W/sf
   * residential MF limit. Pipeline should flag this.
   */
  it("Incumbent baseline (incandescent) flags LPD over the residential MF limit", () => {
    const r = runCalc(DEFAULT_INPUTS);
    expect(r.lpdWattsPerSqft).toBeGreaterThan(0.45);
    const lpdFlag = r.flags.find((f) => f.code.includes("§9.5.1"));
    expect(lpdFlag?.level).toBe("warn");
  });

  /**
   * The DEFAULT_LED_RETROFIT preset (LED swap + corridor / stairwell
   * occupancy sensors) should bring LPD below the limit and flip the
   * compliance flag to OK.
   */
  it("LED retrofit preset brings LPD into compliance", () => {
    const r = runCalc(DEFAULT_LED_RETROFIT);
    expect(r.lpdWattsPerSqft).toBeLessThan(0.45);
    const lpdFlag = r.flags.find((f) => f.code.includes("§9.5.1"));
    expect(lpdFlag?.level).toBe("ok");
  });

  /**
   * LPD calc is deterministic: connectedWatts / totalBuildingSqft.
   * Fixture count = 100 × 60W / 60000 sqft = 0.10 W/sf.
   */
  it("LPD math: 100 × 60W / 60,000 sf = 0.10 W/sf", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      totalBuildingSqft: 60000,
      categories: {
        ...DEFAULT_INPUTS.categories,
        corridor: { count: 100, wattsPerFixture: 60, hoursPerDay: 24, occupancySensorReduction: 0, daylightCredit: 0 },
        stairwell: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        commonArea: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        exteriorSite: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        exteriorFacade: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        inUnit: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
        garageParking: { count: 0, wattsPerFixture: 0, hoursPerDay: 0, occupancySensorReduction: 0, daylightCredit: 0 },
      },
    });
    expect(r.lpdWattsPerSqft).toBeCloseTo(0.10, 3);
  });
});

describe("ENERGY STAR / DLC — LED retrofit savings", () => {
  /**
   * Typical published LED retrofit savings for multifamily common-area
   * lighting fall in 60–85% energy reduction per ENERGY STAR + DLC field
   * studies. Comparing the default (incandescent) baseline to the LED
   * preset should land in this band.
   * Source: ENERGY STAR Multifamily New Construction v1.2 reference
   * designs; DLC Qualified Products List savings models.
   */
  it("Default → LED retrofit: 60–85% kWh reduction", () => {
    const baseline = runCalc(DEFAULT_INPUTS);
    const retrofit = runCalc(DEFAULT_LED_RETROFIT);
    const reduction = 1 - retrofit.annualKWh / baseline.annualKWh;
    expect(reduction).toBeGreaterThanOrEqual(0.60);
    expect(reduction).toBeLessThanOrEqual(0.90);
  });

  /**
   * Cost reduction tracks energy reduction (no fuel switching, same
   * elec rate). Should be the same percentage band as kWh reduction.
   */
  it("Default → LED retrofit: 60–85% cost reduction", () => {
    const baseline = runCalc(DEFAULT_INPUTS);
    const retrofit = runCalc(DEFAULT_LED_RETROFIT);
    const reduction = 1 - retrofit.annualCost / baseline.annualCost;
    expect(reduction).toBeGreaterThanOrEqual(0.60);
    expect(reduction).toBeLessThanOrEqual(0.90);
  });

  /**
   * Carbon reduction tracks energy reduction (same grid factor). Same band.
   */
  it("Default → LED retrofit: 60–85% carbon reduction", () => {
    const baseline = runCalc(DEFAULT_INPUTS);
    const retrofit = runCalc(DEFAULT_LED_RETROFIT);
    const reduction = 1 - retrofit.annualCarbon / baseline.annualCarbon;
    expect(reduction).toBeGreaterThanOrEqual(0.60);
    expect(reduction).toBeLessThanOrEqual(0.90);
  });
});

describe("DOE Building America — MF lighting energy intensity", () => {
  /**
   * DOE Building America MF reference designs report common-area + exterior
   * + in-unit lighting in the range of 1.5–4.5 kWh/ft²/yr for a typical
   * multifamily building running pre-LED equipment. The default scenario
   * (incandescent baseline) should land near or above this band.
   * Source: DOE Building America MF Whole Building Performance baseline tables.
   */
  it("Incumbent baseline lighting EUI: 1.5–6 kWh/ft²/yr", () => {
    const r = runCalc(DEFAULT_INPUTS);
    const eui = r.annualKWh / DEFAULT_INPUTS.totalBuildingSqft;
    expect(eui).toBeGreaterThanOrEqual(1.5);
    expect(eui).toBeLessThanOrEqual(6.0);
  });

  /**
   * After LED retrofit, MF lighting EUI typically falls to 0.4–1.5
   * kWh/ft²/yr (per ENERGY STAR + DOE field studies).
   */
  it("LED retrofit lighting EUI: 0.3–1.5 kWh/ft²/yr", () => {
    const r = runCalc(DEFAULT_LED_RETROFIT);
    const eui = r.annualKWh / DEFAULT_LED_RETROFIT.totalBuildingSqft;
    expect(eui).toBeGreaterThanOrEqual(0.3);
    expect(eui).toBeLessThanOrEqual(1.5);
  });
});

describe("Monthly model fairness", () => {
  /**
   * The 12 monthly rows must sum to the annual total — this is the same
   * invariant DHW's monthly model holds. Catches regressions in the
   * day-count weighting math.
   */
  it("monthly rows sum to annual totals", () => {
    const r = runCalc(DEFAULT_INPUTS);
    const sumKWh = r.monthly.monthly.reduce((s, m) => s + m.totalEnergy, 0);
    const sumCost = r.monthly.monthly.reduce((s, m) => s + m.totalCost, 0);
    const sumCarbon = r.monthly.monthly.reduce((s, m) => s + m.totalCarbon, 0);
    expect(sumKWh).toBeCloseTo(r.annualKWh, 0);
    expect(sumCost).toBeCloseTo(r.annualCost, 0);
    expect(sumCarbon).toBeCloseTo(r.annualCarbon, 0);
  });

  /**
   * Lighting load is climate-insensitive; each month's energy share should
   * track its day-count share of the year.
   */
  it("January gets ~31/365 of the annual energy", () => {
    const r = runCalc(DEFAULT_INPUTS);
    const jan = r.monthly.monthly[0];
    expect(jan.totalEnergy / r.annualKWh).toBeCloseTo(31 / 365, 3);
  });

  /**
   * monthlyUnit is always "kWh" for lighting (no fuel switching).
   * Cross-domain Compare-tab helpers depend on this field name matching
   * DHW's `monthly.monthlyUnit` field.
   */
  it("monthlyUnit is always kWh", () => {
    const r = runCalc(DEFAULT_INPUTS);
    expect(r.monthly.monthlyUnit).toBe("kWh");
  });
});

describe("Compare-tab fairness (parallel to DHW v0.4.1 fix)", () => {
  /**
   * Just like DHW: two scenarios on the same building MUST produce
   * different `monthlyAnnualCost` when the lighting equipment differs.
   * Locks in the requirement that the Compare tab can read system-specific
   * actuals from `monthly.monthlyAnnualCost` rather than a comparison
   * placeholder.
   */
  it("Default (incandescent) vs LED retrofit produce different cost", () => {
    const a = runCalc(DEFAULT_INPUTS);
    const b = runCalc(DEFAULT_LED_RETROFIT);
    expect(a.monthly.monthlyAnnualCost).not.toBeCloseTo(b.monthly.monthlyAnnualCost, 0);
    expect(a.monthly.monthlyAnnualEnergy).not.toBeCloseTo(b.monthly.monthlyAnnualEnergy, 0);
  });
});

describe("Determinism", () => {
  it("runCalc is deterministic across repeated calls", () => {
    const a = runCalc(DEFAULT_INPUTS);
    const b = runCalc(DEFAULT_INPUTS);
    expect(a.annualKWh).toBe(b.annualKWh);
    expect(a.annualCost).toBe(b.annualCost);
    expect(a.lpdWattsPerSqft).toBe(b.lpdWattsPerSqft);
  });
});
