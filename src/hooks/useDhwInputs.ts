"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_INPUTS, type DhwInputs } from "@/lib/calc/inputs";
import { decodeInputs, encodeInputs } from "@/lib/persistence";

const STORAGE_KEY = "dhw-calculator:inputs:v1";

/**
 * React hook that keeps a DhwInputs object in React state and persists it to:
 *   1. URL search param `?s=<base64json>` (for shareable links)
 *   2. localStorage (for session restore)
 *
 * URL takes precedence on first mount; writes go to both.
 */
export function useDhwInputs(): {
  inputs: DhwInputs;
  setInputs: (next: DhwInputs) => void;
  update: <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => void;
  reset: () => void;
  shareURL: () => string;
} {
  const [inputs, setInputsState] = useState<DhwInputs>(DEFAULT_INPUTS);

  // Hydrate from URL → localStorage → default on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s");
    if (s) {
      const parsed = decodeInputs(s);
      if (parsed) {
        setInputsState({ ...DEFAULT_INPUTS, ...parsed });
        return;
      }
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<DhwInputs>;
        setInputsState({ ...DEFAULT_INPUTS, ...parsed });
      } catch {
        // ignore malformed localStorage
      }
    }
  }, []);

  // Write-through to localStorage on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      // storage may be disabled (privacy mode) — silently ignore
    }
  }, [inputs]);

  const setInputs = useCallback((next: DhwInputs) => setInputsState(next), []);

  const update = useCallback(
    <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => {
      setInputsState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => setInputsState(DEFAULT_INPUTS), []);

  const shareURL = useCallback(() => {
    if (typeof window === "undefined") return "";
    const encoded = encodeInputs(inputs);
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?s=${encoded}`;
  }, [inputs]);

  return { inputs, setInputs, update, reset, shareURL };
}
