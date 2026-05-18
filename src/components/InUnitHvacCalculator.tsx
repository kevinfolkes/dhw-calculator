"use client";

/**
 * InUnitHvacCalculator — multifamily in-unit HVAC end-use modeler. Mirrors
 * the `LightingCalculator` shape (TopTabNav + tab content), with engineering
 * adapted for per-apartment cooling + heating equipment.
 *
 * This file is the calculator shell only: imports, tab routing, header chrome.
 * Each tab lives in its own file under `src/components/tabs/inunit-hvac/`:
 *
 *   - OverviewTab    — system-type picker, how-to, calibration summary
 *   - EquipmentTab   — building context + per-apt equipment input form
 *   - EnergyTab      — annual rollup + monthly stacked chart + per-end-use table
 *   - RetrofitTab    — current-vs-proposed comparison + smart preset
 *   - CalculationsTab — step-by-step worked example (substituted formulas)
 *   - MethodologyTab — long-form sources + EFLH math walkthrough
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AirVent,
  BarChart3,
  Book,
  LayoutGrid,
  Sigma,
  Sliders,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { runCalc } from "@/lib/inunit-hvac/pipeline";
import { useInUnitHvacInputs } from "@/hooks/useInUnitHvacInputs";
import { fmt, fmtUSD } from "@/lib/utils";
import { TopTabNav } from "@/components/TopTabNav";
import { OverviewTab } from "@/components/tabs/inunit-hvac/OverviewTab";
import { EquipmentTab } from "@/components/tabs/inunit-hvac/EquipmentTab";
import { RetrofitTab } from "@/components/tabs/inunit-hvac/RetrofitTab";
import { TabSkeleton } from "@/components/ui/TabSkeleton";

// ─── Lazy-loaded heavy tabs ────────────────────────────────────────────────
// EnergyTab pulls in recharts (~80–100KB gzipped); CalculationsTab is
// substantial; MethodologyTab is ~900 lines of long-form prose. Deferred so
// first-paint shows Overview/Equipment immediately without paying the chunk
// cost. `ssr: false` is fine — static export hydrates on the client anyway.
const EnergyTab = dynamic(
  () => import("@/components/tabs/inunit-hvac/EnergyTab").then((m) => ({ default: m.EnergyTab })),
  { ssr: false, loading: () => <TabSkeleton label="Loading energy model" /> },
);
const CalculationsTab = dynamic(
  () => import("@/components/tabs/inunit-hvac/CalculationsTab").then((m) => ({ default: m.CalculationsTab })),
  { ssr: false, loading: () => <TabSkeleton label="Loading calculations" /> },
);
const MethodologyTab = dynamic(
  () => import("@/components/tabs/inunit-hvac/MethodologyTab").then((m) => ({ default: m.MethodologyTab })),
  { ssr: false, loading: () => <TabSkeleton label="Loading methodology" /> },
);

type TabId =
  | "overview"
  | "equipment"
  | "energy"
  | "retrofit"
  | "calculations"
  | "methodology";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

// Tab order mirrors the DHW calculator: Overview → input tabs → energy →
// calculations → methodology. Overview is the landing page (system-type
// picker + how-to); Calculations is the step-by-step worked example that
// substitutes current inputs into every formula the engine runs.
const TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "equipment", label: "Equipment", icon: Sliders },
  { id: "energy", label: "Energy & cost", icon: BarChart3 },
  { id: "retrofit", label: "Retrofit comparison", icon: Wand2 },
  { id: "calculations", label: "Calculations", icon: Sigma },
  { id: "methodology", label: "Methodology", icon: Book },
];

export default function InUnitHvacCalculator() {
  const { inputs, setInputs, update, switchSystemType, reset } = useInUnitHvacInputs();
  const [tab, setTab] = useState<TabId>("overview");

  const result = useMemo(() => runCalc(inputs), [inputs]);

  return (
    <div style={{ background: "var(--background)" }}>
      <TopTabNav<TabId>
        label={{
          icon: AirVent,
          text: "In-unit HVAC Calculator",
          iconColor: "var(--accent-blue)",
        }}
        tabs={TABS}
        active={tab}
        onSelect={setTab}
        trailing={
          <span>
            {fmt(result.totalAnnualKWh, 0)} kWh · {fmtUSD(result.totalAnnualCost, 0)}/yr ·{" "}
            {fmt(result.totalAnnualCarbon, 0)} lb CO₂
          </span>
        }
      />

      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "32px 32px 80px",
        }}
        className="animate-fade-in"
        key={tab}
      >
        {tab === "overview" && (
          <OverviewTab inputs={inputs} switchSystemType={switchSystemType} />
        )}
        {tab === "equipment" && (
          <EquipmentTab
            inputs={inputs}
            update={update}
            switchSystemType={switchSystemType}
            reset={reset}
          />
        )}
        {tab === "energy" && <EnergyTab inputs={inputs} result={result} />}
        {tab === "retrofit" && (
          <RetrofitTab currentInputs={inputs} onChangeCurrent={setInputs} />
        )}
        {tab === "calculations" && <CalculationsTab inputs={inputs} result={result} />}
        {tab === "methodology" && <MethodologyTab />}
      </main>
    </div>
  );
}
