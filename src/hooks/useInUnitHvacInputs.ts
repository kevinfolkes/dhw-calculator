"use client";

/**
 * State + persistence hook for the in-unit HVAC calculator. Mirrors the
 * `useLightingInputs` pattern: a single `InUnitHvacInputs` object held in
 * React state, persisted to localStorage so refreshes don't lose work,
 * exposed with both a full setter and a per-field `update` helper.
 *
 * URL-shareable links are intentionally deferred — DHW has them but they
 * add significant code; in-unit HVAC can adopt the same pattern in a
 * follow-up if users ask for it.
 */
import { useEffect, useState } from "react";
import {
  DEFAULT_INPUTS,
  INUNIT_HVAC_SYSTEM_SPECS,
  type InUnitHvacInputs,
  type InUnitHvacSystemType,
} from "@/lib/inunit-hvac/inputs";

const STORAGE_KEY = "inunit-hvac-calculator:inputs:v1";

function readLocalStorage(): InUnitHvacInputs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as InUnitHvacInputs;
  } catch {
    /* fall through */
  }
  return null;
}

function writeLocalStorage(v: InUnitHvacInputs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* quota / private browsing — ignore */
  }
}

export function useInUnitHvacInputs() {
  const [inputs, setInputs] = useState<InUnitHvacInputs>(DEFAULT_INPUTS);

  // Hydrate once on mount (storage is browser-only).
  useEffect(() => {
    const fromStorage = readLocalStorage();
    if (fromStorage) setInputs(fromStorage);
  }, []);

  // Persist on every change.
  useEffect(() => {
    writeLocalStorage(inputs);
  }, [inputs]);

  /** Patch a top-level field. */
  function update<K extends keyof InUnitHvacInputs>(
    key: K,
    value: InUnitHvacInputs[K],
  ): void {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  /** Switch system types and reset cooling/heating equipment to that type's
   *  spec defaults. Preserves apartment count, climate zone, electric rate,
   *  grid subregion, and EFLH overrides — those are building-context inputs
   *  that don't change with equipment swaps. */
  function switchSystemType(systemType: InUnitHvacSystemType): void {
    const spec = INUNIT_HVAC_SYSTEM_SPECS[systemType];
    setInputs((prev) => ({
      ...prev,
      systemType,
      coolingCapacityBtuh: spec.coolingBtuh,
      coolingEfficiency: spec.coolingEff,
      coolingEfficiencyMetric: spec.coolingMetric,
      heatingCapacityBtuh: spec.heatingBtuh,
      heatingEfficiency: spec.heatingEff,
      heatingEfficiencyMetric: spec.heatingMetric,
    }));
  }

  /** Reset to baseline DEFAULT_INPUTS — useful for the reset button. */
  function reset(): void {
    setInputs(DEFAULT_INPUTS);
  }

  return { inputs, setInputs, update, switchSystemType, reset };
}
