"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Book, Building2, Calculator, ClipboardList, Droplets, FileText, GitCompare, Gauge, Home,
  LayoutGrid, Sigma, ThermometerSun,
} from "lucide-react";
import { runCalc } from "@/lib/calc/pipeline";
import type { DhwInputs } from "@/lib/calc/inputs";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import { useDhwInputs } from "@/hooks/useDhwInputs";
import { OverviewTab } from "@/components/tabs/OverviewTab";
import { BuildingTab } from "@/components/tabs/BuildingTab";
import { DemandTab } from "@/components/tabs/DemandTab";
import { CurrentDesignTab } from "@/components/tabs/CurrentDesignTab";
import { AutoSizeTab } from "@/components/tabs/AutoSizeTab";
import { SizingTab } from "@/components/tabs/SizingTab";
import { EquipmentTab } from "@/components/tabs/EquipmentTab";
import { CombiTab } from "@/components/tabs/CombiTab";
import { EnergyTab } from "@/components/tabs/EnergyTab";
import { CalculationsTab } from "@/components/tabs/CalculationsTab";
import { ComplianceTab } from "@/components/tabs/ComplianceTab";
import { MethodologyTab } from "@/components/tabs/MethodologyTab";
import { ReportsTab } from "@/components/tabs/ReportsTab";
import { CompareTab } from "@/components/tabs/CompareTab";
import { exportDOCX, exportPDF } from "@/lib/export/submittal";
import { SideTabNav, type SideTab, type SideTabGroup } from "@/components/SideTabNav";
import type { SizingRec } from "@/lib/calc/types";
import type { GasTankSize, GasTankType, GasTanklessInput, HPWHTankSize } from "@/lib/engineering/constants";
import { fmt } from "@/lib/utils";

type TabId =
  | "overview"
  | "building"
  | "demand"
  | "current"
  | "autosize"
  | "sizing"
  | "tech"
  | "combi"
  | "energy"
  | "calculations"
  | "methodology"
  | "compliance"
  | "reports"
  | "compare";

// ─── Type guards for SizingRec → DhwInputs narrowing ───────────────────────
// SizingRec uses an open `[k: string]: unknown` index signature so it can
// carry per-system-type fields (tankGal, subtype, inputMBH, kW, cap, …)
// without forcing every consumer to handle every field. These guards
// validate runtime values against the specific union members DhwInputs
// expects, replacing what used to be `as` type assertions in the auto-size
// apply handlers. If the engine ever emits a value outside the allowed
// set the guard returns false and the field is left untouched.

const GAS_TANK_SIZES: readonly GasTankSize[] = [40, 50, 75, 100];
const HPWH_TANK_SIZES: readonly HPWHTankSize[] = [50, 66, 80, 120];
const GAS_TANKLESS_INPUTS: readonly GasTanklessInput[] = [150, 180, 199];

function isGasTankSize(v: unknown): v is GasTankSize {
  return typeof v === "number" && (GAS_TANK_SIZES as readonly number[]).includes(v);
}

function isHPWHTankSize(v: unknown): v is HPWHTankSize {
  return typeof v === "number" && (HPWH_TANK_SIZES as readonly number[]).includes(v);
}

function isGasTanklessInput(v: unknown): v is GasTanklessInput {
  return typeof v === "number" && (GAS_TANKLESS_INPUTS as readonly number[]).includes(v);
}

function isGasTankType(v: unknown): v is GasTankType {
  return v === "atmospheric" || v === "condensing";
}

export default function DhwCalculator() {
  const { inputs, setInputs, update, shareURL } = useDhwInputs();
  const [tab, setTab] = useState<TabId>("overview");
  const [toast, setToast] = useState<string | null>(null);

  const result = useMemo(() => runCalc(inputs), [inputs]);
  const sys = SYSTEM_TYPES[inputs.systemType];

  // Grouped tab structure — surfaces the workflow stages DHW actually has:
  // configure inputs → evaluate against current design / auto-sized
  // alternatives → read the math / methodology → produce a compliance
  // submittal or saved report. SideTabNav renders each group with a
  // collapsible header so users navigating 13 tabs can scope the visible
  // nav to the stage they're working in.
  const groups: SideTabGroup<TabId>[] = useMemo(() => {
    const inputsGroup: SideTab<TabId>[] = [
      { id: "overview", label: "Overview", icon: LayoutGrid },
      { id: "building", label: "Building & System", icon: Building2 },
      { id: "demand", label: "Demand", icon: Droplets },
    ];
    if (sys.topology === "central") {
      inputsGroup.push(
        { id: "sizing", label: "Sizing", icon: Gauge },
        { id: "tech", label: "Equipment", icon: ThermometerSun },
      );
    } else {
      const combiLabel =
        sys.hasSpaceHeating && sys.tech === "hpwh"
          ? "In-Unit Combi HPWH"
          : sys.hasSpaceHeating && sys.tech === "gas"
          ? "In-Unit Combi Gas"
          : sys.tech === "gas" && sys.subtech === "tankless"
          ? "In-Unit Tankless"
          : sys.tech === "gas"
          ? "In-Unit Gas Tank"
          : "In-Unit DHW";
      inputsGroup.push({ id: "combi", label: combiLabel, icon: Home });
    }
    return [
      { title: "Inputs", tabs: inputsGroup },
      {
        title: "Evaluation",
        tabs: [
          { id: "current", label: "Current Design", icon: ClipboardList },
          { id: "autosize", label: "Auto-Size", icon: Gauge },
          { id: "energy", label: "Energy Model", icon: Calculator },
        ],
      },
      {
        title: "Documentation",
        tabs: [
          { id: "calculations", label: "Calculations", icon: Sigma },
          { id: "methodology", label: "Methodology", icon: Book },
        ],
      },
      {
        title: "Output",
        tabs: [
          { id: "compliance", label: "Compliance", icon: FileText },
          { id: "reports", label: "Reports", icon: FileText },
          { id: "compare", label: "Compare", icon: GitCompare },
        ],
      },
    ];
  }, [sys]);

  // Keep active tab valid as system type changes (the inputs-group content
  // varies with topology — sizing/equipment for central, combi for in-unit).
  useEffect(() => {
    const allIds = groups.flatMap((g) => g.tabs.map((t) => t.id));
    if (!allIds.includes(tab)) setTab("overview");
  }, [groups, tab]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto-size apply handlers — both variants funnel through the same
  // `applySizingRec` so the type-narrowing logic lives in one place. The
  // type guards convert SizingRec's loose `[k: string]: unknown` fields
  // into the specific union members the DhwInputs schema expects,
  // replacing the previous `as` casts that bypassed the type system.
  const applyRecommended = () => {
    const rec = result.autoSize?.recommended;
    if (!rec) return;
    applySizingRec(rec);
    setToast(
      `Applied recommended sizing: ${Object.entries(rec)
        .filter(([k]) => !["capCost", "annCost", "total15"].includes(k))
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(", ")}`,
    );
  };

  const applyLifecycle = () => {
    const rec = result.autoSize?.lifecycle;
    if (!rec) return;
    applySizingRec(rec);
    setToast("Applied lifecycle-optimal sizing");
  };

  const applySizingRec = (rec: SizingRec) => {
    const next: DhwInputs = { ...inputs };

    if (inputs.systemType === "inunit_gas_tank" || inputs.systemType === "inunit_combi_gas") {
      if (isGasTankSize(rec.tankGal)) next.gasTankSize = rec.tankGal;
      if (isGasTankType(rec.subtype)) next.gasTankType = rec.subtype;
    } else if (inputs.systemType === "inunit_hpwh" || inputs.systemType === "inunit_combi") {
      if (isHPWHTankSize(rec.tankGal)) next.combiTankSize = rec.tankGal;
    }

    if (inputs.systemType === "inunit_gas_tankless" && isGasTanklessInput(rec.inputMBH)) {
      next.gasTanklessInput = rec.inputMBH;
    }

    setInputs(next);
  };

  const handleCopyLink = async () => {
    const url = shareURL();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Share link copied to clipboard");
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const handleExportPDF = async () => {
    try {
      await exportPDF(inputs, result);
      setToast("PDF submittal exported");
    } catch (e) {
      console.error(e);
      setToast("PDF export failed — check console");
    }
  };

  const handleExportDOCX = async () => {
    try {
      await exportDOCX(inputs, result);
      setToast("DOCX submittal exported");
    } catch (e) {
      console.error(e);
      setToast("DOCX export failed — check console");
    }
  };

  return (
    <div
      style={{
        background: "var(--background)",
        display: "flex",
        alignItems: "stretch",
        minHeight: "calc(100vh - 48px)",
      }}
    >
      <SideTabNav<TabId>
        label={{ icon: Droplets, text: "DHW Calculator" }}
        groups={groups}
        active={tab}
        onSelect={setTab}
        trailing={
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {sys.short}
            </div>
            <div style={{ marginTop: 2 }}>
              {fmt(result.totalUnits, 0)} units · {result.totalOccupants.toFixed(0)} occ
            </div>
          </div>
        }
      />
      {/* MAIN CONTENT — flexes to fill remaining width; content stays
          centered at the usual 1100px max so reading width matches the
          other calculators. */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "32px 32px 80px",
        }}
        className="animate-fade-in"
        key={tab}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {tab === "overview" && <OverviewTab inputs={inputs} update={update} />}
        {tab === "building" && <BuildingTab inputs={inputs} update={update} />}
        {tab === "demand" && <DemandTab inputs={inputs} update={update} result={result} />}
        {tab === "current" && <CurrentDesignTab inputs={inputs} result={result} />}
        {tab === "autosize" && (
          <AutoSizeTab
            inputs={inputs}
            result={result}
            onApplyRecommended={applyRecommended}
            onApplyLifecycle={applyLifecycle}
          />
        )}
        {tab === "sizing" && <SizingTab result={result} />}
        {tab === "tech" && <EquipmentTab inputs={inputs} update={update} result={result} />}
        {tab === "combi" && <CombiTab inputs={inputs} update={update} result={result} />}
        {tab === "energy" && <EnergyTab inputs={inputs} result={result} />}
        {tab === "calculations" && <CalculationsTab inputs={inputs} result={result} />}
        {tab === "methodology" && <MethodologyTab />}
        {tab === "compliance" && (
          <ComplianceTab
            result={result}
            onExportPDF={handleExportPDF}
            onExportDOCX={handleExportDOCX}
            onShareLink={handleCopyLink}
          />
        )}
        {tab === "reports" && (
          <ReportsTab inputs={inputs} result={result} setInputs={setInputs} />
        )}
        {tab === "compare" && <CompareTab inputs={inputs} result={result} />}
        </div>
      </main>

      {toast && <div className="ve-toast">{toast}</div>}
    </div>
  );
}
