"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { MetricCard } from "@/components/ui/MetricCard";
import { fmt } from "@/lib/utils";
import type { CalcResult } from "@/lib/calc/types";

export function SizingTab({ result }: { result: CalcResult }) {
  // Tankless central plants size by peak instantaneous GPM × ΔT, not storage
  // + recovery, so the storage card is suppressed and a capacity-check card
  // takes its place. We detect that case by inspecting the tankless-only
  // outputs (zero for every other system type).
  const isCentralTankless = result.centralTanklessCapacityGPM > 0;
  // Hybrid + steam-HX features are detected from result fields populated
  // only for those system types — keeps the tab signature backward-
  // compatible with the existing DhwCalculator call site that only passes
  // `result`. The pipeline zeroes `hybridHpwhBTUH` and
  // `steamCombinedEfficiency` for unrelated system types.
  const isCentralHybrid = result.hybridHpwhBTUH > 0;
  const isCentralSteamHX = result.steamCombinedEfficiency > 0;
  // Phase F detection — surfaces only when the matching system type is
  // active (pipeline zeroes these for unrelated systems).
  const isCentralPerFloor = result.perFloorPerZoneKW > 0;
  const isCentralHRC = result.hrcCapacityBTUH > 0;
  const isCentralWastewaterHP = result.wastewaterEffectiveCOP > 0;
  const isCentralCHP = result.chpHeatRecoveryBTUH > 0;
  const isGroundLoopActive =
    result.hpwhSourceMode === "ground_loop" && result.hpwhEffectiveSourceTempF > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {isCentralHybrid && (
        <Card accent="#a3c8a8">
          <CardHeader>
            <CardTitle>Hybrid Plant Split (HPWH primary + gas backup)</CardTitle>
          </CardHeader>
          <Grid cols={3}>
            <MetricCard
              label="HPWH design output"
              value={fmt(result.hybridHpwhBTUH / 1000)}
              unit="MBH"
              sub="HPWH share of total design load"
              accent="#7DD3A3"
            />
            <MetricCard
              label="Gas backup output"
              value={fmt(result.hybridGasBTUH / 1000)}
              unit="MBH"
              sub="covers remaining peak shortfall"
              accent="#F59E0B"
            />
            <MetricCard
              label="Gas backup input"
              value={fmt(result.hybridGasInputMBH)}
              unit="MBH"
              sub="output ÷ gas efficiency"
              accent="#F59E0B"
            />
          </Grid>
        </Card>
      )}

      {isCentralPerFloor && (
        <Card accent="#9bd3a8">
          <CardHeader>
            <CardTitle>Per-Floor / Per-Stack Zoning</CardTitle>
          </CardHeader>
          <Grid cols={3}>
            <MetricCard
              label="Per-zone HPWH"
              value={fmt(result.perFloorPerZoneKW, 1)}
              unit="kW"
              sub="each zone independently"
              accent="#9bd3a8"
            />
            <MetricCard
              label="Total installed"
              value={fmt(result.perFloorTotalInstalledKW, 1)}
              unit="kW"
              sub="per-zone × zone count"
              accent="#9bd3a8"
            />
            <MetricCard
              label="Recirc loss reduction"
              value={fmt(result.perFloorRecircLossReduction)}
              unit="BTU/hr"
              sub="vs single full-length loop"
              accent="var(--accent-emerald)"
            />
          </Grid>
        </Card>
      )}

      {isCentralHRC && (
        <Card accent="#7dc7d3">
          <CardHeader>
            <CardTitle>Heat-Recovery Chiller Coverage</CardTitle>
          </CardHeader>
          <Grid cols={3}>
            <MetricCard
              label="HRC capacity"
              value={fmt(result.hrcCapacityBTUH / 1000, 1)}
              unit="MBH"
              sub="cooling tons × COP/(COP-1) × yr-round fraction"
              accent="#7dc7d3"
            />
            <MetricCard
              label="Annual coverage"
              value={`${(result.hrcCoverageFraction * 100).toFixed(0)}%`}
              sub={`${fmt(result.hrcAnnualContributionBTU / 1000000, 1)} MBTU/yr captured`}
              accent="#7dc7d3"
            />
            <MetricCard
              label="Gas backup"
              value={result.hrcCoverageFraction >= 0.999 ? "none" : "required"}
              sub={
                result.hrcCoverageFraction >= 0.999
                  ? "HRC fully covers DHW"
                  : `covers remaining ${((1 - result.hrcCoverageFraction) * 100).toFixed(0)}%`
              }
              accent={result.hrcCoverageFraction >= 0.999 ? "var(--accent-emerald)" : "var(--accent-amber)"}
            />
          </Grid>
        </Card>
      )}

      {isCentralWastewaterHP && (
        <Card accent="#5fa8b8">
          <CardHeader>
            <CardTitle>Wastewater HPWH Sizing</CardTitle>
          </CardHeader>
          <Grid cols={3}>
            <MetricCard
              label="Source-temp COP"
              value={result.wastewaterEffectiveCOP.toFixed(2)}
              sub="constant year-round (sewer)"
              accent="#5fa8b8"
            />
            <MetricCard
              label="HPWH nameplate"
              value={fmt(result.totalKW / result.wastewaterEffectiveCOP, 1)}
              unit="kW"
              sub="totalBTUH ÷ 3412 ÷ COP (no air-temp derate)"
              accent="#5fa8b8"
            />
            <MetricCard
              label="vs air-source HPWH"
              value={`${((result.wastewaterEffectiveCOP / Math.max(0.5, result.cop) - 1) * 100).toFixed(0)}%`}
              sub="COP advantage at design"
              accent="var(--accent-emerald)"
            />
          </Grid>
        </Card>
      )}

      {isCentralCHP && (
        <Card accent="#d8a87a">
          <CardHeader>
            <CardTitle>CHP Heat Recovery Coverage</CardTitle>
          </CardHeader>
          <Grid cols={3}>
            <MetricCard
              label="Recovered heat"
              value={fmt(result.chpHeatRecoveryBTUH / 1000, 1)}
              unit="MBH"
              sub="while running (electric kW × HTP × 3412)"
              accent="#d8a87a"
            />
            <MetricCard
              label="Annual contribution"
              value={fmt(result.chpAnnualContributionBTU / 1000000, 1)}
              unit="MBTU/yr"
              sub={`${(result.chpCoverageFraction * 100).toFixed(0)}% of DHW load (after 80% utilization)`}
              accent="#d8a87a"
            />
            <MetricCard
              label="Electric generated"
              value={fmt(result.chpAnnualElectricGeneratedKWh / 1000, 0)}
              unit="MWh/yr"
              sub="building electric account (not DHW)"
              accent="var(--accent-emerald)"
            />
          </Grid>
        </Card>
      )}

      {isGroundLoopActive && (
        <Card accent="#7dd3a3">
          <CardHeader>
            <CardTitle>Ground-Loop HPWH Source Coupling</CardTitle>
          </CardHeader>
          <Grid cols={3}>
            <MetricCard
              label="Source temp"
              value={fmt(result.hpwhEffectiveSourceTempF, 0)}
              unit="°F"
              sub="constant year-round (vs mech-room air)"
              accent="#7dd3a3"
            />
            <MetricCard
              label="Annual COP"
              value={result.annualCOP.toFixed(2)}
              sub="warmer winter source lifts seasonal COP"
              accent="var(--accent-emerald)"
            />
            <MetricCard
              label="Capacity factor"
              value={result.capFactor.toFixed(2)}
              sub="no winter capacity derate"
              accent="var(--accent-emerald)"
            />
          </Grid>
        </Card>
      )}

      {isCentralSteamHX && (
        <Card accent="#b8a3d3">
          <CardHeader>
            <CardTitle>Steam HX Sizing</CardTitle>
          </CardHeader>
          <Grid cols={3}>
            <MetricCard
              label="Combined source × HX η"
              value={`${(result.steamCombinedEfficiency * 100).toFixed(1)}%`}
              sub="upstream steam losses × HX transfer"
              accent="#b8a3d3"
            />
            <MetricCard
              label="Required steam input"
              value={fmt(result.gasInputBTUH / 1000)}
              unit="MBH"
              sub="total design load ÷ combined η"
              accent="#b8a3d3"
            />
            <MetricCard
              label="HX approach feasibility"
              value={result.steamApproachOK ? "✓ OK" : "✗ violates"}
              sub="storage setpoint must be ≥20°F below steam saturation"
              accent={result.steamApproachOK ? "var(--accent-emerald)" : "var(--accent-red)"}
            />
          </Grid>
        </Card>
      )}

      {isCentralTankless ? (
        <Card accent="#e8975c">
          <CardHeader>
            <CardTitle>Central Tankless Capacity (peak instantaneous)</CardTitle>
          </CardHeader>
          <Grid cols={3}>
            <MetricCard
              label="Required peak GPM"
              value={fmt(result.centralTanklessPeakGPMRequired, 1)}
              unit="GPM"
              sub="peak hour ÷ 60 × 1.5 (ASHRAE Ch. 51 instantaneous)"
            />
            <MetricCard
              label="Module capacity at rise"
              value={fmt(result.centralTanklessCapacityGPM, 1)}
              unit="GPM"
              sub={`@ ${fmt(result.temperatureRise)}°F design rise`}
            />
            <MetricCard
              label="Coverage"
              value={result.centralTanklessMetsDemand ? "✓ meets" : "✗ short"}
              sub="capacity ≥ required"
              accent={
                result.centralTanklessMetsDemand
                  ? "var(--accent-emerald)"
                  : "var(--accent-red)"
              }
            />
          </Grid>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Storage Sizing (ASHRAE method)</CardTitle>
          </CardHeader>
          <Grid cols={3}>
            <MetricCard label="Nominal storage" value={fmt(result.storageVolGal_nominal)} unit="gal" sub="Peak hour × storage coef (1.25)" />
            <MetricCard label="Usable storage" value={fmt(result.storageVolGal)} unit="gal" sub="Nominal ÷ 0.75 stratification fraction" />
            <MetricCard label="Tempered capacity" value={fmt(result.temperedCapacityGal)} unit="gal" sub="Stored 140°F → delivered" accent="var(--accent-violet)" />
          </Grid>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recovery</CardTitle>
        </CardHeader>
        <Grid cols={3}>
          <MetricCard label="Required recovery" value={fmt(result.recoveryGPH)} unit="GPH" />
          <MetricCard label="Required output" value={fmt(result.recoveryBTUH)} unit="BTU/hr" />
          <MetricCard label="Equivalent" value={fmt(result.recoveryKW, 1)} unit="kW" />
        </Grid>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recirculation</CardTitle>
        </CardHeader>
        <Grid cols={3}>
          <MetricCard label="Standby loss" value={fmt(result.recircLossBTUH)} unit="BTU/hr" accent="var(--accent-amber)" />
          <MetricCard label="Standby loss" value={fmt(result.recircLossKW, 2)} unit="kW" accent="var(--accent-amber)" />
          <MetricCard
            label="Loss fraction"
            value={`${((result.recircLossBTUH / result.totalBTUH) * 100).toFixed(1)}%`}
            sub="of total design load"
          />
        </Grid>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Design Load (with recirc)</CardTitle>
        </CardHeader>
        <Grid cols={2}>
          <MetricCard label="Total" value={fmt(result.totalBTUH)} unit="BTU/hr" />
          <MetricCard label="Total" value={fmt(result.totalKW, 1)} unit="kW" />
        </Grid>
      </Card>
    </div>
  );
}
