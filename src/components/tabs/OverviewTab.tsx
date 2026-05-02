"use client";

import type { ReactNode } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { SYSTEM_TYPES, type SystemTypeKey } from "@/lib/engineering/system-types";
import type { DhwInputs } from "@/lib/calc/inputs";

/**
 * Overview / "start here" tab. A reference page that surveys every DHW system
 * type the calculator can model, grouped by topology (Central vs In-Unit),
 * with a short editorial line on when to choose each. Lets a user click any
 * tile to load that system into the calculator before entering the rest of
 * the inputs. No engineering math here — purely descriptive.
 */
interface Props {
  inputs: DhwInputs;
  update: <K extends keyof DhwInputs>(key: K, value: DhwInputs[K]) => void;
}

/** Editorial "best for" line per system type. Short, opinionated, project-typology focused. */
const BEST_FOR: Record<SystemTypeKey, string> = {
  central_gas:
    "Baseline gas plant with storage + recirc. Use as the comparison case for electrification studies.",
  central_resistance:
    "Rare new install. Mostly used as redundant peaking or where HPWH is infeasible (no mech-room ventilation, etc.).",
  central_hpwh:
    "Default electrification path when mech-room ambient is favorable (annual avg > 50°F).",
  central_per_floor:
    "Mid-rise (4-12 stories) where a single central plant has too much recirc loop and full in-unit takes too much closet space.",
  central_hrc:
    "Mixed-use buildings with year-round cooling load (data centers, retail, hotels). Captures rejected condenser heat that would otherwise dump outside.",
  central_wastewater_hp:
    "Large all-electric MF where sewer access is feasible. Source temp ~60°F year-round gives much higher COP than air-source HPWH in cold climates.",
  central_gas_tankless:
    "Mid-rise where mech-room space is tight and modulating turndown matters more than storage buffering.",
  central_indirect:
    "Older urban high-rise where one boiler already serves both heating and DHW via plate HX or indirect tank.",
  central_hybrid:
    "Cold-climate electrification (4A+). HPWH carries shoulder seasons; gas backup handles winter peaks and rapid recovery.",
  central_steam_hx:
    "Buildings on district steam (Con Ed-style) or with an existing steam plant — common in NYC, Boston, Chicago older stock.",
  central_chp:
    "Mid-rise + high-rise MF with year-round high electric and DHW load. CHP makes sense when run hours stay above ~5,000/yr and the building can either consume or net-meter the electric output.",
  inunit_gas_tank:
    "Per-apartment gas tank with tenant-paid utilities. Standard for low-rise + townhomes.",
  inunit_gas_tankless:
    "Per-apartment instantaneous. Saves closet space; requires high gas service per unit.",
  inunit_hpwh:
    "All-electric DHW per apartment. Pair with VRF or mini-split for heating.",
  inunit_combi:
    "One HPWH per apartment serves DHW + hydronic fan coil. Simplest all-electric retrofit.",
  inunit_combi_gas:
    "Gas tank serves DHW + hydronic fan coil (Aquatherm-style). Common in low/mid-rise where one appliance covers both loads at low capex.",
  inunit_combi_gas_tankless:
    "Modulating condensing tankless gas + buffer tank for both DHW and hydronic heating per unit. Saves closet space versus a tank combi.",
  inunit_resistance:
    "Per-apartment electric resistance tank. Use only where HPWH is infeasible — uneconomic at scale due to electric rates.",
  inunit_combi_resistance:
    "Per-apartment electric resistance tank serving DHW + hydronic. Niche all-electric option where HPWH won't fit.",
};

export function OverviewTab({ inputs, update }: Props) {
  const central: SystemTypeKey[] = [];
  const inunit: SystemTypeKey[] = [];
  for (const key of Object.keys(SYSTEM_TYPES) as SystemTypeKey[]) {
    if (SYSTEM_TYPES[key].topology === "central") central.push(key);
    else inunit.push(key);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <CardHeader>
          <CardTitle>Multifamily DHW Sizing Calculator</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            This tool sizes domestic-hot-water systems for multifamily buildings using
            published engineering standards (ASHRAE Apps Ch. 51, ASPE Vol. 2, AHRI 1300/1700,
            NEEA AWHS). Every coefficient is traceable to a source — see the{" "}
            <Em>Methodology</Em> tab for the full data dictionary.
          </p>
          <p>
            The calculator currently supports{" "}
            <strong>{Object.keys(SYSTEM_TYPES).length} system types</strong> across two
            topologies. Pick the one that matches your project below to load it as the
            starting point, then walk through the input tabs in order: Building & System →
            Demand → Equipment → Current Design → Auto-Size → Energy Model.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to use this tool</CardTitle>
        </CardHeader>
        <Prose>
          <ol style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Pick a system type</strong> below, or change it later on the Building
              & System tab.
            </li>
            <li>
              <strong>Fill in the building inputs</strong> — unit mix, climate zone, occupancy
              profile. Climate-derived defaults (e.g., inlet water temp) auto-fill where possible.
            </li>
            <li>
              <strong>Review demand</strong> — three methods (ASHRAE peak hour, Modified Hunter,
              occupancy-based) run in parallel; the governing method drives sizing.
            </li>
            <li>
              <strong>Enter your equipment selection</strong> on the system-specific tab (Sizing
              + Equipment for central; In-Unit Combi/Tank/Tankless/HPWH for in-unit).
            </li>
            <li>
              <strong>Compare against Auto-Size</strong> — the tool produces three sizing
              philosophies (minimum / recommended / 15-yr lifecycle-optimal) and shows whether
              your selection passes each.
            </li>
            <li>
              <strong>Save the report</strong> on the Reports tab to revisit or compare against
              other configurations later. Export as PDF / DOCX / Excel / CSV from there.
            </li>
          </ol>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Central systems ({central.length})</CardTitle>
        </CardHeader>
        <Prose>
          <p style={{ marginBottom: 12 }}>
            Shared mechanical room serving all units via a recirculation loop. Larger upfront
            footprint but lower per-unit equipment cost; supports professional maintenance and
            tighter Legionella control via swing-tank or thermal-disinfection cycles.
          </p>
        </Prose>
        <SystemGrid keys={central} active={inputs.systemType} onPick={(k) => update("systemType", k)} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>In-unit systems ({inunit.length})</CardTitle>
        </CardHeader>
        <Prose>
          <p style={{ marginBottom: 12 }}>
            One water heater per apartment. No shared recirc loop, no central mech room.
            Tenant-paid utilities are easy; failure of one unit doesn&apos;t affect the
            building. Combi variants serve both DHW and hydronic space heating from a single
            appliance.
          </p>
        </Prose>
        <SystemGrid keys={inunit} active={inputs.systemType} onPick={(k) => update("systemType", k)} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s not yet modeled</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            The taxonomy is being expanded under a phased roadmap. Coming soon:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>In-unit completeness</strong> — tankless gas combi (modulating + buffer
              tank), electric resistance variants
            </li>
            <li>
              <strong>Preheat modifiers</strong> — solar thermal, drainwater heat recovery
              (DWHR) — apply to any base system
            </li>
            <li>
              <strong>Recirculation control modes</strong> — continuous, time-clock, demand-
              triggered, aquastat-modulated
            </li>
            <li>
              <strong>Specialty central</strong> — per-floor decentralized HPWH, heat-recovery
              chiller integration, wastewater heat-pump
            </li>
            <li>
              <strong>Cooling loads + annual energy across all end uses</strong> — pivots this
              from a DHW calculator to a full multifamily load modeler
            </li>
          </ul>
        </Prose>
      </Card>
    </div>
  );
}

function SystemGrid({
  keys,
  active,
  onPick,
}: {
  keys: SystemTypeKey[];
  active: SystemTypeKey;
  onPick: (k: SystemTypeKey) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 12,
        padding: "8px 16px 16px 16px",
      }}
    >
      {keys.map((k) => (
        <SystemTile key={k} k={k} active={active === k} onPick={() => onPick(k)} />
      ))}
    </div>
  );
}

function SystemTile({
  k,
  active,
  onPick,
}: {
  k: SystemTypeKey;
  active: boolean;
  onPick: () => void;
}) {
  const sys = SYSTEM_TYPES[k];
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        textAlign: "left",
        cursor: "pointer",
        background: active ? "rgba(125, 211, 163, 0.06)" : "var(--card-bg, #fff)",
        border: active
          ? "2px solid var(--accent-emerald, #4caf80)"
          : "1px solid var(--border, rgba(0,0,0,0.08))",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: 0,
        font: "inherit",
        color: "inherit",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
    >
      <div style={{ height: 4, background: sys.color, width: "100%" }} />
      <div style={{ padding: "12px 14px 14px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 14, lineHeight: 1.3 }}>{sys.short}</strong>
          {active && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "var(--accent-emerald, #4caf80)",
                color: "#fff",
                fontWeight: 600,
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              Active
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary, #555)", lineHeight: 1.45 }}>
          {sys.description}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary, #777)",
            lineHeight: 1.4,
            fontStyle: "italic",
          }}
        >
          Best for: {BEST_FOR[k]}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-tertiary, #888)",
            marginTop: 4,
            fontFamily: "var(--font-mono, JetBrains Mono, monospace)",
            lineHeight: 1.4,
          }}
        >
          {sys.archetypes}
        </div>
      </div>
    </button>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 16px 16px 16px",
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--text-primary, #222)",
      }}
    >
      {children}
    </div>
  );
}

function Em({ children }: { children: ReactNode }) {
  return <em style={{ fontStyle: "italic", color: "var(--text-secondary, #444)" }}>{children}</em>;
}
