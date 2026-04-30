"use client";

import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, XCircle, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { MetricCard } from "@/components/ui/MetricCard";
import { fmt, fmtUSD } from "@/lib/utils";
import { GAS_TANKLESS_WH, INUNIT_RESISTANCE_TANK_SPEC } from "@/lib/engineering/constants";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";

// Tech accents (keep consistent with EquipmentTab / CombiTab)
const A_GAS = "#F59E0B";
const A_RESIST = "#7DBBD3";
const A_HPWH = "#7DD3A3";
const A_OK = "var(--accent-emerald)";
const A_BAD = "var(--accent-red)";
const A_WARN = "var(--accent-amber)";

const PREHEAT_LABEL: Record<"none" | "solar" | "dwhr" | "solar+dwhr", string> = {
  none: "None",
  solar: "Solar thermal",
  dwhr: "DWHR",
  "solar+dwhr": "Solar + DWHR",
};

interface Props {
  inputs: DhwInputs;
  result: CalcResult;
}

function StatusBadge({ ok, text }: { ok: boolean; text: string }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: ok ? "rgba(125,211,163,0.12)" : "rgba(239,68,68,0.10)",
        color: ok ? A_OK : A_BAD,
      }}
    >
      <Icon size={11} />
      {text}
    </span>
  );
}

function SectionHeader({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        marginBottom: 10,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
          fontWeight: 700,
        }}
      >
        {String(n).padStart(2, "0")}
      </span>
      <h3 className="ve-section-title" style={{ fontSize: 15, margin: 0 }}>
        {title}
      </h3>
      {sub && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</span>
      )}
    </div>
  );
}

function DeltaBadge({
  current,
  target,
  tone,
}: {
  current: number;
  target: number;
  tone?: "size" | "capacity";
}) {
  // tone=size: negative delta = undersized (bad), positive = oversized (warn)
  // tone=capacity: negative = under capacity (bad), positive = has margin (ok)
  if (!Number.isFinite(current) || !Number.isFinite(target) || target === 0) return null;
  const delta = (current - target) / target;
  const pct = (delta * 100).toFixed(0);
  const absPct = Math.abs(delta * 100);
  let label: string;
  let color: string;
  if (absPct < 5) {
    label = "≈ match";
    color = A_OK;
  } else if (tone === "capacity") {
    if (delta < 0) {
      label = `${pct}% short`;
      color = A_BAD;
    } else {
      label = `+${pct}% margin`;
      color = absPct > 50 ? A_WARN : A_OK;
    }
  } else {
    if (delta < 0) {
      label = `${pct}% undersized`;
      color = A_BAD;
    } else if (absPct > 25) {
      label = `+${pct}% oversized`;
      color = A_WARN;
    } else {
      label = `+${pct}%`;
      color = A_OK;
    }
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        background: "var(--surface-alt, rgba(0,0,0,0.04))",
        color,
      }}
    >
      {label}
    </span>
  );
}

function CompareRow({
  label,
  current,
  target,
  unit,
  tone,
  sub,
}: {
  label: string;
  current: ReactNode;
  target: ReactNode;
  unit?: string;
  tone?: "size" | "capacity";
  sub?: ReactNode;
}) {
  const curNum = typeof current === "number" ? current : NaN;
  const tgtNum = typeof target === "number" ? target : NaN;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 110px 110px 120px",
        gap: 12,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--surface-subtle, rgba(0,0,0,0.02))",
        fontSize: 12,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Your design
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
          {typeof current === "number" ? fmt(current, current < 10 ? 1 : 0) : current}
          {unit && (
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", marginLeft: 4 }}>
              {unit}
            </span>
          )}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Recommended
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
          {typeof target === "number" ? fmt(target, target < 10 ? 1 : 0) : target}
          {unit && (
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", marginLeft: 4 }}>
              {unit}
            </span>
          )}
        </div>
      </div>
      <div>
        {Number.isFinite(curNum) && Number.isFinite(tgtNum) && (
          <DeltaBadge current={curNum} target={tgtNum} tone={tone} />
        )}
      </div>
    </div>
  );
}

export function CurrentDesignTab({ inputs, result }: Props) {
  const sys = SYSTEM_TYPES[inputs.systemType];
  const isCentral = sys.topology === "central";
  const isCentralTankless = inputs.systemType === "central_gas_tankless";
  const isCentralIndirect = inputs.systemType === "central_indirect";
  const isCentralHybrid = inputs.systemType === "central_hybrid";
  const isCentralSteamHX = inputs.systemType === "central_steam_hx";
  const isGasTank = inputs.systemType === "inunit_gas_tank";
  const isGasCombi = inputs.systemType === "inunit_combi_gas";
  const isGasTankless = inputs.systemType === "inunit_gas_tankless";
  const isGasTanklessCombi = inputs.systemType === "inunit_combi_gas_tankless";
  const isResistance = inputs.systemType === "inunit_resistance";
  const isResistanceCombi = inputs.systemType === "inunit_combi_resistance";
  const isHPWHInUnit =
    inputs.systemType === "inunit_hpwh" || inputs.systemType === "inunit_combi";

  const demandGoverning =
    inputs.demandMethod === "ashrae"
      ? "ASHRAE apt-count"
      : inputs.demandMethod === "hunter"
      ? "Modified Hunter"
      : "Occupancy × GPCD";

  // Auto-size handles for at-a-glance comparison
  const rec = result.autoSize?.recommended;
  const recTankGal = typeof rec?.tankGal === "number" ? (rec!.tankGal as number) : NaN;
  const recInputMBH = typeof rec?.inputMBH === "number" ? (rec!.inputMBH as number) : NaN;

  // Warn / error flag tally for footer
  const warnCount = result.flags.filter((f) => f.level === "error" || f.level === "warn").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Intro */}
      <Card accent="var(--accent-blue)">
        <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "var(--text-primary)" }}>
          <strong>Current Design</strong> is a read-only snapshot of what the inputs on the{" "}
          <em>Building &amp; System</em> tab actually deliver — demand, sizing, equipment capacity,
          and annual operating cost. No recommendations here. The next tab,{" "}
          <strong>Auto-Size</strong>, compares these numbers against code-minimum, recommended
          (+25% margin), and 15-year lifecycle-optimal targets so you can tell if you&apos;re under-
          or oversized.
        </p>
      </Card>

      {/* 1. Demand */}
      <Card>
        <SectionHeader n={1} title="Demand at your inputs" sub={`Governing method: ${demandGoverning}`} />
        <Grid cols={isCentral ? 4 : 3}>
          <MetricCard
            label="Peak-hour demand"
            value={fmt(result.peakHourDemand)}
            unit="GPH"
            sub={`${result.totalUnits} units · ${result.totalOccupants} occupants`}
          />
          <MetricCard
            label="Peak GPM (instantaneous)"
            value={fmt(result.peakGPM_modified, 1)}
            unit="GPM"
            sub={`Modified Hunter · ${fmt(result.hotWSFU)} WSFU`}
          />
          {isCentral && (
            <MetricCard
              label="Diversity factor"
              value={`${(result.diversityFactor * 100).toFixed(0)}%`}
              sub="peak-hour / connected-load"
            />
          )}
          <MetricCard
            label="Average daily use"
            value={fmt(result.avgDayDemand)}
            unit="GPD"
            sub="24-hr average"
          />
        </Grid>
      </Card>

      {/* 1b. Preheat contribution — only when a modifier is active. Surfaces
            the lift so users can see the inlet they're actually sizing against. */}
      {result.preheatType !== "none" && (
        <Card>
          <SectionHeader
            n={1}
            title={`Preheat — ${PREHEAT_LABEL[result.preheatType]}`}
            sub="Lifts effective inlet before primary system runs"
          />
          <Grid cols={3}>
            <MetricCard
              label="Annual preheat lift"
              value={`+${fmt(result.annualPreheatLiftF, 1)}`}
              unit="°F"
              sub={`base inlet → ${fmt(result.effectiveInletF, 1)}°F effective`}
              accent={A_WARN}
            />
            {(result.preheatType === "solar" || result.preheatType === "solar+dwhr") && (
              <MetricCard
                label="Annual solar fraction"
                value={`${(result.annualSolarFraction * 100).toFixed(1)}%`}
                sub="energy-weighted; cap 85%"
              />
            )}
            {(result.preheatType === "dwhr" || result.preheatType === "solar+dwhr") && (
              <MetricCard
                label="DWHR constant lift"
                value={`+${fmt(result.annualDwhrLiftF, 1)}`}
                unit="°F"
                sub={`eff × cov × (${95}°F − inlet)`}
              />
            )}
          </Grid>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 10 }}>
            Sizing and energy calcs below use the preheated inlet. The reduction in
            primary thermal load shows up directly in annual gas / electric on the
            Energy tab.
          </p>
        </Card>
      )}

      {/* 2. Sizing requirement (central only — for in-unit sizing is per-unit in section 3) */}
      {isCentral && !isCentralTankless && (
        <Card>
          <SectionHeader n={2} title="Sizing requirement (ASHRAE)" sub="Storage + recovery to meet peak hour" />
          <Grid cols={3}>
            <MetricCard
              label="Usable storage target"
              value={fmt(result.storageVolGal)}
              unit="gal"
              sub={`${fmt(result.storageVolGal_nominal)} gal nominal ÷ 0.75 stratification`}
            />
            <MetricCard
              label="Recovery target"
              value={fmt(result.recoveryGPH)}
              unit="GPH"
              sub={`${fmt(result.recoveryBTUH)} BTU/hr · ${fmt(result.recoveryKW, 1)} kW`}
            />
            <MetricCard
              label="Total design load"
              value={fmt(result.totalKW, 1)}
              unit="kW"
              sub={`${fmt(result.totalBTUH)} BTU/hr · includes ${fmt(result.recircLossBTUH)} BTU/hr recirc`}
              accent="var(--accent-violet)"
            />
          </Grid>
        </Card>
      )}

      {/* 2-alt. Sizing requirement for central tankless — instantaneous GPM */}
      {isCentralTankless && (
        <Card>
          <SectionHeader
            n={2}
            title="Sizing requirement (instantaneous)"
            sub="Peak GPM × ΔT — no primary storage"
          />
          <Grid cols={3}>
            <MetricCard
              label="Required peak GPM"
              value={fmt(result.centralTanklessPeakGPMRequired, 1)}
              unit="GPM"
              sub="peak hour ÷ 60 × 1.5 (ASHRAE Ch. 51)"
            />
            <MetricCard
              label="Recovery target (recirc + draw)"
              value={fmt(result.recoveryGPH)}
              unit="GPH"
              sub={`${fmt(result.totalBTUH)} BTU/hr · ${fmt(result.totalKW, 1)} kW`}
            />
            <MetricCard
              label="Recirc standby"
              value={fmt(result.recircLossBTUH)}
              unit="BTU/hr"
              sub={`${fmt(result.recircLossKW, 2)} kW · ${
                result.totalBTUH > 0
                  ? ((result.recircLossBTUH / result.totalBTUH) * 100).toFixed(0)
                  : "0"
              }% of total`}
              accent="var(--accent-amber)"
            />
          </Grid>
        </Card>
      )}

      {/* 3. Equipment as configured */}
      <Card>
        <SectionHeader
          n={isCentral ? 3 : 2}
          title={
            isCentral
              ? `Selected heat source delivers (${sys.label})`
              : `Per-unit equipment delivers (${sys.label})`
          }
        />

        {isCentral && inputs.systemType === "central_gas" && (() => {
          const outputBTUH = result.gasInputBTUH * inputs.gasEfficiency;
          const meets = outputBTUH >= result.totalBTUH;
          return (
            <Grid cols={3}>
              <MetricCard
                label="Gas input"
                value={fmt(result.gasInputBTUH / 1000)}
                unit="MBH"
                sub={`η ${(inputs.gasEfficiency * 100).toFixed(0)}%`}
                accent={A_GAS}
              />
              <MetricCard
                label="Delivers at design"
                value={fmt(outputBTUH / 1000)}
                unit="MBH"
                sub={`required ${fmt(result.totalBTUH / 1000)} MBH`}
                accent={A_GAS}
              />
              <MetricCard
                label="Spec reality check"
                value=""
                sub={
                  <StatusBadge
                    ok={meets}
                    text={meets ? "≥ design load" : "below design load"}
                  />
                }
                accent={meets ? A_OK : A_BAD}
              />
            </Grid>
          );
        })()}

        {isCentral && isCentralTankless && (
          <Grid cols={3}>
            <MetricCard
              label={`${inputs.centralGasTanklessInput} MBH module`}
              value={fmt(result.centralTanklessCapacityGPM, 1)}
              unit="GPM @ rise"
              sub={
                <StatusBadge
                  ok={result.centralTanklessMetsDemand}
                  text={
                    result.centralTanklessMetsDemand
                      ? "meets peak"
                      : `below ${fmt(result.centralTanklessPeakGPMRequired, 1)} GPM peak`
                  }
                />
              }
              accent={A_GAS}
            />
            <MetricCard
              label="Required peak GPM"
              value={fmt(result.centralTanklessPeakGPMRequired, 1)}
              unit="GPM"
              sub={`@ ${fmt(result.temperatureRise)}°F design rise`}
              accent={A_GAS}
            />
            <MetricCard
              label="Spec reality check"
              value=""
              sub={
                <StatusBadge
                  ok={result.centralTanklessMetsDemand}
                  text={result.centralTanklessMetsDemand ? "≥ peak" : "below peak"}
                />
              }
              accent={result.centralTanklessMetsDemand ? A_OK : A_BAD}
            />
          </Grid>
        )}

        {isCentral && isCentralIndirect && (() => {
          const outputBTUH = result.gasInputBTUH * result.effectiveGasEfficiency;
          const meets = outputBTUH >= result.totalBTUH;
          return (
            <Grid cols={3}>
              <MetricCard
                label="Boiler input"
                value={fmt(result.gasInputBTUH / 1000)}
                unit="MBH"
                sub={`combined η ${(result.effectiveGasEfficiency * 100).toFixed(1)}%`}
                accent={A_GAS}
              />
              <MetricCard
                label="HX effectiveness"
                value={`${(inputs.indirectHXEffectiveness * 100).toFixed(0)}%`}
                sub={`gas η ${(inputs.gasEfficiency * 100).toFixed(0)}% × HX`}
                accent={A_GAS}
              />
              <MetricCard
                label="Spec reality check"
                value=""
                sub={
                  <StatusBadge
                    ok={meets}
                    text={meets ? "≥ design load" : "below design load"}
                  />
                }
                accent={meets ? A_OK : A_BAD}
              />
            </Grid>
          );
        })()}

        {isCentral && isCentralHybrid && (
          <Grid cols={3}>
            <MetricCard
              label="HPWH primary"
              value={fmt(result.hybridHpwhBTUH / 1000)}
              unit="MBH (output)"
              sub={`${(inputs.hybridSplitRatio * 100).toFixed(0)}% of design · COP ${result.cop.toFixed(2)}`}
              accent={A_HPWH}
            />
            <MetricCard
              label="Gas backup input"
              value={fmt(result.hybridGasInputMBH)}
              unit="MBH"
              sub={`${(((1 - inputs.hybridSplitRatio) * 100)).toFixed(0)}% peak shortfall · ${inputs.hybridGasBackupType === "boiler" ? "boiler" : "condensing tank"}`}
              accent={A_GAS}
            />
            <MetricCard
              label="Spec reality check"
              value=""
              sub={
                <StatusBadge
                  ok={result.hybridHpwhBTUH + result.hybridGasBTUH >= result.totalBTUH * 0.999}
                  text="HPWH + gas covers design load"
                />
              }
              accent={A_OK}
            />
          </Grid>
        )}

        {isCentral && isCentralSteamHX && (() => {
          const outputBTUH = result.gasInputBTUH * result.effectiveGasEfficiency;
          const meets = outputBTUH >= result.totalBTUH && result.steamApproachOK;
          return (
            <Grid cols={3}>
              <MetricCard
                label="Steam HX input"
                value={fmt(result.gasInputBTUH / 1000)}
                unit="MBH"
                sub={`combined η ${(result.steamCombinedEfficiency * 100).toFixed(1)}%`}
                accent="#b8a3d3"
              />
              <MetricCard
                label="Source × HX η"
                value={`${(result.steamCombinedEfficiency * 100).toFixed(0)}%`}
                sub={`source ${(inputs.steamSourceEfficiency * 100).toFixed(0)}% × HX ${(inputs.steamHXEffectiveness * 100).toFixed(0)}%`}
                accent="#b8a3d3"
              />
              <MetricCard
                label="Spec reality check"
                value=""
                sub={
                  <StatusBadge
                    ok={meets}
                    text={
                      !result.steamApproachOK
                        ? "violates HX approach"
                        : meets
                        ? "≥ design load"
                        : "below design load"
                    }
                  />
                }
                accent={meets ? A_OK : A_BAD}
              />
            </Grid>
          );
        })()}

        {isCentral && inputs.systemType === "central_resistance" && (() => {
          const meets = result.resistanceInputKW >= result.totalKW;
          return (
            <Grid cols={3}>
              <MetricCard
                label="Resistance input"
                value={fmt(result.resistanceInputKW, 1)}
                unit="kW"
                sub="1:1 conversion, no efficiency loss"
                accent={A_RESIST}
              />
              <MetricCard
                label="Required output"
                value={fmt(result.totalKW, 1)}
                unit="kW"
                sub="design load incl. recirc"
                accent={A_RESIST}
              />
              <MetricCard
                label="Spec reality check"
                value=""
                sub={
                  <StatusBadge
                    ok={meets}
                    text={meets ? "≥ design load" : "below design load"}
                  />
                }
                accent={meets ? A_OK : A_BAD}
              />
            </Grid>
          );
        })()}

        {isCentral && inputs.systemType === "central_hpwh" && (
          <Grid cols={3}>
            <MetricCard
              label="HPWH nameplate"
              value={fmt(result.hpwhNameplateKW, 1)}
              unit="kW"
              sub={`${inputs.hpwhRefrigerant} @ ${result.effectiveHpwhAmbient.toFixed(0)}°F ambient`}
              accent={A_HPWH}
            />
            <MetricCard
              label="Effective COP"
              value={result.cop.toFixed(2)}
              sub={`capacity derate ${(result.capFactor * 100).toFixed(0)}%`}
              accent={A_HPWH}
            />
            <MetricCard
              label="Swing tank boost"
              value={inputs.swingTankEnabled ? fmt(result.swingTankKW, 1) : "off"}
              unit={inputs.swingTankEnabled ? "kW" : undefined}
              sub={inputs.swingTankEnabled ? "recirc + Legionella" : "no resistance backup for recirc"}
              accent={A_HPWH}
            />
          </Grid>
        )}

        {(isGasTank || isGasCombi) && (
          <Grid cols={3}>
            <MetricCard
              label={`${inputs.gasTankSize}-gal tank (${inputs.gasTankType === "condensing" ? "condensing" : "non-condensing"})`}
              value={fmt(result.inUnitGas.gasTankFHR)}
              unit="GPH FHR"
              sub={
                <StatusBadge
                  ok={result.inUnitGas.gasTankFHRMet}
                  text={
                    result.inUnitGas.gasTankFHRMet
                      ? "meets per-unit peak"
                      : `below ${fmt(result.inUnitGas.perUnitPeakGPH)} GPH peak`
                  }
                />
              }
              accent={A_GAS}
            />
            <MetricCard
              label="Input rating"
              value={fmt(result.inUnitGas.gasTankInputMBH)}
              unit="MBH"
              sub={`UEF ${result.inUnitGas.gasTankUEF.toFixed(2)} · ${fmt(
                result.inUnitGas.gasTankRecoveryGPH
              )} GPH recovery`}
              accent={A_GAS}
            />
            <MetricCard
              label="Building gas demand"
              value={fmt(result.inUnitGas.buildingGasDemandCFH)}
              unit="CFH"
              sub={`${fmt(result.inUnitGas.gasTankCFH_perUnit)} CFH/unit × ${(
                result.inUnitGas.gasDiversityFactor * 100
              ).toFixed(0)}% div`}
              accent={A_GAS}
            />
          </Grid>
        )}

        {isGasCombi && (() => {
          const outBTUH = result.inUnitGas.gasTankSpec.input_mbh * result.inUnitGas.gasTankUEF * 1000;
          return (
            <>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                Heating coverage per unit · tank output {fmt(outBTUH)} BTU/hr
              </div>
              <Grid cols={inputs.unitsStudio > 0 ? 4 : 3}>
                {((["Studio", "1BR", "2BR", "3BR"] as const)
                  .filter((t) => t !== "Studio" || inputs.unitsStudio > 0)
                ).map((t) => {
                  const load =
                    t === "Studio"
                      ? result.combi.heatingLoad_0BR
                      : t === "1BR"
                      ? result.combi.heatingLoad_1BR
                      : t === "2BR"
                      ? result.combi.heatingLoad_2BR
                      : result.combi.heatingLoad_3BR;
                  const ok = outBTUH >= load;
                  return (
                    <MetricCard
                      key={t}
                      label={`${t} design load`}
                      value={fmt(load)}
                      unit="BTU/hr"
                      sub={
                        <StatusBadge
                          ok={ok}
                          text={ok ? "tank covers" : `short ${fmt(load - outBTUH)} BTU/hr`}
                        />
                      }
                      accent={ok ? A_OK : A_BAD}
                    />
                  );
                })}
              </Grid>
            </>
          );
        })()}

        {isGasTankless && (
          <Grid cols={3}>
            <MetricCard
              label={`${inputs.gasTanklessInput} MBH tankless`}
              value={fmt(result.inUnitGas.tanklessCapacityAtRise, 1)}
              unit="GPM @ rise"
              sub={
                <StatusBadge
                  ok={result.inUnitGas.tanklessMetsDemand}
                  text={
                    result.inUnitGas.tanklessMetsDemand
                      ? "meets peak"
                      : `below ${fmt(result.inUnitGas.tanklessPeakGPM, 1)} GPM peak`
                  }
                />
              }
              accent={A_GAS}
            />
            <MetricCard
              label="Design rise"
              value={fmt(inputs.tanklessDesignRiseF)}
              unit="°F"
              sub={`${inputs.tanklessSimultaneousFixtures} simultaneous fixtures`}
              accent={A_GAS}
            />
            <MetricCard
              label="Building gas demand"
              value={fmt(result.inUnitGas.tanklessBuildingDemandCFH)}
              unit="CFH"
              sub={`${fmt(result.inUnitGas.tanklessCFH_perUnit)} CFH/unit`}
              accent={A_GAS}
            />
          </Grid>
        )}

        {isHPWHInUnit && (
          <Grid cols={3}>
            <MetricCard
              label={`${inputs.combiTankSize}-gal HPWH`}
              value={fmt(result.combi.fhr)}
              unit="GPH FHR"
              sub={
                <StatusBadge
                  ok={result.combi.dhwMetByFHR}
                  text={
                    result.combi.dhwMetByFHR
                      ? "meets peak"
                      : `below ${fmt(result.combi.worstPeakDHW)} GPH`
                  }
                />
              }
              accent={A_HPWH}
            />
            <MetricCard
              label="DHW COP"
              value={result.combi.combiCOP_dhw.toFixed(2)}
              sub={`@ 70°F ambient, ${inputs.combiDHWSetpointF}°F setpoint`}
              accent={A_HPWH}
            />
            {sys.hasSpaceHeating ? (
              <MetricCard
                label="Heating COP"
                value={result.combi.combiCOP_heating.toFixed(2)}
                sub={`@ ${fmt(result.combi.effectiveTankSetpointForHeating)}°F tank`}
                accent={A_HPWH}
              />
            ) : (
              <MetricCard
                label="Per-unit elec demand"
                value={fmt(result.combi.perUnitElecDemand, 1)}
                unit="kW"
                accent={A_HPWH}
              />
            )}
            {result.bufferTankVolumeGal != null && (
              <MetricCard
                label="Buffer tank"
                value={fmt(result.bufferTankVolumeGal)}
                unit="gal recommended"
                sub="prevents compressor short-cycling"
                accent={A_HPWH}
              />
            )}
          </Grid>
        )}

        {isHPWHInUnit && sys.hasSpaceHeating && (
          <>
            <div
              style={{
                marginTop: 14,
                fontSize: 12,
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              Heating coverage per unit
            </div>
            <Grid cols={inputs.unitsStudio > 0 ? 4 : 3}>
              {((["Studio", "1BR", "2BR", "3BR"] as const)
                .filter((t) => t !== "Studio" || inputs.unitsStudio > 0)
              ).map((t) => {
                const load =
                  t === "Studio"
                    ? result.combi.heatingLoad_0BR
                    : t === "1BR"
                    ? result.combi.heatingLoad_1BR
                    : t === "2BR"
                    ? result.combi.heatingLoad_2BR
                    : result.combi.heatingLoad_3BR;
                const met =
                  t === "Studio"
                    ? result.combi.heatingMetByHPWH_0BR
                    : t === "1BR"
                    ? result.combi.heatingMetByHPWH_1BR
                    : t === "2BR"
                    ? result.combi.heatingMetByHPWH_2BR
                    : result.combi.heatingMetByHPWH_3BR;
                const backup =
                  t === "Studio"
                    ? result.combi.resistanceBackup_0BR
                    : t === "1BR"
                    ? result.combi.resistanceBackup_1BR
                    : t === "2BR"
                    ? result.combi.resistanceBackup_2BR
                    : result.combi.resistanceBackup_3BR;
                return (
                  <MetricCard
                    key={t}
                    label={`${t} design load`}
                    value={fmt(load)}
                    unit="BTU/hr"
                    sub={
                      <StatusBadge
                        ok={met}
                        text={met ? "HPWH only" : `+${fmt(backup, 1)} kW resistance`}
                      />
                    }
                    accent={met ? A_OK : A_WARN}
                  />
                );
              })}
            </Grid>
          </>
        )}

        {isGasTanklessCombi && (
          <Grid cols={3}>
            <MetricCard
              label={`${inputs.inunitGasTanklessCombiInput} MBH tankless combi`}
              value={fmt(result.inunitGasCombiPeakInstantGPM, 1)}
              unit="GPM @ rise"
              sub={`UEF ${GAS_TANKLESS_WH[inputs.inunitGasTanklessCombiInput].uef.toFixed(2)} · ${inputs.tanklessDesignRiseF}°F rise`}
              accent={A_GAS}
            />
            <MetricCard
              label="Buffer tank (heating loop)"
              value={fmt(result.inunitGasCombiBufferSelectedGal)}
              unit="gal"
              sub={`required ${fmt(result.inunitGasCombiBufferRequiredGal, 1)} gal · 5-min min runtime, 15°F swing`}
              accent={A_GAS}
            />
            <MetricCard
              label="Spec reality check"
              value=""
              sub={
                <StatusBadge
                  ok={result.inunitGasCombiBufferSelectedGal >= result.inunitGasCombiBufferRequiredGal}
                  text={
                    result.inunitGasCombiBufferSelectedGal >= result.inunitGasCombiBufferRequiredGal
                      ? "buffer ≥ required"
                      : "buffer below required"
                  }
                />
              }
              accent={
                result.inunitGasCombiBufferSelectedGal >= result.inunitGasCombiBufferRequiredGal
                  ? A_OK
                  : A_BAD
              }
            />
          </Grid>
        )}

        {isGasTanklessCombi && (() => {
          const tanklessSpec = GAS_TANKLESS_WH[inputs.inunitGasTanklessCombiInput];
          const tanklessOutBTUH = tanklessSpec.input_mbh * tanklessSpec.uef * 1000;
          return (
            <>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                Heating coverage per unit · tankless output {fmt(tanklessOutBTUH)} BTU/hr
              </div>
              <Grid cols={inputs.unitsStudio > 0 ? 4 : 3}>
                {((["Studio", "1BR", "2BR", "3BR"] as const)
                  .filter((t) => t !== "Studio" || inputs.unitsStudio > 0)
                ).map((t) => {
                  const load =
                    t === "Studio"
                      ? result.combi.heatingLoad_0BR
                      : t === "1BR"
                      ? result.combi.heatingLoad_1BR
                      : t === "2BR"
                      ? result.combi.heatingLoad_2BR
                      : result.combi.heatingLoad_3BR;
                  const ok = tanklessOutBTUH >= load;
                  return (
                    <MetricCard
                      key={t}
                      label={`${t} design load`}
                      value={fmt(load)}
                      unit="BTU/hr"
                      sub={
                        <StatusBadge
                          ok={ok}
                          text={ok ? "tankless covers" : `short ${fmt(load - tanklessOutBTUH)} BTU/hr`}
                        />
                      }
                      accent={ok ? A_OK : A_BAD}
                    />
                  );
                })}
              </Grid>
            </>
          );
        })()}

        {(isResistance || isResistanceCombi) && (() => {
          const spec = INUNIT_RESISTANCE_TANK_SPEC[inputs.inunitResistanceTankSize];
          const peakGPH = result.inUnitGas.perUnitPeakGPH;
          const fhrMet = spec.fhr >= peakGPH;
          return (
            <Grid cols={3}>
              <MetricCard
                label={`${inputs.inunitResistanceTankSize}-gal resistance tank`}
                value={fmt(spec.fhr)}
                unit="GPH FHR"
                sub={
                  <StatusBadge
                    ok={fhrMet}
                    text={fhrMet ? "meets per-unit peak" : `below ${fmt(peakGPH)} GPH`}
                  />
                }
                accent={A_RESIST}
              />
              <MetricCard
                label="Element rating"
                value={fmt(spec.kw, 1)}
                unit="kW"
                sub={`UEF ${spec.uef.toFixed(2)} · ${fmt(spec.kw * 3412)} BTU/hr`}
                accent={A_RESIST}
              />
              <MetricCard
                label="Per-unit elec demand"
                value={fmt(spec.kw, 1)}
                unit="kW"
                sub="element nameplate"
                accent={A_RESIST}
              />
            </Grid>
          );
        })()}

        {isResistanceCombi && (() => {
          const elementBTUH = INUNIT_RESISTANCE_TANK_SPEC[inputs.inunitResistanceTankSize].kw * 3412;
          return (
            <>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                Heating coverage per unit · element output {fmt(elementBTUH)} BTU/hr (1:1, no compressor reserve)
              </div>
              <Grid cols={inputs.unitsStudio > 0 ? 4 : 3}>
                {((["Studio", "1BR", "2BR", "3BR"] as const)
                  .filter((t) => t !== "Studio" || inputs.unitsStudio > 0)
                ).map((t) => {
                  const load =
                    t === "Studio"
                      ? result.combi.heatingLoad_0BR
                      : t === "1BR"
                      ? result.combi.heatingLoad_1BR
                      : t === "2BR"
                      ? result.combi.heatingLoad_2BR
                      : result.combi.heatingLoad_3BR;
                  const ok = elementBTUH >= load;
                  return (
                    <MetricCard
                      key={t}
                      label={`${t} design load`}
                      value={fmt(load)}
                      unit="BTU/hr"
                      sub={
                        <StatusBadge
                          ok={ok}
                          text={ok ? "element covers" : `short ${fmt(load - elementBTUH)} BTU/hr`}
                        />
                      }
                      accent={ok ? A_OK : A_BAD}
                    />
                  );
                })}
              </Grid>
            </>
          );
        })()}

        {(isGasTank || isGasCombi || isHPWHInUnit) && (() => {
          const tankFHR_gph = isGasTank || isGasCombi ? result.inUnitGas.gasTankFHR : result.combi.fhr;
          const tankGallons = isGasTank || isGasCombi ? inputs.gasTankSize : inputs.combiTankSize;
          const sustainGPM = tankFHR_gph / 60;
          const peakGPM = result.peakInstantGPM;
          const usableGal = tankGallons * 0.7;
          const burstMin = peakGPM > sustainGPM ? usableGal / (peakGPM - sustainGPM) : Infinity;
          const sustains = peakGPM <= sustainGPM;
          const shortBurst = !sustains && burstMin < 10;
          const accent = sustains ? A_OK : shortBurst ? A_BAD : A_WARN;
          const techAccent = isGasTank || isGasCombi ? A_GAS : A_HPWH;
          return (
            <>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                Peak instantaneous burst · sanity check against tank sustain rate
              </div>
              <Grid cols={3}>
                <MetricCard
                  label="Peak burst draw"
                  value={fmt(peakGPM, 1)}
                  unit="GPM"
                  sub={`top ${result.peakInstantFixtureCount} fixtures × 85% simultaneity`}
                  accent={techAccent}
                />
                <MetricCard
                  label="Tank sustain rate"
                  value={fmt(sustainGPM, 2)}
                  unit="GPM"
                  sub={`FHR ${fmt(tankFHR_gph)} GPH ÷ 60`}
                  accent={techAccent}
                />
                <MetricCard
                  label="Burst check"
                  value=""
                  sub={
                    <StatusBadge
                      ok={sustains}
                      text={
                        sustains
                          ? "sustained — tank covers indefinitely"
                          : Number.isFinite(burstMin)
                          ? `~${burstMin.toFixed(0)} min burst before setpoint drop`
                          : "storage-buffered burst only"
                      }
                    />
                  }
                  accent={accent}
                />
              </Grid>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                }}
              >
                Sustain rate assumes steady recovery. Burst time uses {Math.round(usableGal)}-gal usable
                storage (≈70% of the {tankGallons}-gal tank after stratification) drained at{" "}
                {fmt(peakGPM, 1)} GPM minus the recovery rate. Fixture GPM values set on the Building
                tab drive this calculation.
              </div>
            </>
          );
        })()}
      </Card>

      {/* 4. Annual operating */}
      <Card>
        <SectionHeader
          n={isCentral ? 4 : 3}
          title="Annual operating cost at your inputs"
          sub="Monthly model · climate-weighted"
        />
        <Grid cols={3}>
          {isCentral &&
            (inputs.systemType === "central_gas" ||
              isCentralTankless ||
              isCentralIndirect ||
              isCentralSteamHX) && (
              <>
                <MetricCard
                  label={isCentralSteamHX ? "Annual steam (therm-equiv.)" : "Annual gas"}
                  value={fmtUSD(result.annualGasCost)}
                  unit="/yr"
                  sub={`${fmt(result.annualGasTherms)} therms${isCentralSteamHX ? " (proxy)" : ""}`}
                  accent={A_GAS}
                />
                <MetricCard
                  label="Annual carbon"
                  value={fmt(result.annualGasCarbon)}
                  unit="lb CO₂"
                  sub={isCentralSteamHX ? "approx — depends on plant fuel mix" : undefined}
                  accent={A_GAS}
                />
                <MetricCard
                  label={
                    isCentralIndirect
                      ? "Combined system η"
                      : isCentralSteamHX
                      ? "Source × HX η"
                      : "Annual kWh-equiv."
                  }
                  value={
                    isCentralIndirect
                      ? `${(result.effectiveGasEfficiency * 100).toFixed(1)}%`
                      : isCentralSteamHX
                      ? `${(result.steamCombinedEfficiency * 100).toFixed(1)}%`
                      : fmt(result.annualGasTherms * 29.3)
                  }
                  unit={isCentralIndirect || isCentralSteamHX ? undefined : "kWh"}
                  sub={
                    isCentralIndirect
                      ? `gas η × HX ${(inputs.indirectHXEffectiveness * 100).toFixed(0)}%`
                      : isCentralSteamHX
                      ? `source ${(inputs.steamSourceEfficiency * 100).toFixed(0)}% × HX ${(inputs.steamHXEffectiveness * 100).toFixed(0)}%`
                      : "1 therm ≈ 29.3 kWh"
                  }
                  accent={A_GAS}
                />
              </>
            )}
          {isCentral && isCentralHybrid && (
            <>
              <MetricCard
                label="Annual gas (backup)"
                value={fmtUSD(result.annualGasCost)}
                unit="/yr"
                sub={`${fmt(result.annualGasTherms)} therms · ${((1 - inputs.hybridSplitRatio) * 100).toFixed(0)}% share`}
                accent={A_GAS}
              />
              <MetricCard
                label="Annual electric (HPWH)"
                value={fmtUSD(result.annualHPWHCost)}
                unit="/yr"
                sub={`${fmt(result.annualHPWHKWh_total)} kWh · ${(inputs.hybridSplitRatio * 100).toFixed(0)}% share · COP ${result.annualCOP.toFixed(2)}`}
                accent={A_HPWH}
              />
              <MetricCard
                label="Annual carbon (combined)"
                value={fmt(result.annualGasCarbon + result.annualHPWHCarbon)}
                unit="lb CO₂"
                sub={`gas ${fmt(result.annualGasCarbon)} + electric ${fmt(result.annualHPWHCarbon)}`}
                accent={A_HPWH}
              />
            </>
          )}
          {isCentral && inputs.systemType === "central_resistance" && (
            <>
              <MetricCard
                label="Annual electric"
                value={fmtUSD(result.annualResistanceCost)}
                unit="/yr"
                sub={`${fmt(result.annualResistanceKWh)} kWh`}
                accent={A_RESIST}
              />
              <MetricCard
                label="Annual carbon"
                value={fmt(result.annualResistanceCarbon)}
                unit="lb CO₂"
                accent={A_RESIST}
              />
              <MetricCard label="Annual COP" value="1.00" sub="1:1 resistance" accent={A_RESIST} />
            </>
          )}
          {isCentral && inputs.systemType === "central_hpwh" && (
            <>
              <MetricCard
                label="Annual electric"
                value={fmtUSD(result.annualHPWHCost)}
                unit="/yr"
                sub={`${fmt(result.annualHPWHKWh_total)} kWh`}
                accent={A_HPWH}
              />
              <MetricCard
                label="Annual carbon"
                value={fmt(result.annualHPWHCarbon)}
                unit="lb CO₂"
                accent={A_HPWH}
              />
              <MetricCard
                label="Annual COP"
                value={result.annualCOP.toFixed(2)}
                sub="climate-weighted"
                accent={A_HPWH}
              />
            </>
          )}
          {(isGasTank || isGasCombi) && (
            <>
              <MetricCard
                label={isGasCombi ? "Building annual (DHW + heat)" : "Building annual"}
                value={fmtUSD(
                  isGasCombi ? result.monthly.monthlyAnnualCost : result.inUnitGas.gasTankBuildingCost
                )}
                unit="/yr"
                sub={`${fmt(
                  isGasCombi ? result.monthly.monthlyAnnualEnergy : result.inUnitGas.gasTankBuildingTherms
                )} therms`}
                accent={A_GAS}
              />
              <MetricCard
                label="Annual carbon"
                value={fmt(
                  isGasCombi ? result.monthly.monthlyAnnualCarbon : result.inUnitGas.gasTankBuildingCarbon
                )}
                unit="lb CO₂"
                accent={A_GAS}
              />
              <MetricCard
                label="Per-unit DHW annual"
                value={fmt(result.inUnitGas.gasTankAnnualTherms_perUnit, 1)}
                unit="therms"
                accent={A_GAS}
              />
            </>
          )}
          {isGasTankless && (
            <>
              <MetricCard
                label="Building annual"
                value={fmtUSD(result.inUnitGas.tanklessBuildingCost)}
                unit="/yr"
                sub={`${fmt(result.inUnitGas.tanklessBuildingTherms)} therms`}
                accent={A_GAS}
              />
              <MetricCard
                label="Annual carbon"
                value={fmt(result.inUnitGas.tanklessBuildingCarbon)}
                unit="lb CO₂"
                accent={A_GAS}
              />
              <MetricCard
                label="Per-unit annual"
                value={fmt(result.inUnitGas.tanklessAnnualTherms_perUnit, 1)}
                unit="therms"
                accent={A_GAS}
              />
            </>
          )}
          {isHPWHInUnit && (
            <>
              <MetricCard
                label="Building annual"
                value={fmtUSD(result.combi.combiTotalAnnualCost)}
                unit="/yr"
                sub={`${fmt(result.combi.combiTotalAnnualKWh)} kWh`}
                accent={A_HPWH}
              />
              <MetricCard
                label="Annual carbon"
                value={fmt(result.combi.combiTotalAnnualCarbon)}
                unit="lb CO₂"
                accent={A_HPWH}
              />
              <MetricCard
                label="Seasonal COP (DHW)"
                value={result.combi.seasonalCOP_dhw.toFixed(2)}
                accent={A_HPWH}
              />
            </>
          )}
          {isGasTanklessCombi && (
            <>
              <MetricCard
                label="Building annual (DHW + heat)"
                value={fmtUSD(result.monthly.monthlyAnnualCost)}
                unit="/yr"
                sub={`${fmt(result.monthly.monthlyAnnualEnergy)} therms · DHW ${fmt(result.monthly.monthlyAnnualDHW)} + heat ${fmt(result.monthly.monthlyAnnualHeating)}`}
                accent={A_GAS}
              />
              <MetricCard
                label="Annual carbon"
                value={fmt(result.monthly.monthlyAnnualCarbon)}
                unit="lb CO₂"
                accent={A_GAS}
              />
              <MetricCard
                label="Tankless UEF"
                value={GAS_TANKLESS_WH[inputs.inunitGasTanklessCombiInput].uef.toFixed(2)}
                sub={`${GAS_TANKLESS_WH[inputs.inunitGasTanklessCombiInput].modulation} mod ratio`}
                accent={A_GAS}
              />
            </>
          )}
          {(isResistance || isResistanceCombi) && (
            <>
              <MetricCard
                label={isResistanceCombi ? "Building annual (DHW + heat)" : "Building annual"}
                value={fmtUSD(result.monthly.monthlyAnnualCost)}
                unit="/yr"
                sub={`${fmt(result.monthly.monthlyAnnualEnergy)} kWh${isResistanceCombi ? ` · DHW ${fmt(result.monthly.monthlyAnnualDHW)} + heat ${fmt(result.monthly.monthlyAnnualHeating)}` : ""}`}
                accent={A_RESIST}
              />
              <MetricCard
                label="Annual carbon"
                value={fmt(result.monthly.monthlyAnnualCarbon)}
                unit="lb CO₂"
                accent={A_RESIST}
              />
              <MetricCard
                label="Tank UEF"
                value={INUNIT_RESISTANCE_TANK_SPEC[inputs.inunitResistanceTankSize].uef.toFixed(2)}
                sub="1:1 element + standby loss"
                accent={A_RESIST}
              />
            </>
          )}
        </Grid>
      </Card>

      {/* 5. At-a-glance vs recommended — only meaningful where user picks discrete equipment */}
      {!isCentral && rec && (
        <Card accent="var(--accent-amber)">
          <SectionHeader
            n={isCentral ? 5 : 4}
            title="At-a-glance: your design vs auto-sized recommendation"
            sub="Full breakdown in the next tab"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(isGasTank || isGasCombi) && Number.isFinite(recTankGal) && (
              <CompareRow
                label="Gas tank size"
                current={inputs.gasTankSize}
                target={recTankGal}
                unit="gal"
                tone="size"
                sub={`Your ${inputs.gasTankType === "condensing" ? "condensing" : "non-condensing"} tank vs auto-sized`}
              />
            )}
            {isGasTankless && Number.isFinite(recInputMBH) && (
              <CompareRow
                label="Tankless input"
                current={inputs.gasTanklessInput}
                target={recInputMBH}
                unit="MBH"
                tone="capacity"
                sub={`Your ${inputs.gasTanklessInput}-MBH vs auto-sized`}
              />
            )}
            {isHPWHInUnit && Number.isFinite(recTankGal) && (
              <CompareRow
                label="HPWH tank size"
                current={inputs.combiTankSize}
                target={recTankGal}
                unit="gal"
                tone="size"
                sub="Your tank vs auto-sized"
              />
            )}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            ≈ match = within 5% · “undersized” = risk of not meeting peak · “oversized” = unnecessary
            capital cost.
          </div>
        </Card>
      )}

      {/* Footer — handoff to Auto-Size */}
      <Card accent="var(--accent-violet)">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <ArrowRight
            size={16}
            color="var(--accent-violet)"
            style={{ flexShrink: 0, marginTop: 3 }}
          />
          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7 }}>
            <strong>Next: Auto-Size.</strong>{" "}
            The next tab computes the <em>minimum</em> (code), <em>recommended</em> (+25% margin),
            and <em>lifecycle-optimal</em> (15-yr NPV) sizes for your demand and compares them
            against what you have configured here — with &ldquo;Apply recommended&rdquo; buttons so
            you can overwrite your inputs in one click.
            {warnCount > 0 && (
              <span style={{ display: "block", marginTop: 6, color: A_WARN }}>
                <Info size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {warnCount} active warning{warnCount === 1 ? "" : "s"} — see the Compliance tab.
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
