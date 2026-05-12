"use client";

/**
 * State + persistence hook for the lighting calculator. Mirrors the
 * `useDhwInputs` pattern: a single `LightingInputs` object held in React
 * state, persisted to localStorage so refreshes don't lose work, exposed
 * with both a full setter and a per-field `update` helper.
 *
 * URL serialization (shareable links via `?s=<base64>`) is intentionally
 * deferred — DHW has it but it adds significant code; lighting can adopt
 * the same pattern in a follow-up if users ask for it.
 */
import { useEffect, useState } from "react";
import { DEFAULT_INPUTS, type LightingInputs, type LightingCategory } from "@/lib/lighting/inputs";

const STORAGE_KEY = "lighting-calculator:inputs:v1";

function readLocalStorage(): LightingInputs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as LightingInputs;
  } catch {
    /* fall through */
  }
  return null;
}

function writeLocalStorage(v: LightingInputs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* quota / private browsing — ignore */
  }
}

export function useLightingInputs() {
  const [inputs, setInputs] = useState<LightingInputs>(DEFAULT_INPUTS);

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
  function update<K extends keyof LightingInputs>(key: K, value: LightingInputs[K]): void {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  /** Patch one field within one category config. */
  function updateCategory(
    category: LightingCategory,
    field: keyof LightingInputs["categories"][LightingCategory],
    value: number,
  ): void {
    setInputs((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          [field]: value,
        },
      },
    }));
  }

  /** Reset to baseline DEFAULT_INPUTS — useful for the reset button. */
  function reset(): void {
    setInputs(DEFAULT_INPUTS);
  }

  return { inputs, setInputs, update, updateCategory, reset };
}
