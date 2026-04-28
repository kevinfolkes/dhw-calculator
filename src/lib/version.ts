/**
 * Engine version stamp. Bumped manually when pipeline math changes
 * meaningfully (heuristic: any commit that could shift a numeric result
 * by >0.5% on default inputs). Used by saved reports to detect when a
 * loaded scenario's frozen results may be stale relative to current math.
 */
export const ENGINE_VERSION = "0.4.0" as const;
export type EngineVersion = typeof ENGINE_VERSION;
