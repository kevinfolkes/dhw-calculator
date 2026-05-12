/**
 * Saved-report library backed by localStorage. Each report is a structured
 * snapshot of one or more `{ inputs, results }` scenarios plus user metadata
 * so the Reports + Compare views can list, reload, diff, and export
 * scenarios without re-running the calculator.
 *
 * Schema (v2 — multi-domain, multi-scenario):
 * ```
 * {
 *   id, name, createdAt, updatedAt, notes?,
 *   domain: "dhw" | "lighting" | "rtus" | "boilers_chillers",
 *   engineVersion: string,        // domain-scoped via ENGINE_VERSIONS map
 *   scenarios: Array<{ label, inputs, results }>,
 * }
 * ```
 *
 * Each scenario is one configuration. A simple sizing snapshot has 1 scenario;
 * a current-vs-proposed retrofit comparison has 2 scenarios labelled
 * "current" and "proposed". The Compare tab can pick scenarios across
 * multiple reports for side-by-side diffing.
 *
 * Storage layout: a single localStorage key holds a JSON
 * `Record<string, SavedReport>` keyed by report id. All accessors are
 * SSR-safe and tolerant of malformed JSON (return empty / null + log).
 *
 * Migration: the v1 format (single `{inputs, results}` pair, no `domain`,
 * no `scenarios`) auto-upgrades on read — `migrateRecord` wraps it as a
 * single-scenario DHW report. This is non-destructive; the upgraded record
 * is written back to storage on the next save.
 */
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";
import { ENGINE_VERSIONS, getEngineVersion, type Domain } from "@/lib/version";

export const STORAGE_KEY = "dhw-calc.reports.v1";

export interface SavedScenario<I = unknown, R = unknown> {
  /** Free-text label distinguishing scenarios within a single report.
   *  Conventional labels: "snapshot" (single-scenario sizing report),
   *  "current" + "proposed" (retrofit comparison), or any user-supplied
   *  string when comparing arbitrary scenarios. */
  label: string;
  inputs: I;
  results: R;
}

export interface SavedReport<I = unknown, R = unknown> {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** End-use discriminator — drives which calculator's renderer + export
   *  template handles this report, and which `ENGINE_VERSIONS[domain]`
   *  is used for stale detection. */
  domain: Domain;
  /** Engine version stamp at save time. Compared against
   *  `ENGINE_VERSIONS[domain]` to surface a stale-result banner when the
   *  pipeline math has evolved since the report was saved. */
  engineVersion: string;
  /** One or more scenario snapshots. Single-scenario for sizing reports;
   *  two scenarios (labels "current" + "proposed") for retrofit
   *  comparisons. */
  scenarios: SavedScenario<I, R>[];
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

/**
 * Best-effort upgrade of a record from the v1 (single-scenario, DHW-only)
 * shape to the v2 (multi-scenario, domain-tagged) shape. Returns null when
 * the record can't be parsed at all — caller filters those out.
 *
 * v1 → v2 mapping:
 *   { id, name, createdAt, updatedAt, engineVersion, inputs, results, notes }
 *   →
 *   { id, name, createdAt, updatedAt, engineVersion, notes,
 *     domain: "dhw",
 *     scenarios: [{ label: "snapshot", inputs, results }] }
 */
function migrateRecord(record: unknown): SavedReport | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;

  // Already in v2 shape — return as-is.
  if (Array.isArray(r.scenarios) && typeof r.domain === "string") {
    return r as unknown as SavedReport;
  }

  // v1 shape (single scenario, no domain) — wrap as DHW snapshot.
  if (r.inputs !== undefined && r.results !== undefined) {
    return {
      id: r.id,
      name: r.name,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
      domain: "dhw",
      engineVersion:
        typeof r.engineVersion === "string" ? r.engineVersion : ENGINE_VERSIONS.dhw,
      scenarios: [
        {
          label: "snapshot",
          inputs: r.inputs,
          results: r.results,
        },
      ],
      notes: typeof r.notes === "string" ? r.notes : undefined,
    };
  }

  return null;
}

/** Read the full library map. Returns `{}` on any error / missing key.
 *  Each record is run through `migrateRecord` so v1 reports auto-upgrade
 *  transparently — callers always receive v2-shaped records. */
function readMap(): ReportMap {
  if (!hasStorage()) return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ReportMap = {};
    for (const [id, record] of Object.entries(parsed as Record<string, unknown>)) {
      const upgraded = migrateRecord(record);
      if (upgraded) out[id] = upgraded;
    }
    return out;
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
 * Persist a new report. Stamps `id`, timestamps, and the domain's current
 * engine version automatically. The most general entry point — every
 * domain (DHW, lighting, RTUs, ...) calls this with its own typed inputs
 * and results.
 *
 * @param name      User-facing label for the report
 * @param domain    End-use discriminator
 * @param scenarios One or more scenarios to snapshot. Single = sizing
 *                  snapshot; two with labels "current" + "proposed" =
 *                  retrofit comparison.
 * @param notes     Optional free-text notes
 */
export function saveScenarios<I, R>(
  name: string,
  domain: Domain,
  scenarios: SavedScenario<I, R>[],
  notes?: string,
): SavedReport<I, R> {
  const now = new Date().toISOString();
  const report: SavedReport<I, R> = {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    domain,
    engineVersion: getEngineVersion(domain),
    scenarios,
    ...(notes !== undefined ? { notes } : {}),
  };
  const map = readMap();
  map[report.id] = report as SavedReport;
  writeMap(map);
  return report;
}

/**
 * Convenience for DHW callers — wraps `saveScenarios` with a single
 * "snapshot" scenario under the "dhw" domain. Preserves the original v1
 * call signature so existing UI code keeps working without a churn.
 */
export function saveReport(
  name: string,
  inputs: DhwInputs,
  results: CalcResult,
  notes?: string,
): SavedReport<DhwInputs, CalcResult> {
  return saveScenarios<DhwInputs, CalcResult>(
    name,
    "dhw",
    [{ label: "snapshot", inputs, results }],
    notes,
  );
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
  patch: Partial<Pick<SavedReport, "name" | "notes" | "scenarios">>,
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

/** Serialize the entire library to a JSON string (suitable for file backup).
 *  The exported records are in v2 shape — old v1 records are migrated on
 *  read and exported in the new format. */
export function exportLibrary(): string {
  return JSON.stringify(readMap());
}

/**
 * Import a JSON library blob. In `merge` mode, existing reports are kept and
 * id collisions are skipped. In `replace` mode, the existing library is
 * wiped first. v1-shaped records in the import are migrated transparently.
 * Returns counts so the UI can show a summary toast.
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
  const incoming = parsed as Record<string, unknown>;
  const target: ReportMap = mode === "replace" ? {} : readMap();
  let imported = 0;
  let skipped = 0;
  for (const [id, record] of Object.entries(incoming)) {
    if (mode === "merge" && id in target) {
      skipped += 1;
      continue;
    }
    const upgraded = migrateRecord(record);
    if (!upgraded) {
      skipped += 1;
      continue;
    }
    target[id] = upgraded;
    imported += 1;
  }
  writeMap(target);
  return { imported, skipped };
}

// ─── Convenience accessors ───────────────────────────────────────────────

/** First scenario from a report — handy when you want the "primary" inputs/
 *  results for a sizing-only snapshot or the "current" leg of a retrofit. */
export function primaryScenario<I = unknown, R = unknown>(
  report: SavedReport<I, R>,
): SavedScenario<I, R> | null {
  return report.scenarios[0] ?? null;
}

/** Look up a scenario by label within a report. Returns null if not found. */
export function findScenario<I = unknown, R = unknown>(
  report: SavedReport<I, R>,
  label: string,
): SavedScenario<I, R> | null {
  return report.scenarios.find((s) => s.label === label) ?? null;
}
