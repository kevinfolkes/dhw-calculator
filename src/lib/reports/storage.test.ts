import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_INPUTS } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";
import {
  STORAGE_KEY,
  deleteReport,
  exportLibrary,
  getReport,
  importLibrary,
  listReports,
  saveReport,
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

describe("reports/storage", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("save → list returns 1 entry with matching name", () => {
    saveReport("Baseline scenario", DEFAULT_INPUTS, STUB_RESULT);
    const list = listReports();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Baseline scenario");
  });

  it("save → get(id) returns the same SavedReport", () => {
    const saved = saveReport("R1", DEFAULT_INPUTS, STUB_RESULT, "notes here");
    const fetched = getReport(saved.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(saved.id);
    expect(fetched?.name).toBe("R1");
    expect(fetched?.notes).toBe("notes here");
    expect(fetched?.engineVersion).toBe(saved.engineVersion);
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
