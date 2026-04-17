import { describe, it, expect } from "vitest";
import {
  ASHRAE_APT_DEMAND,
  GRID_EF,
  CLIMATE_DESIGN,
  HPWH_TANK_FHR,
  GAS_TANK_WH,
  GAS_TANKLESS_WH,
  ENVELOPE_PRESETS,
  NG_LB_CO2_PER_THERM,
} from "./constants";

describe("ASHRAE_APT_DEMAND", () => {
  it("peak hour < peak day < no wait — ordering sanity", () => {
    for (const key of ["low", "medium", "high"] as const) {
      const p = ASHRAE_APT_DEMAND[key];
      expect(p.mh).toBeLessThan(p.md);
      expect(p.avg).toBeLessThan(p.md);
    }
  });

  it("usage profiles are monotonically increasing in peak demand", () => {
    expect(ASHRAE_APT_DEMAND.low.mh).toBeLessThan(ASHRAE_APT_DEMAND.medium.mh);
    expect(ASHRAE_APT_DEMAND.medium.mh).toBeLessThan(ASHRAE_APT_DEMAND.high.mh);
  });
});

describe("GRID_EF", () => {
  it("upstate NY (hydro-heavy) has the lowest factor", () => {
    const values = Object.entries(GRID_EF).filter(([k]) => k !== "Custom").map(([, v]) => v);
    const min = Math.min(...values);
    expect(GRID_EF["NYUP (Upstate NY)"]).toBe(min);
  });

  it("Rocky Mtn Power Area (coal-heavy) has highest factor", () => {
    const values = Object.entries(GRID_EF).filter(([k]) => k !== "Custom").map(([, v]) => v);
    const max = Math.max(...values);
    expect(GRID_EF["RMPA (Rockies)"]).toBe(max);
  });
});

describe("NG_LB_CO2_PER_THERM", () => {
  it("matches EPA 11.7 lb/therm", () => {
    expect(NG_LB_CO2_PER_THERM).toBe(11.7);
  });
});

describe("CLIMATE_DESIGN", () => {
  it("heating design temp is colder in northern zones", () => {
    expect(CLIMATE_DESIGN["1A - Miami"].heatDB).toBeGreaterThan(CLIMATE_DESIGN["5A - Chicago"].heatDB);
    expect(CLIMATE_DESIGN["5A - Chicago"].heatDB).toBeGreaterThan(CLIMATE_DESIGN["7 - Duluth"].heatDB);
  });

  it("HDD65 is higher in colder zones", () => {
    expect(CLIMATE_DESIGN["1A - Miami"].hdd65).toBeLessThan(CLIMATE_DESIGN["5A - Chicago"].hdd65);
    expect(CLIMATE_DESIGN["5A - Chicago"].hdd65).toBeLessThan(CLIMATE_DESIGN["7 - Duluth"].hdd65);
  });
});

describe("HPWH_TANK_FHR", () => {
  it("FHR is monotonic with tank size", () => {
    expect(HPWH_TANK_FHR[50].fhr).toBeLessThan(HPWH_TANK_FHR[66].fhr);
    expect(HPWH_TANK_FHR[66].fhr).toBeLessThan(HPWH_TANK_FHR[80].fhr);
    expect(HPWH_TANK_FHR[80].fhr).toBeLessThan(HPWH_TANK_FHR[120].fhr);
  });
});

describe("GAS_TANK_WH", () => {
  it("condensing FHR > atmospheric FHR", () => {
    for (const s of [40, 50, 75, 100] as const) {
      expect(GAS_TANK_WH[s].fhr_condensing).toBeGreaterThan(GAS_TANK_WH[s].fhr_atmospheric);
    }
  });

  it("condensing UEF exceeds federal 0.80 minimum at all sizes 50+", () => {
    for (const s of [50, 75, 100] as const) {
      expect(GAS_TANK_WH[s].uef_cond).toBeGreaterThanOrEqual(0.80);
    }
  });
});

describe("GAS_TANKLESS_WH", () => {
  it("UEF exceeds 0.80 ASHRAE 90.1 threshold for all units", () => {
    for (const s of [150, 180, 199] as const) {
      expect(GAS_TANKLESS_WH[s].uef).toBeGreaterThanOrEqual(0.80);
    }
  });
});

describe("ENVELOPE_PRESETS", () => {
  it("factor ordering: passive < efficient < code < retrofit", () => {
    expect(ENVELOPE_PRESETS.passive.factor).toBeLessThan(ENVELOPE_PRESETS.efficient.factor);
    expect(ENVELOPE_PRESETS.efficient.factor).toBeLessThan(ENVELOPE_PRESETS.code2021.factor);
    expect(ENVELOPE_PRESETS.code2021.factor).toBeLessThan(ENVELOPE_PRESETS.retrofit.factor);
  });
});
