"use client";

/**
 * Generic two-column current-vs-proposed retrofit comparison widget.
 * Domain-agnostic — used by both DHW and Lighting calculators (and any
 * future end use). Takes:
 *
 *   - currentInputs / proposedInputs           — the two scenarios to compare
 *   - onChangeCurrent / onChangeProposed       — change handlers
 *   - runCalc(inputs): R                       — the domain pipeline
 *   - extractMetrics(r): RetrofitMetrics       — converts R into the
 *                                                rollup shape the savings
 *                                                strip needs
 *   - renderInputs(inputs, onChange, label)    — domain-specific input UI
 *   - onSave(name, scenarios)                  — persists the retrofit as
 *                                                a 2-scenario SavedReport
 *
 * The widget runs the pipeline live on every change and pushes savings
 * through `SavingsStrip` below. "Save retrofit" prompts for a name and
 * persists `[{label: "current", inputs, results}, {label: "proposed",
 * inputs, results}]` via the storage API.
 */
import { useMemo, useState } from "react";
import { Save, Wand2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { SavingsStrip, type RetrofitMetrics } from "./SavingsStrip";

export interface RetrofitComparisonProps<I, R> {
  currentInputs: I;
  proposedInputs: I;
  onChangeCurrent: (next: I) => void;
  onChangeProposed: (next: I) => void;
  /** Pure pipeline: inputs → results. Called on every render in a useMemo. */
  runCalc: (inputs: I) => R;
  /** Extracts the rollup metrics SavingsStrip needs. */
  extractMetrics: (results: R) => RetrofitMetrics;
  /** Domain-specific input UI for one column. */
  renderInputs: (
    inputs: I,
    onChange: (next: I) => void,
    label: "Current" | "Proposed",
  ) => React.ReactNode;
  /** Persists the retrofit as a 2-scenario SavedReport. */
  onSave: (
    name: string,
    scenarios: Array<{ label: string; inputs: I; results: R }>,
  ) => void;
  /** Optional preset to populate the proposed side with one click — e.g.,
   *  "Apply LED + sensors" or "Apply heat-pump retrofit". */
  proposedPreset?: { label: string; inputs: I };
}

export function RetrofitComparison<I, R>({
  currentInputs,
  proposedInputs,
  onChangeCurrent,
  onChangeProposed,
  runCalc,
  extractMetrics,
  renderInputs,
  onSave,
  proposedPreset,
}: RetrofitComparisonProps<I, R>) {
  const [name, setName] = useState("");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const currentResult = useMemo(() => runCalc(currentInputs), [currentInputs, runCalc]);
  const proposedResult = useMemo(() => runCalc(proposedInputs), [proposedInputs, runCalc]);
  const currentMetrics = useMemo(
    () => extractMetrics(currentResult),
    [currentResult, extractMetrics],
  );
  const proposedMetrics = useMemo(
    () => extractMetrics(proposedResult),
    [proposedResult, extractMetrics],
  );

  const handleSave = () => {
    const trimmed = name.trim();
    // Button is disabled when name is empty (see the save button below) —
    // this guard is a defensive no-op so a non-button code path can't
    // accidentally save an unnamed retrofit (silently using "Retrofit
    // comparison" as the title made these reports invisible in the
    // library, which is why we now require an explicit name).
    if (trimmed.length === 0) return;
    onSave(trimmed, [
      { label: "current", inputs: currentInputs, results: currentResult },
      { label: "proposed", inputs: proposedInputs, results: proposedResult },
    ]);
    setSavedFlash(`Saved as "${trimmed}"`);
    setName("");
    setTimeout(() => setSavedFlash(null), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Intro */}
      <Card accent="var(--accent-emerald)">
        <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "var(--text-primary)" }}>
          <strong>Retrofit comparison.</strong> Name the comparison first
          (top of this tab), then configure current equipment on the left
          and proposed (post-retrofit) equipment on the right. Annual energy,
          cost, and carbon savings recompute live below as you change either
          side. Saved retrofits live in the Reports library as a single
          named record holding both scenarios.
        </p>
      </Card>

      {/* Name + Save action — moved to the top so users see the name
          requirement before configuring the comparison. Save button is
          duplicated below the savings strip for users who scroll the long
          way; both buttons hit the same handler. */}
      <Card>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            htmlFor="retrofit-name"
            style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}
          >
            Retrofit name
          </label>
          <input
            id="retrofit-name"
            type="text"
            className="ve-input"
            placeholder="e.g., Corridor LED retrofit + occupancy sensors"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 240, fontFamily: "var(--font-sans)" }}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={name.trim().length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--accent-emerald)",
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: name.trim().length === 0 ? "not-allowed" : "pointer",
              opacity: name.trim().length === 0 ? 0.5 : 1,
            }}
          >
            <Save size={13} />
            Save retrofit
          </button>
          {savedFlash && (
            <span
              style={{
                fontSize: 12,
                color: "var(--accent-emerald)",
                fontWeight: 600,
              }}
            >
              {savedFlash}
            </span>
          )}
        </div>
      </Card>

      {/* Two-column input region */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Current</span>
            </CardTitle>
          </CardHeader>
          {renderInputs(currentInputs, onChangeCurrent, "Current")}
        </Card>

        <Card accent="var(--accent-emerald)">
          <CardHeader>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <CardTitle>
                <span style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>
                  Proposed
                </span>
              </CardTitle>
              {proposedPreset && (
                <button
                  type="button"
                  onClick={() => onChangeProposed(proposedPreset.inputs)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--accent-emerald)",
                    background: "var(--accent-emerald-bg)",
                    color: "var(--accent-emerald)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Replace the proposed inputs with this preset"
                >
                  <Wand2 size={12} />
                  {proposedPreset.label}
                </button>
              )}
            </div>
          </CardHeader>
          {renderInputs(proposedInputs, onChangeProposed, "Proposed")}
        </Card>
      </div>

      {/* Savings strip — final visual after the user has configured both
          sides. The save action used to live below this; it now lives at
          the top of the tab so users see the name requirement before
          configuring, not after scrolling past the savings strip. */}
      <SavingsStrip current={currentMetrics} proposed={proposedMetrics} />
    </div>
  );
}
