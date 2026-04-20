"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Book, Building2, Calculator, ClipboardList, Droplets, FileText, Gauge, Home, Sigma,
  ThermometerSun, type LucideIcon,
} from "lucide-react";
import { runCalc } from "@/lib/calc/pipeline";
import type { DhwInputs } from "@/lib/calc/inputs";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import { useDhwInputs } from "@/hooks/useDhwInputs";
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
import { exportDOCX, exportPDF } from "@/lib/export/submittal";

type TabId =
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
  | "compliance";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

export default function DhwCalculator() {
  const { inputs, setInputs, update, shareURL } = useDhwInputs();
  const [tab, setTab] = useState<TabId>("building");
  const [toast, setToast] = useState<string | null>(null);

  const result = useMemo(() => runCalc(inputs), [inputs]);
  const sys = SYSTEM_TYPES[inputs.systemType];

  const tabs: TabDef[] = useMemo(() => {
    // Order enforces a linear flow: each tab's outputs depend only on inputs
    // chosen in earlier tabs. Equipment selections come before the evaluation
    // tabs (Current Design, Auto-Size, Energy) that reference them.
    const base: TabDef[] = [
      { id: "building", label: "Building & System", icon: Building2 },
      { id: "demand", label: "Demand", icon: Droplets },
    ];
    if (sys.topology === "central") {
      base.push(
        { id: "sizing", label: "Sizing", icon: Gauge },
        { id: "tech", label: "Equipment", icon: ThermometerSun },
      );
    } else {
      const label =
        sys.hasSpaceHeating && sys.tech === "hpwh"
          ? "In-Unit Combi HPWH"
          : sys.hasSpaceHeating && sys.tech === "gas"
          ? "In-Unit Combi Gas"
          : sys.tech === "gas" && sys.subtech === "tankless"
          ? "In-Unit Tankless"
          : sys.tech === "gas"
          ? "In-Unit Gas Tank"
          : "In-Unit DHW";
      base.push({ id: "combi", label, icon: Home });
    }
    base.push(
      { id: "current", label: "Current Design", icon: ClipboardList },
      { id: "autosize", label: "Auto-Size", icon: Gauge },
      { id: "energy", label: "Energy Model", icon: Calculator },
      { id: "calculations", label: "Calculations", icon: Sigma },
      { id: "methodology", label: "Methodology", icon: Book },
      { id: "compliance", label: "Compliance", icon: FileText },
    );
    return base;
  }, [sys]);

  // Keep active tab valid as system type changes
  useEffect(() => {
    if (!tabs.find((t) => t.id === tab)) setTab("building");
  }, [tabs, tab]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto-size apply handlers
  const applyRecommended = () => {
    const rec = result.autoSize?.recommended;
    if (!rec) return;
    const next: DhwInputs = { ...inputs };
    const tankGal = rec.tankGal as DhwInputs["combiTankSize"] | DhwInputs["gasTankSize"] | undefined;
    if (tankGal != null) {
      if (inputs.systemType === "inunit_gas_tank" || inputs.systemType === "inunit_combi_gas") {
        next.gasTankSize = tankGal as DhwInputs["gasTankSize"];
      } else if (inputs.systemType === "inunit_hpwh" || inputs.systemType === "inunit_combi") {
        next.combiTankSize = tankGal as DhwInputs["combiTankSize"];
      }
    }
    if (rec.inputMBH != null && inputs.systemType === "inunit_gas_tankless") {
      next.gasTanklessInput = rec.inputMBH as DhwInputs["gasTanklessInput"];
    }
    if (rec.subtype != null && (inputs.systemType === "inunit_gas_tank" || inputs.systemType === "inunit_combi_gas")) {
      next.gasTankType = rec.subtype as DhwInputs["gasTankType"];
    }
    setInputs(next);
    setToast(`Applied recommended sizing: ${Object.entries(rec).filter(([k]) => !["capCost", "annCost", "total15"].includes(k)).map(([k, v]) => `${k}=${String(v)}`).join(", ")}`);
  };

  const applyLifecycle = () => {
    const rec = result.autoSize?.lifecycle;
    if (!rec) return;
    const next: DhwInputs = { ...inputs };
    const tankGal = rec.tankGal as DhwInputs["combiTankSize"] | DhwInputs["gasTankSize"] | undefined;
    if (tankGal != null) {
      if (inputs.systemType === "inunit_gas_tank" || inputs.systemType === "inunit_combi_gas") {
        next.gasTankSize = tankGal as DhwInputs["gasTankSize"];
      } else if (inputs.systemType === "inunit_hpwh" || inputs.systemType === "inunit_combi") {
        next.combiTankSize = tankGal as DhwInputs["combiTankSize"];
      }
    }
    if (rec.inputMBH != null && inputs.systemType === "inunit_gas_tankless") {
      next.gasTanklessInput = rec.inputMBH as DhwInputs["gasTanklessInput"];
    }
    if (rec.subtype != null && (inputs.systemType === "inunit_gas_tank" || inputs.systemType === "inunit_combi_gas")) {
      next.gasTankType = rec.subtype as DhwInputs["gasTankType"];
    }
    setInputs(next);
    setToast("Applied lifecycle-optimal sizing");
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

  const SIDEBAR_WIDTH = 232;

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex" }}>
      {/* LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          background: "#0F1E40",
          color: "rgba(255,255,255,0.85)",
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Brand header */}
        <div
          style={{
            padding: "18px 18px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 22 }}>💧</span>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: "#fff",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            DHW Sizing
            <br />
            Calculator
          </div>
        </div>

        {/* Nav list */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {tabs.map((item, i) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.60)",
                  fontSize: 12.5,
                  fontWeight: isActive ? 700 : 500,
                  textAlign: "left",
                  transition: "background 120ms ease, color 120ms ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.85)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(255,255,255,0.60)";
                  }
                }}
              >
                {isActive && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 6,
                      bottom: 6,
                      width: 3,
                      background: "#7DD3A3",
                      borderRadius: "0 3px 3px 0",
                    }}
                  />
                )}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: isActive ? "rgba(125,211,163,0.9)" : "rgba(255,255,255,0.35)",
                    letterSpacing: "0.08em",
                    width: 18,
                    flexShrink: 0,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isActive
                      ? "rgba(125,211,163,0.18)"
                      : "rgba(255,255,255,0.06)",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={13} />
                </span>
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer: system summary */}
        <div
          style={{
            padding: "14px 18px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontSize: 9.5,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Current config
          </div>
          <div style={{ color: "rgba(255,255,255,0.92)", fontWeight: 600 }}>{sys.short}</div>
          <div style={{ color: "rgba(255,255,255,0.55)" }}>
            {result.totalUnits} {result.totalUnits === 1 ? "unit" : "units"} ·{" "}
            {result.totalOccupants.toFixed(0)} occ
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          minWidth: 0, // allow flex child to shrink below content width
          padding: "24px 32px 48px",
          maxWidth: 1280,
        }}
        className="animate-fade-in"
        key={tab}
      >
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
      </main>

      {toast && <div className="ve-toast">{toast}</div>}
    </div>
  );
}
