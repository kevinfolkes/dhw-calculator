"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { MetricCard } from "@/components/ui/MetricCard";
import { fmt, fmtUSD } from "@/lib/utils";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult, MonthlyRow } from "@/lib/calc/types";

interface Props {
  inputs: DhwInputs;
  result: CalcResult;
}

export function EnergyTab({ inputs, result }: Props) {
  const unit = result.monthly.monthlyUnit || "kWh";
  const hasHeating = result.monthly.heatingFraction > 0.01;
  const monthly = result.monthly.monthly;
  const aptUnit = unit; // per-apt shares the same unit as the building total
  // COP chart is only meaningful for heat-pump systems. For gas (UEF ~0.82–0.95)
  // and resistance (COP = 1.0) the line would be flat or misnamed, so hide it.
  const isHPWH = SYSTEM_TYPES[inputs.systemType].tech === "hpwh";
  const efficiencyLabel = isHPWH
    ? "COP"
    : SYSTEM_TYPES[inputs.systemType].tech === "gas"
    ? "UEF"
    : "η";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Grid cols={4}>
        <MetricCard label={`Annual ${unit}`} value={fmt(result.monthly.monthlyAnnualEnergy)} accent="var(--accent-blue)" />
        <MetricCard label="Annual cost" value={fmtUSD(result.monthly.monthlyAnnualCost)} unit="/yr" accent="var(--accent-blue)" />
        <MetricCard label="Annual carbon" value={fmt(result.monthly.monthlyAnnualCarbon)} unit="lb CO₂/yr" accent="var(--accent-violet)" />
        <MetricCard
          label="DHW vs heating split"
          value={`${Math.round(result.monthly.dhwFraction * 100)}%`}
          sub={hasHeating ? `${Math.round(result.monthly.heatingFraction * 100)}% heating` : "DHW only"}
        />
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Energy ({unit})</CardTitle>
        </CardHeader>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EF" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6B7280" />
              <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
              <Tooltip
                wrapperStyle={{ fontSize: 12 }}
                content={
                  <EnergyTooltip
                    unit={unit}
                    aptUnit={aptUnit}
                    hasHeating={hasHeating}
                    efficiencyLabel={efficiencyLabel}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="dhwEnergy" name="DHW" fill="#1D4ED8" stackId="e" />
              {hasHeating && <Bar dataKey="heatingEnergy" name="Heating" fill="#7C3AED" stackId="e" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {isHPWH ? (
        <Card>
          <CardHeader>
            <CardTitle>Monthly COP & Ambient Conditions</CardTitle>
          </CardHeader>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EF" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#F97316" />
                <Tooltip wrapperStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="monthCOP_dhw" name="DHW COP" stroke="#059669" strokeWidth={2} />
                {hasHeating && (
                  <Line yAxisId="left" type="monotone" dataKey="monthCOP_heating" name="Heating COP" stroke="#7C3AED" strokeWidth={2} />
                )}
                <Line yAxisId="right" type="monotone" dataKey="monthAmbient" name="Ambient °F" stroke="#F97316" strokeDasharray="4 2" />
                <Line yAxisId="right" type="monotone" dataKey="monthInlet" name="Inlet °F" stroke="#1D4ED8" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Ambient &amp; Inlet — {efficiencyLabel} essentially constant</CardTitle>
          </CardHeader>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
            {SYSTEM_TYPES[inputs.systemType].tech === "gas"
              ? `Gas systems are bounded by UEF (≈${(monthly[0]?.monthCOP_dhw ?? 0).toFixed(2)} year-round — no month-to-month variation), so a COP line isn't informative here.`
              : "Resistance systems convert 1:1 (COP = 1.00 year-round), so a COP line isn't informative here."}
          </p>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EF" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                <Tooltip wrapperStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="monthAmbient" name="Ambient °F" stroke="#F97316" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="monthInlet" name="Inlet °F" stroke="#1D4ED8" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {(result.preheatType === "solar" || result.preheatType === "solar+dwhr") && (
        <Card>
          <CardHeader>
            <CardTitle>
              Monthly Solar Fraction — annual avg{" "}
              {(result.annualSolarFraction * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            Share of monthly DHW load supplied by the solar collector array
            (capped at 85%).
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: 4,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            {monthly.map((row, i) => {
              const sf = result.monthlySolarFractions[i] ?? 0;
              const pct = (sf * 100).toFixed(0);
              const intensity = Math.min(1, sf / 0.85);
              return (
                <div
                  key={row.month}
                  style={{
                    textAlign: "center",
                    padding: "8px 2px",
                    background: `rgba(217, 119, 6, ${0.08 + intensity * 0.30})`,
                    borderRadius: 6,
                    border: "1px solid rgba(217, 119, 6, 0.2)",
                  }}
                  title={`${row.month}: ${pct}% solar`}
                >
                  <div style={{ color: "var(--text-muted)", fontSize: 10 }}>
                    {row.month}
                  </div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monthly Cost</CardTitle>
        </CardHeader>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EF" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6B7280" />
              <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" tickFormatter={(v) => `$${v}`} />
              <Tooltip
                wrapperStyle={{ fontSize: 12 }}
                formatter={(v) => (typeof v === "number" ? `$${v.toLocaleString()}` : String(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="dhwCost" name="DHW" fill="#1D4ED8" stackId="c" />
              {hasHeating && <Bar dataKey="heatingCost" name="Heating" fill="#7C3AED" stackId="c" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

interface EnergyTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: MonthlyRow }>;
  unit: string;
  aptUnit: string;
  hasHeating: boolean;
  efficiencyLabel: string;
}

/**
 * Custom Recharts tooltip for the monthly energy chart. Shows building
 * totals, per-apartment DHW (and heating, if the system has space heating),
 * and seasonal driver metrics (COP, inlet temp, resistance share) so a
 * reviewer can sanity-check the monthly numbers without flipping tabs.
 */
function EnergyTooltip({ active, label, payload, unit, aptUnit, hasHeating, efficiencyLabel }: EnergyTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border-light)",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, fontFamily: "var(--font-sans)" }}>
        {label}
      </div>

      <TipRow color="#1D4ED8" label="DHW (building)" value={`${fmt(row.dhwEnergy)} ${unit}`} />
      <TipRow color="#1D4ED8" label="DHW / apartment" value={`${fmt(row.dhwPerApt, unit === "therms" ? 2 : 1)} ${aptUnit}`} indent />
      {hasHeating && (
        <>
          <TipRow color="#7C3AED" label="Heating (building)" value={`${fmt(row.heatingEnergy)} ${unit}`} />
          <TipRow color="#7C3AED" label="Heating / apartment" value={`${fmt(row.heatingPerApt, unit === "therms" ? 2 : 1)} ${aptUnit}`} indent />
        </>
      )}
      <TipRow
        color="var(--accent-emerald)"
        label="Total"
        value={`${fmt(row.totalEnergy)} ${unit} · $${fmt(row.totalCost)}`}
      />

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid var(--border-light)", color: "var(--text-muted)", fontSize: 10 }}>
        <div>Ambient {row.monthAmbient.toFixed(1)}°F · Inlet {row.monthInlet.toFixed(1)}°F</div>
        <div>
          {efficiencyLabel}<sub>dhw</sub> {row.monthCOP_dhw.toFixed(2)}
          {unit === "kWh" && ` · Resist share ${(row.monthResistanceShare * 100).toFixed(1)}%`}
        </div>
      </div>
    </div>
  );
}

function TipRow({ color, label, value, indent }: { color: string; label: string; value: string; indent?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0", paddingLeft: indent ? 14 : 0 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {!indent && <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />}
        <span style={{ color: indent ? "var(--text-muted)" : "var(--text-secondary)" }}>{label}</span>
      </span>
      <span style={{ color: "var(--text-primary)", fontWeight: indent ? 500 : 600 }}>{value}</span>
    </div>
  );
}
