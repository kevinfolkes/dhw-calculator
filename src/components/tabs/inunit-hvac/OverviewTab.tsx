"use client";

import type { ReactNode } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  INUNIT_HVAC_SYSTEM_SPECS,
  type InUnitHvacInputs,
  type InUnitHvacSystemType,
} from "@/lib/inunit-hvac/inputs";
import { INUNIT_HVAC_ARCHETYPE_COLORS as COLOR } from "@/lib/chart-palette";

/**
 * Overview / "start here" tab for the in-unit HVAC calculator. Mirrors the
 * DHW OverviewTab pattern: a reference page that surveys every per-apartment
 * HVAC archetype the calculator can model, with a short editorial line on
 * when to choose each. Lets a user click any tile to load that archetype as
 * the starting point before entering the rest of the inputs. No engineering
 * math — purely descriptive.
 */
interface Props {
  inputs: InUnitHvacInputs;
  switchSystemType: (s: InUnitHvacSystemType) => void;
}

/** Short editorial "best for" line per archetype. Project-typology focused so
 *  the user can make an apples-to-apples picking decision. */
const BEST_FOR: Record<InUnitHvacSystemType, string> = {
  ptac_resistance:
    "Comparison case for electrification studies. The default in 1980s–2010s mid-rise MF — through-wall sleeve, cheap to install, expensive to operate.",
  pthp:
    "Like-for-like PTAC retrofit when the through-wall sleeve stays. ~2–3× cheaper to operate than PTAC+resistance below the balance point (~35°F).",
  minisplit_hp:
    "Default electrification path for CZ1A–4A. ENERGY STAR baseline; qualifies for most utility heat-pump rebate programs.",
  minisplit_cool_resist:
    "Cooling-only retrofit where existing baseboards stay in place. Adds AC without touching the heating distribution — heating cost unchanged.",
  window_ac_resist:
    "Pre-2000s urban MF baseline. Replace with mini-split, central HP, or PTHP for material savings on both sides.",
  ccshp:
    "Cold-climate (CZ5A+) electrification target. Maintains ≥ 70% capacity at 5°F where standard HPs lose 50%. Required for full electrification without resistance backup.",
  central_split_hp:
    "Townhouse-style MF, garden apartments, newer mid-rise (since ~2015). Outdoor condenser + indoor AHU + apartment ductwork; single thermostat per apt.",
  central_split_ac_resist:
    "Pre-2010s ducted central installations. Strong retrofit target — drop-in HP replacement keeps the ducts and outdoor pad while cutting heating cost ~60%.",
};

/** Compact equipment-spec line shown on each tile — capacity + cooling/
 *  heating efficiency at the archetype's defaults. */
function specLine(k: InUnitHvacSystemType): string {
  const s = INUNIT_HVAC_SYSTEM_SPECS[k];
  const cool = `${(s.coolingBtuh / 1000).toFixed(0)}k BTU/h cool · ${s.coolingEff} ${s.coolingMetric}`;
  const heat =
    s.heatingMetric === "resistance"
      ? "resistance heat"
      : `${(s.heatingBtuh / 1000).toFixed(0)}k BTU/h heat · ${s.heatingEff} ${s.heatingMetric}`;
  return `${cool}  ·  ${heat}`;
}

export function OverviewTab({ inputs, switchSystemType }: Props) {
  // Two groupings mirror the DHW Overview's central/in-unit split. For
  // in-unit HVAC the meaningful cut is the indoor-unit installation pattern:
  // through-wall (chassis-style) vs split (separate outdoor + indoor + maybe
  // ducts). Window AC sits in through-wall conceptually; cold-climate is a
  // mini-split variant.
  const throughWall: InUnitHvacSystemType[] = [
    "ptac_resistance",
    "pthp",
    "window_ac_resist",
  ];
  const split: InUnitHvacSystemType[] = [
    "minisplit_hp",
    "minisplit_cool_resist",
    "ccshp",
    "central_split_hp",
    "central_split_ac_resist",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <CardHeader>
          <CardTitle>Multifamily In-Unit HVAC Calculator</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            This tool models per-apartment cooling and heating equipment for
            multifamily buildings using published engineering standards
            (ASHRAE 90.1-2022 §6.4, AHRI 210/240, AHRI 310/380, ENERGY STAR
            Central AC/HP v6.1, NEEP Cold Climate ASHP). Every coefficient is
            traceable to a source — see the <Em>Methodology</Em> tab for the
            full data dictionary.
          </p>
          <p>
            The calculator currently supports{" "}
            <strong>
              {Object.keys(INUNIT_HVAC_SYSTEM_SPECS).length} archetypes
            </strong>{" "}
            across two installation patterns: through-wall (chassis-style)
            and split (separate outdoor / indoor units, with or without
            apartment ductwork). Pick one below to load it as the starting
            point, then walk through the input tabs in order: Equipment →
            Energy &amp; cost → Retrofit comparison → Calculations.
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
              <strong>Pick an archetype</strong> below, or change it later on
              the Equipment tab. Capacity, efficiency, and metric pre-fill
              with typical multifamily values for the chosen type.
            </li>
            <li>
              <strong>Set building context</strong> on the Equipment tab —
              apartment count, climate zone, electric rate, grid subregion.
              Climate zone drives the EFLH lookup that powers all downstream
              math.
            </li>
            <li>
              <strong>Tune per-apartment equipment</strong> — capacity
              (BTU/h), efficiency (SEER2 / EER for cooling, HSPF2 / COP /
              resistance for heating). Override the lookup EFLH only if you
              have metered data.
            </li>
            <li>
              <strong>Review annual + monthly rollup</strong> on the Energy
              &amp; cost tab. Cooling and heating split out separately;
              monthly profile weights by climate-zone HDD/CDD shares.
            </li>
            <li>
              <strong>Compare against a retrofit</strong> on the Retrofit
              tab — current vs proposed savings, simple payback. Smart preset
              picks the right proposed archetype based on climate and
              current-state.
            </li>
            <li>
              <strong>Walk the math</strong> on the Calculations tab to
              verify every number against ASHRAE / AHRI references.
            </li>
            <li>
              <strong>Save the report</strong> to revisit, export, or
              cross-domain compare. Saved retrofits show up in the Reports
              library tagged with the in-unit HVAC domain.
            </li>
          </ol>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Through-wall systems ({throughWall.length})</CardTitle>
        </CardHeader>
        <Prose>
          <p style={{ marginBottom: 12 }}>
            Self-contained chassis units installed in a through-wall sleeve
            or window. No outdoor unit on the roof / balcony, no refrigerant
            line set, no apartment ductwork. Cheapest to install and easiest
            to replace one-for-one, but inherently less efficient than split
            systems because the entire refrigeration cycle sits inside one
            cabinet.
          </p>
        </Prose>
        <SystemGrid
          archetypes={throughWall}
          active={inputs.systemType}
          onPick={switchSystemType}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Split systems ({split.length})</CardTitle>
        </CardHeader>
        <Prose>
          <p style={{ marginBottom: 12 }}>
            Outdoor condensing unit (roof, balcony, or pad) refrigerant-piped
            to one or more indoor units. Higher SEER2/HSPF2 ratings than
            through-wall equipment because the condenser sees outdoor air
            directly. Ductless variants distribute via wall cassettes;
            ducted central uses an indoor air handler + apartment ductwork
            from a single thermostat.
          </p>
        </Prose>
        <SystemGrid
          archetypes={split}
          active={inputs.systemType}
          onPick={switchSystemType}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s calibrated</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Engine v1.1.0 — all 35 calibration assertions pass on every CI
            build. Cross-validated against:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>ASHRAE 90.1-2022 §6.4</strong> — minimum equipment
              efficiency floors for PTAC / PTHP / split / packaged AC and HP
            </li>
            <li>
              <strong>AHRI 210/240-2023</strong> — SEER2 / HSPF2 rating
              standard for split + mini-split + ducted central equipment
            </li>
            <li>
              <strong>AHRI 310/380</strong> — EER / COP rating standard for
              packaged terminal AC, packaged terminal HP, and window AC
            </li>
            <li>
              <strong>ENERGY STAR Central AC/HP v6.1</strong> — utility-rebate
              tier minimum efficiencies (SEER2 ≥ 16.0 / HSPF2 ≥ 8.5)
            </li>
            <li>
              <strong>NEEP Cold Climate ASHP Specification</strong> — capacity
              retention + HSPF2 ≥ 10.0 for CZ5A+ retrofits
            </li>
            <li>
              <strong>DOE Building America MF HVAC reference designs</strong>{" "}
              — published EFLH and EUI bands by climate zone and equipment
              archetype
            </li>
            <li>
              <strong>EPA eGRID 2022</strong> — power-sector subregion
              emission factors (released 2024)
            </li>
            <li>
              <strong>MassSave + NYSERDA field studies</strong> — measured
              retrofit savings ranges informing the 35–65% kWh-reduction
              calibration band
            </li>
          </ul>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s not yet modeled</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Treat results as approximate when these factors are material.
            Full list with engineering rationale on the Methodology tab §10.
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Hour-by-hour capacity derate at low ambients.</strong>{" "}
              The EFLH method captures climate × efficiency at the annual
              scale; misses peak-load nuances.
            </li>
            <li>
              <strong>Peak demand charges.</strong> Some commercial electric
              tariffs charge for peak kW (especially during summer cooling
              peaks). Cost calc here is energy-only ($/kWh).
            </li>
            <li>
              <strong>Defrost cycle penalties</strong> — captured implicitly
              in HSPF2; real-world losses can exceed rating in very cold or
              humid winters.
            </li>
            <li>
              <strong>Refrigerant leakage / GWP.</strong> R-410A and R-32
              leakage adds 50–150 lb CO₂e/yr per apt in scope-1 emissions
              not captured by the eGRID-based scope-2 carbon math.
            </li>
            <li>
              <strong>Ventilation / IAQ interaction.</strong> Out of scope —
              future ventilation calculator handles ASHRAE 62.1 / 62.2
              minimum rates.
            </li>
            <li>
              <strong>Installation labor + commissioning capex.</strong>{" "}
              Real retrofit capex includes installation labor (40–60% of
              equipment cost), refrigerant line pulls, electrical service
              upgrades. Enter installed cost manually in the Retrofit tab.
            </li>
          </ul>
        </Prose>
      </Card>
    </div>
  );
}

// ─── Tile grid ─────────────────────────────────────────────────────────────

function SystemGrid({
  archetypes,
  active,
  onPick,
}: {
  archetypes: InUnitHvacSystemType[];
  active: InUnitHvacSystemType;
  onPick: (k: InUnitHvacSystemType) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12,
        padding: "8px 16px 16px 16px",
      }}
    >
      {archetypes.map((k) => (
        <SystemTile
          key={k}
          k={k}
          active={active === k}
          onPick={() => onPick(k)}
        />
      ))}
    </div>
  );
}

function SystemTile({
  k,
  active,
  onPick,
}: {
  k: InUnitHvacSystemType;
  active: boolean;
  onPick: () => void;
}) {
  const spec = INUNIT_HVAC_SYSTEM_SPECS[k];
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        textAlign: "left",
        cursor: "pointer",
        background: active
          ? "rgba(125, 211, 163, 0.06)"
          : "var(--card-bg, #fff)",
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
      <div style={{ height: 4, background: COLOR[k], width: "100%" }} />
      <div
        style={{
          padding: "12px 14px 14px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 14, lineHeight: 1.3 }}>{spec.label}</strong>
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
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary, #555)",
            lineHeight: 1.45,
          }}
        >
          {spec.description}
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
          {specLine(k)}
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
  return (
    <em style={{ fontStyle: "italic", color: "var(--text-secondary, #444)" }}>
      {children}
    </em>
  );
}
