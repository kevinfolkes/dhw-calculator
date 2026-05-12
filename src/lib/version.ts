/**
 * Per-domain engine version stamps. Each end-use calculator (DHW, lighting,
 * RTUs, boilers/chillers, ...) has its own version that gets bumped when
 * THAT domain's pipeline math changes meaningfully (heuristic: any commit
 * that could shift a numeric result by >0.5% on default inputs).
 *
 * Used by saved reports to detect when a loaded scenario's frozen results
 * may be stale relative to the current pipeline. The Reports + Compare
 * tabs surface a banner whenever `report.engineVersion !==
 * ENGINE_VERSIONS[report.domain]`.
 *
 * Adding a new end-use calculator: append a new key here with version
 * "1.0.0" — that's the only place version state lives.
 */
export const ENGINE_VERSIONS = {
  dhw: "0.4.1",
  lighting: "1.0.0",
  inunit_hvac: "1.1.0",
  rtus: "1.0.0",
  boilers_chillers: "1.0.0",
} as const;

export type Domain = keyof typeof ENGINE_VERSIONS;
export type EngineVersion = (typeof ENGINE_VERSIONS)[Domain];

/** Get the current engine version for a specific end-use domain. */
export function getEngineVersion(domain: Domain): string {
  return ENGINE_VERSIONS[domain];
}

/**
 * @deprecated Use `ENGINE_VERSIONS.dhw` or `getEngineVersion("dhw")` directly.
 * Kept as an alias during the multi-domain migration so existing DHW-only
 * callsites continue to compile while they're refactored to be domain-aware.
 */
export const ENGINE_VERSION = ENGINE_VERSIONS.dhw;
