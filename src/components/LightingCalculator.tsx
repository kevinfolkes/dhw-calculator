"use client";

/**
 * LightingCalculator — multifamily lighting end-use modeler. Mirrors the
 * `InUnitHvacCalculator` shape (TopTabNav + per-tab routing), with all
 * tabs extracted to separate files under `tabs/lighting/`.
 *
 * Tabs:
 *   1. Equipment    — current-state input form (counts, watts, hours, controls per category)
 *   2. Energy       — annual + monthly rollup (LAZY — recharts chunk)
 *   3. Retrofit     — current-vs-proposed comparison with savings + payback
 *   4. Methodology  — sources + LPD compliance walkthrough (LAZY — long-form prose)
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Book,
  Lightbulb,
  Sliders,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { runCalc } from "@/lib/lighting/pipeline";
import { useLightingInputs } from "@/hooks/useLightingInputs";
import { fmt, fmtUSD } from "@/lib/utils";
import { TopTabNav } from "@/components/TopTabNav";
import { EquipmentTab } from "@/components/tabs/lighting/EquipmentTab";
import { RetrofitTab } from "@/components/tabs/lighting/RetrofitTab";
import { TabSkeleton } from "@/components/ui/TabSkeleton";

// ─── Lazy-loaded heavy tabs ────────────────────────────────────────────────
// EnergyTab pulls in recharts (~80–100KB gzipped); MethodologyTab is ~900
// lines of long-form prose. Deferred so first-paint shows Equipment
// immediately. `ssr: false` is fine — static export hydrates on the client.
const EnergyTab = dynamic(
  () => import("@/components/tabs/lighting/EnergyTab").then((m) => ({ default: m.EnergyTab })),
  { ssr: false, loading: () => <TabSkeleton label="Loading energy model" /> },
);
const MethodologyTab = dynamic(
  () => import("@/components/tabs/lighting/MethodologyTab").then((m) => ({ default: m.MethodologyTab })),
  { ssr: false, loading: () => <TabSkeleton label="Loading methodology" /> },
);

type TabId = "equipment" | "energy" | "retrofit" | "methodology";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: "equipment", label: "Equipment", icon: Sliders },
  { id: "energy", label: "Energy & cost", icon: BarChart3 },
  { id: "retrofit", label: "Retrofit comparison", icon: Wand2 },
  { id: "methodology", label: "Methodology", icon: Book },
];

export default function LightingCalculator() {
  const { inputs, setInputs, update, updateCategory, reset } = useLightingInputs();
  const [tab, setTab] = useState<TabId>("equipment");

  const result = useMemo(() => runCalc(inputs), [inputs]);

  return (
    <div style={{ background: "var(--background)" }}>
      <TopTabNav<TabId>
        label={{
          icon: Lightbulb,
          text: "Lighting Calculator",
          iconColor: "var(--accent-amber)",
        }}
        tabs={TABS}
        active={tab}
        onSelect={setTab}
        trailing={
          <span>
            {fmt(result.annualKWh, 0)} kWh · {fmtUSD(result.annualCost, 0)}/yr ·{" "}
            {fmt(result.annualCarbon, 0)} lb CO₂
          </span>
        }
      />

      {/* MAIN CONTENT — full-width centered */}
      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "32px 32px 80px",
        }}
        className="animate-fade-in"
        key={tab}
      >
        {tab === "equipment" && (
          <EquipmentTab inputs={inputs} update={update} updateCategory={updateCategory} reset={reset} />
        )}
        {tab === "energy" && <EnergyTab result={result} />}
        {tab === "retrofit" && (
          <RetrofitTab currentInputs={inputs} onChangeCurrent={setInputs} />
        )}
        {tab === "methodology" && <MethodologyTab />}
      </main>
    </div>
  );
}
