/**
 * Saved-report library backed by localStorage. Each report is a structured
 * snapshot of `{ inputs, results, engineVersion }` plus user metadata so the
 * Reports + Compare views can list, reload, and diff scenarios without
 * re-running the calculator.
 *
 * Storage layout: a single localStorage key (`STORAGE_KEY`) holds a JSON
 * `Record<string, SavedReport>` keyed by report id. All accessors are
 * SSR-safe and tolerant of malformed JSON (return empty / null + log).
 */
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";
import { ENGINE_VERSION } from "@/lib/version";

export const STORAGE_KEY = "dhw-calc.reports.v1";

export interface SavedReport {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  engineVersion: string;
  inputs: DhwInputs;
  results: CalcResult;
  notes?: string;
}

type ReportMap = Record<string, SavedReport>;

/** True only when running in a browser context with localStorage available. */
function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Generate a unique id using crypto.randomUUID where available. */
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random suffix. Not cryptographically strong but
  // sufficient for distinguishing reports in a single browser profile.
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Read the full library map. Returns `{}` on any error / missing key. */
function readMap(): ReportMap {
  if (!hasStorage()) return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ReportMap;
    }
    return {};
  } catch (err) {
    console.error("[reports/storage] failed to parse library JSON", err);
    return {};
  }
}

/** Write the library map. No-op when storage is unavailable. */
function writeMap(map: ReportMap): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error("[reports/storage] failed to persist library", err);
  }
}

/**
 * Persist a new report. Stamps `id`, timestamps, and the current
 * `ENGINE_VERSION` automatically.
 */
export function saveReport(
  name: string,
  inputs: DhwInputs,
  results: CalcResult,
  notes?: string,
): SavedReport {
  const now = new Date().toISOString();
  const report: SavedReport = {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    engineVersion: ENGINE_VERSION,
    inputs,
    results,
    ...(notes !== undefined ? { notes } : {}),
  };
  const map = readMap();
  map[report.id] = report;
  writeMap(map);
  return report;
}

/** List all saved reports, most-recently-updated first. */
export function listReports(): SavedReport[] {
  const map = readMap();
  return Object.values(map).sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
}

/** Fetch a single report by id, or `null` if not found. */
export function getReport(id: string): SavedReport | null {
  const map = readMap();
  return map[id] ?? null;
}

/**
 * Patch a report's mutable fields. Bumps `updatedAt`. Returns the merged
 * report, or `null` if the id is unknown.
 */
export function updateReport(
  id: string,
  patch: Partial<Pick<SavedReport, "name" | "notes" | "inputs" | "results">>,
): SavedReport | null {
  const map = readMap();
  const existing = map[id];
  if (!existing) return null;
  const merged: SavedReport = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  map[id] = merged;
  writeMap(map);
  return merged;
}

/** Remove a report. Returns true if a report was deleted, false otherwise. */
export function deleteReport(id: string): boolean {
  const map = readMap();
  if (!(id in map)) return false;
  delete map[id];
  writeMap(map);
  return true;
}

/** Serialize the entire library to a JSON string (suitable for file backup). */
export function exportLibrary(): string {
  return JSON.stringify(readMap());
}

/**
 * Import a JSON library blob. In `merge` mode, existing reports are kept and
 * id collisions are skipped. In `replace` mode, the existing library is
 * wiped first. Returns counts so the UI can show a summary toast.
 */
export function importLibrary(
  json: string,
  mode: "merge" | "replace",
): { imported: number; skipped: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    console.error("[reports/storage] importLibrary: invalid JSON", err);
    return { imported: 0, skipped: 0 };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { imported: 0, skipped: 0 };
  }
  const incoming = parsed as ReportMap;
  const target: ReportMap = mode === "replace" ? {} : readMap();
  let imported = 0;
  let skipped = 0;
  for (const [id, report] of Object.entries(incoming)) {
    if (mode === "merge" && id in target) {
      skipped += 1;
      continue;
    }
    target[id] = report;
    imported += 1;
  }
  writeMap(target);
  return { imported, skipped };
}
