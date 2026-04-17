"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Book, Building2, Calculator, ClipboardList, Droplets, FileText, Gauge, Home,
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
    const base: TabDef[] = [
      { id: "building", label: "Building & System", icon: Building2 },
      { id: "demand", label: "Demand", icon: Droplets },
      { id: "current", label: "Current Design", icon: ClipboardList },
      { id: "autosize", label: "Auto-Size", icon: Gauge },
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
      { id: "energy", label: "Energy Model", icon: Calculator },
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <nav
        style={{
          background: "#0F1E40",
          color: "rgba(255,255,255,0.85)",
          height: 58,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>💧</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#fff", letterSpacing: "-0.01em" }}>
              DHW Sizing Calculator
            </div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Multifamily ASHRAE/ASPE
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, marginLeft: 16, flex: 1, flexWrap: "wrap" }}>
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
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 9,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isActive ? "rgba(5,150,105,0.5)" : "rgba(255,255,255,0.1)",
                  }}
                >
                  <Icon size={12} />
                </span>
                {item.label}
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 500, marginLeft: 4 }}>
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
          {sys.short} · {result.totalUnits} units
        </div>
      </nav>

      <main
        style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px 48px" }}
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
