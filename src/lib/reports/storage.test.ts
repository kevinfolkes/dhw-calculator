import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_INPUTS } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";
import {
  STORAGE_KEY,
  deleteReport,
  exportLibrary,
  findScenario,
  getReport,
  importLibrary,
  listReports,
  primaryScenario,
  saveReport,
  saveScenarios,
  updateReport,
} from "./storage";

// vitest's jsdom environment provides a real localStorage; we just clear it
// between tests. Same pattern as src/lib/persistence.test.ts (which uses the
// in-process jsdom window directly).
function clearStorage(): void {
  window.localStorage.clear();
}

// Minimal CalcResult stub for round-trip tests. We don't exercise the
// engineering pipeline here — storage.ts only treats `results` as opaque
// JSON — so we cast through `unknown` to avoid duplicating the full schema.
const STUB_RESULT = { peakHourDemand: 1234, flags: [] } as unknown as CalcResult;

describe("reports/storage — DHW convenience API (v1-compatible)", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("save → list returns 1 entry with matching name", () => {
    saveReport("Baseline scenario", DEFAULT_INPUTS, STUB_RESULT);
    const list = listReports();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Baseline scenario");
  });

  it("save → get(id) returns the same SavedReport (wrapped as 1 scenario)", () => {
    const saved = saveReport("R1", DEFAULT_INPUTS, STUB_RESULT, "notes here");
    const fetched = getReport(saved.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(saved.id);
    expect(fetched?.name).toBe("R1");
    expect(fetched?.notes).toBe("notes here");
    expect(fetched?.engineVersion).toBe(saved.engineVersion);
    // v2 shape: domain stamped, scenarios array has one entry
    expect(fetched?.domain).toBe("dhw");
    expect(fetched?.scenarios).toHaveLength(1);
    expect(fetched?.scenarios[0].label).toBe("snapshot");
  });

  it("update name → updatedAt advances, list still returns 1 entry", async () => {
    const saved = saveReport("Old name", DEFAULT_INPUTS, STUB_RESULT);
    // Ensure ISO timestamp ticks at least 1ms.
    await new Promise((r) => setTimeout(r, 5));
    const updated = updateReport(saved.id, { name: "New name" });
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("New name");
    expect(updated && updated.updatedAt > saved.updatedAt).toBe(true);
    expect(listReports()).toHaveLength(1);
  });

  it("delete → list returns 0 entries", () => {
    const saved = saveReport("Doomed", DEFAULT_INPUTS, STUB_RESULT);
    expect(deleteReport(saved.id)).toBe(true);
    expect(listReports()).toHaveLength(0);
    expect(deleteReport(saved.id)).toBe(false);
  });

  it("exportLibrary → importLibrary roundtrip preserves data", () => {
    const a = saveReport("A", DEFAULT_INPUTS, STUB_RESULT);
    const b = saveReport("B", DEFAULT_INPUTS, STUB_RESULT);
    const json = exportLibrary();
    clearStorage();
    expect(listReports()).toHaveLength(0);
    const result = importLibrary(json, "replace");
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    const ids = listReports().map((r) => r.id).sort();
    expect(ids).toEqual([a.id, b.id].sort());
  });

  it("importLibrary merge skips id collisions", () => {
    const a = saveReport("A", DEFAULT_INPUTS, STUB_RESULT);
    const json = exportLibrary();
    // Same library imported on top of itself: every id collides.
    const result = importLibrary(json, "merge");
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(getReport(a.id)?.name).toBe("A");
  });

  it("empty/missing localStorage returns empty list (no crash)", () => {
    clearStorage();
    expect(listReports()).toEqual([]);
    expect(getReport("nope")).toBeNull();
  });

  it("malformed JSON in localStorage returns empty list (no crash)", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(listReports()).toEqual([]);
    expect(getReport("nope")).toBeNull();
  });
});

describe("reports/storage — multi-domain saveScenarios API", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("saveScenarios stamps domain + engineVersion + scenarios array", () => {
    const r = saveScenarios("Lighting baseline", "lighting", [
      { label: "snapshot", inputs: { fixtures: 100 }, results: { kWh: 12000 } },
    ]);
    expect(r.domain).toBe("lighting");
    expect(r.scenarios).toHaveLength(1);
    expect(r.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("saveScenarios with two scenarios persists a retrofit comparison", () => {
    const r = saveScenarios("LED retrofit corridor", "lighting", [
      { label: "current", inputs: { watts: 60 }, results: { kWh: 18000 } },
      { label: "proposed", inputs: { watts: 12 }, results: { kWh: 3600 } },
    ]);
    expect(r.scenarios).toHaveLength(2);
    expect(r.scenarios[0].label).toBe("current");
    expect(r.scenarios[1].label).toBe("proposed");
  });

  it("findScenario looks up a scenario by label", () => {
    const r = saveScenarios("Retrofit", "lighting", [
      { label: "current", inputs: 1, results: 2 },
      { label: "proposed", inputs: 3, results: 4 },
    ]);
    expect(findScenario(r, "current")?.results).toBe(2);
    expect(findScenario(r, "proposed")?.results).toBe(4);
    expect(findScenario(r, "nonexistent")).toBeNull();
  });

  it("primaryScenario returns the first scenario", () => {
    const r = saveScenarios("Snap", "dhw", [
      { label: "snapshot", inputs: { x: 1 }, results: { y: 2 } },
    ]);
    expect(primaryScenario(r)?.label).toBe("snapshot");
  });

  it("primaryScenario returns null on empty scenarios array", () => {
    const r = saveScenarios("Empty", "dhw", []);
    expect(primaryScenario(r)).toBeNull();
  });

  it("listReports mixes domains in update order", async () => {
    saveScenarios("DHW report", "dhw", [
      { label: "snapshot", inputs: DEFAULT_INPUTS, results: STUB_RESULT },
    ]);
    await new Promise((r) => setTimeout(r, 5));
    const lighting = saveScenarios("Lighting report", "lighting", [
      { label: "snapshot", inputs: { fixtures: 50 }, results: { kWh: 5000 } },
    ]);
    const list = listReports();
    expect(list).toHaveLength(2);
    // Most-recently-updated first.
    expect(list[0].id).toBe(lighting.id);
    expect(list[0].domain).toBe("lighting");
  });
});

describe("reports/storage — v1 migration shim", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("auto-migrates v1 records on read (no scenarios array, no domain)", () => {
    // Hand-craft the legacy v1 record shape directly in localStorage to
    // simulate a user whose library predates the multi-domain refactor.
    const v1Map = {
      "legacy-id-1": {
        id: "legacy-id-1",
        name: "Legacy DHW report",
        createdAt: "2025-12-01T10:00:00.000Z",
        updatedAt: "2025-12-01T10:00:00.000Z",
        engineVersion: "0.4.0",
        inputs: DEFAULT_INPUTS,
        results: STUB_RESULT,
        notes: "from before the refactor",
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Map));

    const fetched = getReport("legacy-id-1");
    expect(fetched).not.toBeNull();
    expect(fetched?.domain).toBe("dhw");
    expect(fetched?.scenarios).toHaveLength(1);
    expect(fetched?.scenarios[0].label).toBe("snapshot");
    expect(fetched?.scenarios[0].inputs).toEqual(DEFAULT_INPUTS);
    expect(fetched?.notes).toBe("from before the refactor");
    // Engine version preserved as it was when saved (so stale-detection
    // still works correctly).
    expect(fetched?.engineVersion).toBe("0.4.0");
  });

  it("listReports returns migrated v1 records alongside v2 records", () => {
    // Mix v1 + v2 in the same library blob.
    const mixed = {
      "v1-record": {
        id: "v1-record",
        name: "V1",
        createdAt: "2025-12-01T10:00:00.000Z",
        updatedAt: "2025-12-01T10:00:00.000Z",
        engineVersion: "0.4.0",
        inputs: DEFAULT_INPUTS,
        results: STUB_RESULT,
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mixed));
    saveScenarios("V2 native", "lighting", [
      { label: "snapshot", inputs: { x: 1 }, results: { y: 2 } },
    ]);

    const list = listReports();
    expect(list).toHaveLength(2);
    const v1 = list.find((r) => r.id === "v1-record");
    expect(v1?.domain).toBe("dhw");
    expect(v1?.scenarios[0].label).toBe("snapshot");
  });

  it("importLibrary migrates v1 records during import", () => {
    const v1Json = JSON.stringify({
      "imported-v1": {
        id: "imported-v1",
        name: "Imported legacy",
        createdAt: "2025-12-01T10:00:00.000Z",
        updatedAt: "2025-12-01T10:00:00.000Z",
        engineVersion: "0.4.0",
        inputs: DEFAULT_INPUTS,
        results: STUB_RESULT,
      },
    });
    const result = importLibrary(v1Json, "replace");
    expect(result.imported).toBe(1);
    const fetched = getReport("imported-v1");
    expect(fetched?.domain).toBe("dhw");
    expect(fetched?.scenarios).toHaveLength(1);
  });
});
