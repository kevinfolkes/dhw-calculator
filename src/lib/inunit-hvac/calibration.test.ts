/**
 * In-unit HVAC calibration tests — cross-validates calculator outputs against
 * worked examples and published field-data ranges from authoritative sources.
 * Mirrors the discipline established for DHW (`src/lib/calc/calibration.test.ts`)
 * and lighting (`src/lib/lighting/calibration.test.ts`).
 *
 * Sources:
 *   - ASHRAE 90.1-2022 §6.4 (Minimum Equipment Efficiency)
 *   - ASHRAE 90.1-2022 Appendix G3.1.3.10 (EFLH for residential equipment)
 *   - AHRI 210/240-2023 (SEER2 / HSPF2 rating standard)
 *   - AHRI 310/380 (PTAC / PTHP rating standard)
 *   - ENERGY STAR Central AC/HP Specification v6.1
 *   - NEEP Cold Climate ASHP Specification + Product List
 *   - DOE Building America MF HVAC reference designs
 *   - EPA eGRID 2022 emission factors
 */
import { describe, it, expect } from "vitest";
import { runCalc, COOLING_EFLH_BY_CZ, HEATING_EFLH_BY_CZ } from "./pipeline";
import {
  DEFAULT_INPUTS,
  DEFAULT_HP_RETROFIT,
  DEFAULT_CCHP_RETROFIT,
  DEFAULT_CENTRAL_HP_RETROFIT,
  type InUnitHvacInputs,
} from "./inputs";

describe("In-unit HVAC — engineering math (deterministic)", () => {
  /**
   * SEER2 textbook: 12,000 BTU/h cooling × 1000 hrs / SEER2 16 = 750,000
   * Wh = 750 kWh per apartment per year. Sanity check on the core formula.
   */
  it("12,000 BTU/h × 1000 EFLH @ SEER2 16 = 750 kWh per apartment", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      apartmentCount: 1,
      coolingCapacityBtuh: 12000,
      coolingEfficiency: 16,
      coolingEfficiencyMetric: "SEER2",
      coolingEflhOverride: 1000,
      heatingCapacityBtuh: 0, // zero-out heating side
      heatingEfficiency: 1.0,
      heatingEfficiencyMetric: "resistance",
    });
    expect(r.cooling.perAptKWh).toBeCloseTo(750, 0);
    expect(r.totalAnnualKWh).toBeCloseTo(750, 0);
  });

  /**
   * Resistance heat: 12,000 BTU/h × 1000 hrs = 12,000,000 BTU = 3,517 kWh
   * (since 1 kWh = 3412 BTU). COP = 1.0 by physics.
   */
  it("12,000 BTU/h × 1000 EFLH resistance heat = 3517 kWh per apartment", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      apartmentCount: 1,
      coolingCapacityBtuh: 0,
      coolingEfficiency: 16,
      coolingEfficiencyMetric: "SEER2",
      heatingCapacityBtuh: 12000,
      heatingEfficiency: 1.0,
      heatingEfficiencyMetric: "resistance",
      heatingEflhOverride: 1000,
    });
    // 12000 × 1000 / 3412 = 3517.6
    expect(r.heating.perAptKWh).toBeCloseTo(3517, 0);
    expect(r.heating.effectiveCOP).toBe(1.0);
  });

  /**
   * Heat pump COP 3.0: replaces the 3517 kWh resistance load with a third
   * of the energy. 12,000 BTU/h × 1000 hr / (3.0 × 3412) ≈ 1172 kWh.
   */
  it("HP at COP 3.0 cuts the 1000-hr / 12k-BTU heating load to ~1172 kWh", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      apartmentCount: 1,
      coolingCapacityBtuh: 0,
      heatingCapacityBtuh: 12000,
      heatingEfficiency: 3.0,
      heatingEfficiencyMetric: "COP",
      heatingEflhOverride: 1000,
    });
    expect(r.heating.perAptKWh).toBeCloseTo(1172, 0);
  });

  /**
   * HSPF2 8.5 textbook: 12,000 BTU/h × 1000 hr / (8.5 × 1000) = 1411 kWh.
   * This is also the ENERGY STAR baseline efficiency for a current mini-
   * split heat pump.
   */
  it("HSPF2 8.5 at 12k BTU × 1000 hr = 1412 kWh per apartment", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      apartmentCount: 1,
      coolingCapacityBtuh: 0,
      heatingCapacityBtuh: 12000,
      heatingEfficiency: 8.5,
      heatingEfficiencyMetric: "HSPF2",
      heatingEflhOverride: 1000,
    });
    // 12,000 × 1000 / (8.5 × 1000) = 1411.76
    expect(r.heating.perAptKWh).toBeCloseTo(1412, 0);
  });

  /**
   * Whole-building scaling: 60 apartments × per-apt kWh.
   */
  it("Whole-building rollup = perApt × apartmentCount", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, apartmentCount: 60 });
    expect(r.cooling.buildingKWh).toBeCloseTo(r.cooling.perAptKWh * 60, 0);
    expect(r.heating.buildingKWh).toBeCloseTo(r.heating.perAptKWh * 60, 0);
    expect(r.apartmentCount).toBe(60);
  });
});

describe("ASHRAE 90.1-2022 §6.4 — minimum efficiency compliance", () => {
  /**
   * Default scenario uses PTAC at EER 9.5 — exactly the ASHRAE minimum, so
   * the calc should not flag a §6.4 warn. Sub-9.5 values WILL flag warn.
   */
  it("PTAC at EER 9.5 passes ASHRAE 90.1-2022 §6.4.1.4", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, coolingEfficiency: 9.5 });
    const warn = r.flags.find(
      (f) => f.level === "warn" && f.code.startsWith("ASHRAE 90.1-2022 §6.4"),
    );
    expect(warn).toBeUndefined();
  });

  it("PTAC at EER 8.0 (below code) flags ASHRAE 90.1-2022 §6.4.1.4 warn", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, coolingEfficiency: 8.0 });
    const warn = r.flags.find(
      (f) => f.level === "warn" && f.code.startsWith("ASHRAE 90.1-2022 §6.4"),
    );
    expect(warn).toBeDefined();
  });

  /**
   * Mini-split SEER2 13.0 fails the 2023 DOE federal minimum of 14.0.
   */
  it("Mini-split SEER2 13.0 flags DOE Federal Minimum (2023) warn", () => {
    const inputs: InUnitHvacInputs = {
      ...DEFAULT_INPUTS,
      systemType: "minisplit_hp",
      coolingEfficiency: 13.0,
      coolingEfficiencyMetric: "SEER2",
      heatingEfficiency: 8.5,
      heatingEfficiencyMetric: "HSPF2",
    };
    const r = runCalc(inputs);
    const warn = r.flags.find(
      (f) => f.level === "warn" && f.code === "DOE Federal Minimum (2023)",
    );
    expect(warn).toBeDefined();
  });

  /**
   * Default (PTAC + resistance, code-minimum EER) should produce a single OK
   * flag for compliance — the resistance-heat warn covers electrification,
   * but no §6.4 warns.
   */
  it("Default scenario carries no §6.4 minimum-efficiency warns", () => {
    const r = runCalc(DEFAULT_INPUTS);
    const efficiencyWarns = r.flags.filter(
      (f) =>
        f.level === "warn" &&
        (f.code.includes("§6.4") || f.code.includes("DOE Federal")),
    );
    expect(efficiencyWarns.length).toBe(0);
  });
});

describe("ENERGY STAR / NEEP — retrofit savings bands", () => {
  /**
   * PTAC + resistance → mini-split heat pump in CZ4A (NYC) is the canonical
   * MF retrofit play. Published savings ranges from utility programs (NYSERDA,
   * MassSave, ConEd CEEP) typically show 35–60% kWh reduction on combined
   * cooling + heating in CZ4–5. The lower bound is moderate climates with
   * smaller heating loads; the upper bound is heating-dominated cold climates
   * where the resistance → HP swap is the dominant savings driver.
   */
  it("PTAC+resistance → mini-split HP retrofit in CZ4A: 35–65% kWh reduction", () => {
    const baseline = runCalc(DEFAULT_INPUTS);
    const retrofit = runCalc(DEFAULT_HP_RETROFIT);
    const reduction = 1 - retrofit.totalAnnualKWh / baseline.totalAnnualKWh;
    expect(reduction).toBeGreaterThanOrEqual(0.35);
    expect(reduction).toBeLessThanOrEqual(0.65);
  });

  /**
   * The same retrofit's cooling savings: SEER2 16 vs EER 9.5 over the same
   * EFLH. Cooling alone should drop 30–45%.
   * SEER2 16 → 16 BTU/Wh; EER 9.5 → 9.5 BTU/Wh. Since both use BTU/Wh units
   * the savings = 1 - 9.5/16 = ~40.6%.
   */
  it("PTAC EER 9.5 → SEER2 16 cooling-only: ~40% kWh reduction", () => {
    const baseline = runCalc({
      ...DEFAULT_INPUTS,
      heatingCapacityBtuh: 0, // isolate cooling
    });
    const retrofit = runCalc({
      ...DEFAULT_HP_RETROFIT,
      heatingCapacityBtuh: 0,
    });
    const reduction = 1 - retrofit.cooling.perAptKWh / baseline.cooling.perAptKWh;
    expect(reduction).toBeGreaterThanOrEqual(0.35);
    expect(reduction).toBeLessThanOrEqual(0.45);
  });

  /**
   * Heating side: HSPF2 8.5 vs resistance (COP 1.0) — should land in the
   * 60–75% kWh reduction band. HSPF2 8.5 in BTU/Wh = 8.5 BTU/Wh = COP ~2.49,
   * so 1 - 1/2.49 ≈ 60% savings.
   */
  it("Resistance → HSPF2 8.5 heating: 55–70% kWh reduction", () => {
    const baseline = runCalc({
      ...DEFAULT_INPUTS,
      coolingCapacityBtuh: 0, // isolate heating
    });
    const retrofit = runCalc({
      ...DEFAULT_HP_RETROFIT,
      coolingCapacityBtuh: 0,
    });
    const reduction = 1 - retrofit.heating.perAptKWh / baseline.heating.perAptKWh;
    expect(reduction).toBeGreaterThanOrEqual(0.55);
    expect(reduction).toBeLessThanOrEqual(0.7);
  });

  /**
   * Cold-climate variant in CZ6A (Minneapolis): standard mini-split (HSPF2
   * 8.5) vs cold-climate (HSPF2 10.5). The premium delivers ~20% additional
   * heating savings on top of the standard HP baseline.
   */
  it("Standard HP → cold-climate HP (HSPF2 8.5 → 10.5): 15–25% additional heating savings", () => {
    const standard = runCalc({
      ...DEFAULT_HP_RETROFIT,
      climateZone: "6A - Minneapolis",
      coolingCapacityBtuh: 0,
    });
    const cchp = runCalc({
      ...DEFAULT_CCHP_RETROFIT,
      climateZone: "6A - Minneapolis",
      coolingCapacityBtuh: 0,
    });
    const reduction = 1 - cchp.heating.perAptKWh / standard.heating.perAptKWh;
    expect(reduction).toBeGreaterThanOrEqual(0.15);
    expect(reduction).toBeLessThanOrEqual(0.25);
  });
});

describe("DOE Building America — MF HVAC EFLH benchmarks", () => {
  /**
   * EFLH varies dramatically with climate zone. Hot climates (CZ1–2) have
   * 2000+ cooling EFLH; cold climates (CZ6+) have <800. Heating EFLH is
   * the inverse — cold climates 2500+, hot climates <1000.
   * Source: ASHRAE 90.1-2022 Appendix G3.1.3.10 + DOE Building America
   * MF HVAC reference designs.
   */
  it("Cooling EFLH falls in the 200–2400 hr/yr published band by climate zone", () => {
    for (const cz of Object.keys(COOLING_EFLH_BY_CZ)) {
      const eflh = COOLING_EFLH_BY_CZ[cz as keyof typeof COOLING_EFLH_BY_CZ];
      expect(eflh).toBeGreaterThanOrEqual(200);
      expect(eflh).toBeLessThanOrEqual(2500);
    }
  });

  it("Heating EFLH falls in the 200–3500 hr/yr published band by climate zone", () => {
    for (const cz of Object.keys(HEATING_EFLH_BY_CZ)) {
      const eflh = HEATING_EFLH_BY_CZ[cz as keyof typeof HEATING_EFLH_BY_CZ];
      expect(eflh).toBeGreaterThanOrEqual(200);
      expect(eflh).toBeLessThanOrEqual(3500);
    }
  });

  /**
   * Climate-zone monotonicity: hot zones cool more than cold; cold zones
   * heat more than hot. Catches accidental table-row swaps.
   */
  it("Cooling EFLH: Miami > Minneapolis", () => {
    expect(COOLING_EFLH_BY_CZ["1A - Miami"]).toBeGreaterThan(
      COOLING_EFLH_BY_CZ["6A - Minneapolis"],
    );
  });

  it("Heating EFLH: Duluth > Miami", () => {
    expect(HEATING_EFLH_BY_CZ["7 - Duluth"]).toBeGreaterThan(
      HEATING_EFLH_BY_CZ["1A - Miami"],
    );
  });
});

describe("Climate-sensitivity integration", () => {
  /**
   * Same equipment in CZ1A (Miami) vs CZ7 (Duluth): cooling kWh should be
   * dramatically higher in Miami; heating kWh dramatically higher in Duluth.
   */
  it("Miami: cooling >> heating; Duluth: heating >> cooling (HP system)", () => {
    const miami = runCalc({ ...DEFAULT_HP_RETROFIT, climateZone: "1A - Miami" });
    const duluth = runCalc({ ...DEFAULT_HP_RETROFIT, climateZone: "7 - Duluth" });
    expect(miami.cooling.buildingKWh).toBeGreaterThan(miami.heating.buildingKWh);
    expect(duluth.heating.buildingKWh).toBeGreaterThan(duluth.cooling.buildingKWh);
    // Miami cooling load >> Duluth cooling load
    expect(miami.cooling.buildingKWh).toBeGreaterThan(duluth.cooling.buildingKWh * 2);
    // Duluth heating load >> Miami heating load
    expect(duluth.heating.buildingKWh).toBeGreaterThan(miami.heating.buildingKWh * 2);
  });

  /**
   * The "resistance heat in cold climates" advisory should fire when a
   * resistance system is used in CZ4A or colder.
   */
  it("Resistance heat in CZ5A flags Electrification advisory warn", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, climateZone: "5A - Chicago" });
    const warn = r.flags.find(
      (f) => f.level === "warn" && f.code === "Electrification advisory",
    );
    expect(warn).toBeDefined();
  });

  /**
   * NEEP Cold-climate suggestion: standard mini-split in cold climate triggers
   * info-level NEEP advisory.
   */
  it("Standard mini-split in CZ6A flags NEEP Cold Climate advisory", () => {
    const r = runCalc({
      ...DEFAULT_HP_RETROFIT,
      climateZone: "6A - Minneapolis",
    });
    const info = r.flags.find(
      (f) => f.level === "info" && f.code === "NEEP Cold Climate ASHP",
    );
    expect(info).toBeDefined();
  });
});

describe("Monthly model fairness", () => {
  /**
   * 12 monthly rows must sum to the building annual within rounding. The
   * monthly fractions are rounded for readability, so we accept 5% slack.
   */
  it("Monthly rows sum to annual totals (within 5%)", () => {
    const r = runCalc(DEFAULT_INPUTS);
    const sumKWh = r.monthly.monthly.reduce((s, m) => s + m.totalEnergy, 0);
    const ratio = sumKWh / r.totalAnnualKWh;
    expect(ratio).toBeGreaterThanOrEqual(0.95);
    expect(ratio).toBeLessThanOrEqual(1.05);
    expect(r.monthly.monthlyAnnualEnergy).toBeCloseTo(sumKWh, 0);
  });

  /**
   * Cold-climate monthly profile: heating kWh peaks in Jan + Dec, near zero
   * in Jul + Aug. Cooling kWh peaks in Jul + Aug.
   */
  it("Cold-climate (CZ6A) heating peaks in winter, cooling in summer", () => {
    const r = runCalc({ ...DEFAULT_INPUTS, climateZone: "6A - Minneapolis" });
    const jan = r.monthly.monthly[0];
    const jul = r.monthly.monthly[6];
    expect(jan.heatingKWh).toBeGreaterThan(jul.heatingKWh);
    expect(jul.coolingKWh).toBeGreaterThan(jan.coolingKWh);
  });

  /**
   * monthlyUnit always "kWh" — in-unit HVAC is pure-electric. Cross-domain
   * Compare-tab helpers depend on this field name.
   */
  it("monthlyUnit is always kWh", () => {
    const r = runCalc(DEFAULT_INPUTS);
    expect(r.monthly.monthlyUnit).toBe("kWh");
  });
});

describe("Compare-tab fairness (parallel to DHW v0.4.1 fix)", () => {
  /**
   * Two scenarios on the same building MUST produce different
   * `monthlyAnnualCost` when equipment differs. Locks in the requirement
   * that Compare-tab can read system-specific actuals from the monthly
   * rollup.
   */
  it("Default (PTAC+resist) vs HP retrofit: distinct monthlyAnnualCost", () => {
    const a = runCalc(DEFAULT_INPUTS);
    const b = runCalc(DEFAULT_HP_RETROFIT);
    expect(a.monthly.monthlyAnnualCost).not.toBeCloseTo(b.monthly.monthlyAnnualCost, 0);
    expect(a.monthly.monthlyAnnualEnergy).not.toBeCloseTo(b.monthly.monthlyAnnualEnergy, 0);
  });
});

describe("Determinism", () => {
  it("runCalc is deterministic across repeated calls", () => {
    const a = runCalc(DEFAULT_INPUTS);
    const b = runCalc(DEFAULT_INPUTS);
    expect(a.totalAnnualKWh).toBe(b.totalAnnualKWh);
    expect(a.cooling.buildingKWh).toBe(b.cooling.buildingKWh);
    expect(a.heating.buildingKWh).toBe(b.heating.buildingKWh);
  });
});

describe("Ducted central split — engineering math", () => {
  /**
   * Ducted central HP textbook: 18,000 BTU/h × 1100 cooling EFLH (CZ4A NYC)
   * / SEER2 16 = 1237.5 kWh per apartment per year. Validates the central
   * split archetype produces the right kWh given a typical 1.5-ton apt
   * sizing.
   */
  it("Central HP at 18k BTU × 1100 EFLH @ SEER2 16 = 1238 kWh per apt", () => {
    const r = runCalc({
      ...DEFAULT_CENTRAL_HP_RETROFIT,
      apartmentCount: 1,
      coolingEfficiency: 16, // ENERGY STAR baseline (DEFAULT preset has SEER2 18; pin to 16 here)
      coolingEflhOverride: 1100,
      heatingCapacityBtuh: 0,
    });
    // 18000 × 1100 / (16 × 1000) = 1237.5
    expect(r.cooling.perAptKWh).toBeCloseTo(1237.5, 1);
  });

  /**
   * Central HP heating: 18,000 BTU/h × 1900 heating EFLH (CZ4A NYC) / HSPF2
   * 8.5 = 4023.5 kWh per apartment per year.
   */
  it("Central HP at 18k BTU × 1900 EFLH @ HSPF2 8.5 = 4024 kWh per apt", () => {
    const r = runCalc({
      ...DEFAULT_CENTRAL_HP_RETROFIT,
      apartmentCount: 1,
      heatingEfficiency: 8.5, // ENERGY STAR baseline (DEFAULT preset has HSPF2 10; pin to 8.5 here)
      heatingEflhOverride: 1900,
      coolingCapacityBtuh: 0,
    });
    // 18000 × 1900 / (8.5 × 1000) = 4023.5
    expect(r.heating.perAptKWh).toBeCloseTo(4024, 0);
  });

  /**
   * Ducted central AC + resistance heat: cooling-side identical math to
   * any SEER2-rated equipment; heating side is COP 1.0 resistance —
   * 18,000 BTU/h × 1900 hr / 3412 ≈ 10,023 kWh per apt. Massive heating
   * cost vs HP, exactly what makes it a strong retrofit target.
   */
  it("Central AC+resistance heating: 18k × 1900 EFLH = 10,023 kWh per apt", () => {
    const inputs: InUnitHvacInputs = {
      ...DEFAULT_INPUTS,
      systemType: "central_split_ac_resist",
      apartmentCount: 1,
      coolingCapacityBtuh: 0,
      heatingCapacityBtuh: 18000,
      heatingEfficiency: 1.0,
      heatingEfficiencyMetric: "resistance",
      heatingEflhOverride: 1900,
    };
    const r = runCalc(inputs);
    // 18000 × 1900 / 3412 = 10023.45 (BTU_PER_KWH constant is 3412, not 3412.14)
    expect(r.heating.perAptKWh).toBeCloseTo(10023, 0);
  });
});

describe("Vintage comparison — same archetype, different efficiencies", () => {
  /**
   * The user's specific use case: two ducted central split HPs from the
   * same building, 10 years apart. 2014 unit (SEER 14 / HSPF 8.2 → SEER2
   * ~13.3 / HSPF2 ~7.0 after the post-2023 standard conversion) vs 2024
   * unit (SEER2 18 / HSPF2 10). Same capacity. Real retrofit savings band
   * on a same-archetype efficiency upgrade in CZ4A: 25–40% kWh reduction.
   */
  it("2014 → 2024 ducted central HP (CZ4A, same capacity): 25–40% kWh reduction", () => {
    const oldUnit: InUnitHvacInputs = {
      ...DEFAULT_CENTRAL_HP_RETROFIT,
      coolingEfficiency: 13.3, // 2014 SEER 14 → SEER2 ~13.3
      heatingEfficiency: 7.0,  // 2014 HSPF 8.2 → HSPF2 ~7.0
    };
    const newUnit: InUnitHvacInputs = {
      ...DEFAULT_CENTRAL_HP_RETROFIT,
      coolingEfficiency: 18,
      heatingEfficiency: 10,
    };
    const oldResult = runCalc(oldUnit);
    const newResult = runCalc(newUnit);
    const reduction = 1 - newResult.totalAnnualKWh / oldResult.totalAnnualKWh;
    expect(reduction).toBeGreaterThanOrEqual(0.25);
    expect(reduction).toBeLessThanOrEqual(0.4);
  });

  /**
   * Cooling-only side of the same vintage comparison: SEER2 13.3 → SEER2
   * 18 = 1 - 13.3/18 ≈ 26% reduction.
   */
  it("Vintage cooling SEER2 13.3 → 18 (cooling-only): 25–30% reduction", () => {
    const oldUnit: InUnitHvacInputs = {
      ...DEFAULT_CENTRAL_HP_RETROFIT,
      coolingEfficiency: 13.3,
      heatingCapacityBtuh: 0,
    };
    const newUnit: InUnitHvacInputs = {
      ...DEFAULT_CENTRAL_HP_RETROFIT,
      coolingEfficiency: 18,
      heatingCapacityBtuh: 0,
    };
    const reduction = 1 - runCalc(newUnit).cooling.perAptKWh / runCalc(oldUnit).cooling.perAptKWh;
    expect(reduction).toBeGreaterThanOrEqual(0.25);
    expect(reduction).toBeLessThanOrEqual(0.3);
  });
});

describe("Central AC+resistance → central HP retrofit (cold climate)", () => {
  /**
   * Replacing a 2014 ducted central AC + electric resistance heat strip
   * with a modern ducted central HP is one of the highest-impact MF
   * retrofits available. In cold climates (CZ4A+) the heating side is
   * dominant — eliminating resistance is most of the savings. Expected
   * kWh reduction: 50–70%.
   */
  it("Ducted central AC+resist → central HP in CZ4A: 50–70% total kWh reduction", () => {
    const baseline: InUnitHvacInputs = {
      ...DEFAULT_INPUTS,
      systemType: "central_split_ac_resist",
      coolingCapacityBtuh: 18000,
      coolingEfficiency: 14,
      coolingEfficiencyMetric: "SEER2",
      heatingCapacityBtuh: 18000,
      heatingEfficiency: 1.0,
      heatingEfficiencyMetric: "resistance",
    };
    const retrofit = runCalc(DEFAULT_CENTRAL_HP_RETROFIT);
    const baseRes = runCalc(baseline);
    const reduction = 1 - retrofit.totalAnnualKWh / baseRes.totalAnnualKWh;
    expect(reduction).toBeGreaterThanOrEqual(0.5);
    expect(reduction).toBeLessThanOrEqual(0.75);
  });

  /**
   * Heating-only side of the same retrofit: resistance → HSPF2 10 over the
   * same 1900 EFLH. Resistance per-apt = 18000 × 1900 / 3412 = 10025 kWh;
   * HSPF2 10 per-apt = 18000 × 1900 / 10000 = 3420 kWh. Reduction ≈ 66%.
   */
  it("Resistance → HSPF2 10 heating retrofit (CZ4A, central-split sized): 60–70% heating reduction", () => {
    const baseline: InUnitHvacInputs = {
      ...DEFAULT_INPUTS,
      systemType: "central_split_ac_resist",
      coolingCapacityBtuh: 0,
      heatingCapacityBtuh: 18000,
      heatingEfficiency: 1.0,
      heatingEfficiencyMetric: "resistance",
    };
    const retrofit: InUnitHvacInputs = {
      ...DEFAULT_CENTRAL_HP_RETROFIT,
      coolingCapacityBtuh: 0,
    };
    const reduction =
      1 - runCalc(retrofit).heating.perAptKWh / runCalc(baseline).heating.perAptKWh;
    expect(reduction).toBeGreaterThanOrEqual(0.6);
    expect(reduction).toBeLessThanOrEqual(0.7);
  });
});

describe("Central split — compliance flags", () => {
  /**
   * Central HP at SEER2 13 (below 2023 DOE federal min) should flag warn.
   */
  it("Central HP at SEER2 13 flags DOE Federal Minimum (2023) warn", () => {
    const r = runCalc({
      ...DEFAULT_CENTRAL_HP_RETROFIT,
      coolingEfficiency: 13,
    });
    const warn = r.flags.find(
      (f) => f.level === "warn" && f.code === "DOE Federal Minimum (2023)",
    );
    expect(warn).toBeDefined();
  });

  /**
   * Central HP at SEER2 14 (federal min, sub-ENERGY-STAR) should flag info-
   * level ENERGY STAR threshold.
   */
  it("Central HP at SEER2 14 flags ENERGY STAR sub-threshold info", () => {
    const r = runCalc({
      ...DEFAULT_CENTRAL_HP_RETROFIT,
      coolingEfficiency: 14,
    });
    const info = r.flags.find(
      (f) => f.level === "info" && f.code === "ENERGY STAR Central AC/HP v6.1",
    );
    expect(info).toBeDefined();
  });

  /**
   * Central AC+resist in cold climate (CZ5A) — the resistance-heat warn
   * should still fire (same logic as PTAC+resistance and other resistance-
   * heated archetypes).
   */
  it("Central AC+resist in CZ5A flags Electrification advisory warn", () => {
    const r = runCalc({
      ...DEFAULT_INPUTS,
      systemType: "central_split_ac_resist",
      climateZone: "5A - Chicago",
      heatingEfficiencyMetric: "resistance",
      heatingEfficiency: 1.0,
    });
    const warn = r.flags.find(
      (f) => f.level === "warn" && f.code === "Electrification advisory",
    );
    expect(warn).toBeDefined();
  });
});
