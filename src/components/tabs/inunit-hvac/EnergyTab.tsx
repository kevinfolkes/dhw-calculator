"use client";

/**
 * In-unit HVAC Energy & cost tab — annual rollup cards + monthly stacked
 * chart (cooling vs heating split by climate-zone CDD/HDD shares) + per-
 * end-use breakdown table + advisory flags. Split out of
 * `InUnitHvacCalculator.tsx` so the shell stays focused on routing.
 */
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { fmt, fmtUSD } from "@/lib/utils";
import {
  CHART_AXIS,
  CHART_GRID,
  INUNIT_HVAC_ENDUSE_COLORS as ENDUSE_COLORS,
} from "@/lib/chart-palette";
import type { InUnitHvacInputs } from "@/lib/inunit-hvac/inputs";
import type { InUnitHvacResult } from "@/lib/inunit-hvac/types";

interface Props {
  inputs: InUnitHvacInputs;
  result: InUnitHvacResult;
}

/** Build the per-end-use monthly data the recharts BarChart expects.
 *  Each row is `{ month, cooling: kWh, heating: kWh }`. */
function buildMonthlyEnduseData(result: InUnitHvacResult) {
  return result.monthly.monthly.map((m) => ({
    month: m.month,
    cooling: +m.coolingKWh.toFixed(0),
    heating: +m.heatingKWh.toFixed(0),
    _totalCost: +m.totalCost.toFixed(0),
    _totalCarbon: +m.totalCarbon.toFixed(0),
  }));
}

/** Custom tooltip that shows per-end-use kWh + the month's total cost +
 *  carbon, since the stacked bars only encode kWh visually. */
function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: Record<string, number | string>;
  }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce(
    (s, p) => s + (typeof p.value === "number" ? p.value : 0),
    0,
  );
  const costRaw = payload[0]?.payload?._totalCost;
  const carbonRaw = payload[0]?.payload?._totalCarbon;
  const monthCost = typeof costRaw === "number" ? costRaw : 0;
  const monthCarbon = typeof carbonRaw === "number" ? carbonRaw : 0;
  return (
    <div
      style={{
        background: "var(--card-bg, #fff)",
        border: "1px solid var(--border-light)",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload
        .slice()
        .reverse()
        .filter((p) => typeof p.value === "number" && p.value > 0)
        .map((p) => (
          <div
            key={p.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 2,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: p.color,
                  display: "inline-block",
                }}
              />
              {p.name}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              {fmt(p.value as number, 0)} kWh
            </span>
          </div>
        ))}
      <div
        style={{
          borderTop: "1px solid var(--border-light)",
          marginTop: 6,
          paddingTop: 6,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Total</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmt(total, 0)} kWh
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "var(--text-secondary)",
            fontWeight: 500,
          }}
        >
          <span>Cost / Carbon</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtUSD(monthCost, 0)} · {fmt(monthCarbon, 0)} lb
          </span>
        </div>
      </div>
    </div>
  );
}

export function EnergyTab({ inputs, result }: Props) {
  const monthlyData = useMemo(() => buildMonthlyEnduseData(result), [result]);
  const showCooling = result.cooling.buildingKWh > 0;
  const showHeating = result.heating.buildingKWh > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
        Annual energy &amp; cost
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <MetricBig
          label="Annual electricity"
          value={`${fmt(result.totalAnnualKWh, 0)} kWh`}
        />
        <MetricBig label="Annual cost" value={fmtUSD(result.totalAnnualCost, 0)} />
        <MetricBig
          label="Annual carbon"
          value={`${fmt(result.totalAnnualCarbon, 0)} lb CO₂e`}
        />
        <MetricBig
          label="Connected cooling"
          value={`${result.totalConnectedTons.toFixed(1)} tons`}
        />
        <MetricBig label="Apartments" value={fmt(result.apartmentCount, 0)} />
      </div>

      {/* Monthly stacked chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly energy by end-use (kWh)</CardTitle>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              margin: "4px 0 0",
              lineHeight: 1.5,
            }}
          >
            Cooling kWh distributes across the year by climate-zone CDD share
            (peaks Jul/Aug); heating kWh by HDD share (peaks Dec/Jan). The
            shape changes dramatically by climate — try Miami vs Minneapolis
            to see.
          </p>
        </CardHeader>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke={CHART_AXIS} />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke={CHART_AXIS}
                label={{
                  value: "kWh",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: CHART_AXIS },
                }}
              />
              <Tooltip wrapperStyle={{ fontSize: 12 }} content={<MonthlyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
              {showCooling && (
                <Bar dataKey="cooling" name="Cooling" fill={ENDUSE_COLORS.cooling} stackId="e" />
              )}
              {showHeating && (
                <Bar dataKey="heating" name="Heating" fill={ENDUSE_COLORS.heating} stackId="e" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-end-use breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>By end-use</CardTitle>
        </CardHeader>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--accent-blue-bg)", color: "var(--text-secondary)" }}>
                <th style={th}>End-use</th>
                <th style={thNum}>Capacity (BTU/h)</th>
                <th style={thNum}>EFLH (hr/yr)</th>
                <th style={thNum}>Eff (rated)</th>
                <th style={thNum}>Eff COP</th>
                <th style={thNum}>kWh/apt</th>
                <th style={thNum}>kWh/yr</th>
                <th style={thNum}>$/yr</th>
                <th style={thNum}>lb CO₂/yr</th>
              </tr>
            </thead>
            <tbody>
              <EndUseRow
                label="Cooling"
                metricLabel={inputs.coolingEfficiencyMetric}
                row={result.cooling}
              />
              <EndUseRow
                label="Heating"
                metricLabel={inputs.heatingEfficiencyMetric}
                row={result.heating}
              />
              <tr style={{ background: "var(--accent-blue-bg)", fontWeight: 700 }}>
                <td style={td}>Total</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>
                  {fmt(
                    (result.cooling.perAptKWh ?? 0) + (result.heating.perAptKWh ?? 0),
                    0,
                  )}
                </td>
                <td style={tdNum}>{fmt(result.totalAnnualKWh, 0)}</td>
                <td style={tdNum}>{fmtUSD(result.totalAnnualCost, 0)}</td>
                <td style={tdNum}>{fmt(result.totalAnnualCarbon, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {result.flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Flags &amp; advisories</CardTitle>
          </CardHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.flags.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor:
                    f.level === "error"
                      ? "var(--accent-red)"
                      : f.level === "warn"
                      ? "var(--accent-amber)"
                      : f.level === "ok"
                      ? "var(--accent-emerald)"
                      : "var(--border-light)",
                  background:
                    f.level === "error"
                      ? "var(--accent-red-bg)"
                      : f.level === "warn"
                      ? "var(--accent-amber-bg)"
                      : f.level === "ok"
                      ? "var(--accent-emerald-bg)"
                      : "var(--surface-subtle, rgba(0,0,0,0.02))",
                  fontSize: 12.5,
                  lineHeight: 1.55,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>
                  {f.code}
                </div>
                <div style={{ marginTop: 4, color: "var(--text-primary)" }}>{f.msg}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function EndUseRow({
  label,
  metricLabel,
  row,
}: {
  label: string;
  metricLabel: string;
  row: InUnitHvacResult["cooling"];
}) {
  return (
    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
      <td style={td}>{label}</td>
      <td style={tdNum}>{fmt(row.capacityBtuh, 0)}</td>
      <td style={tdNum}>{fmt(row.eflhHours, 0)}</td>
      <td style={tdNum}>
        {row.ratedEfficiency.toFixed(1)}{" "}
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{metricLabel}</span>
      </td>
      <td style={tdNum}>{row.effectiveCOP.toFixed(2)}</td>
      <td style={tdNum}>{fmt(row.perAptKWh, 0)}</td>
      <td style={tdNum}>{fmt(row.buildingKWh, 0)}</td>
      <td style={tdNum}>{fmtUSD(row.buildingCost, 0)}</td>
      <td style={tdNum}>{fmt(row.buildingCarbon, 0)}</td>
    </tr>
  );
}

function MetricBig({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        background: "var(--card-bg, #fff)",
        border: "1px solid var(--border-light)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 700,
  borderBottom: "1px solid var(--border-light)",
};
const thNum: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "8px 10px", color: "var(--text-primary)" };
const tdNum: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
