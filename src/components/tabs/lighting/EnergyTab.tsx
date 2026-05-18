"use client";

/**
 * Lighting Energy & cost tab — annual rollup cards + monthly stacked chart
 * (kWh per category, day-count-weighted across months) + per-category
 * breakdown table + advisory flags. Extracted from `LightingCalculator.tsx`
 * to match the in-unit HVAC tab extraction pattern. Wrapped in React.memo
 * so unrelated parent re-renders don't trigger a recharts re-render.
 */
import { memo, useMemo } from "react";
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
import { MONTH_DAYS, MONTHS } from "@/lib/engineering/constants";
import {
  LIGHTING_CATEGORY_LABELS,
  type LightingCategory,
} from "@/lib/lighting/inputs";
import {
  CHART_AXIS,
  CHART_GRID,
  LIGHTING_CATEGORY_COLORS as CATEGORY_COLORS,
} from "@/lib/chart-palette";
import type { LightingResult } from "@/lib/lighting/types";

interface Props {
  result: LightingResult;
}

/** Build the per-category monthly data the recharts BarChart expects. Each
 *  row is `{ month, [categoryKey]: kWh, ... }`. Lighting load is uniform
 *  across the year, so each month gets `daysInMonth / 365` of each
 *  category's annual kWh — December (31 days) is the tallest bar by ~10%
 *  vs February (28 days). */
function buildMonthlyCategoryData(result: LightingResult) {
  return MONTHS.map((monthName, m) => {
    const dayShare = MONTH_DAYS[m] / 365;
    const row: Record<string, string | number> = { month: monthName };
    for (const cat of result.categories) {
      row[cat.category] = +(cat.annualKWh * dayShare).toFixed(1);
    }
    row._totalCost = +(result.annualCost * dayShare).toFixed(0);
    row._totalCarbon = +(result.annualCarbon * dayShare).toFixed(0);
    return row;
  });
}

/** Custom tooltip that shows per-category kWh + the month's total cost +
 *  carbon, since the stacked bars only encode kWh visually. */
function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: Record<string, number | string> }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((s, p) => s + (typeof p.value === "number" ? p.value : 0), 0);
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
        .reverse() // top-to-bottom matches the stack
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

function EnergyTabInner({ result }: Props) {
  // Build chart data once per render — recharts is stateless and the
  // monthly values are derived from `result` directly.
  const monthlyData = useMemo(() => buildMonthlyCategoryData(result), [result]);

  // Categories present in the result with non-zero contribution — chart
  // hides the others so the legend stays clean (e.g., garage/parking when
  // count is 0).
  const visibleCategories = result.categories.filter((c) => c.annualKWh > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
        Annual energy &amp; cost
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <MetricBig label="Annual electricity" value={`${fmt(result.annualKWh, 0)} kWh`} />
        <MetricBig label="Annual cost" value={fmtUSD(result.annualCost, 0)} />
        <MetricBig label="Annual carbon" value={`${fmt(result.annualCarbon, 0)} lb CO₂e`} />
        <MetricBig label="LPD (W/ft²)" value={result.lpdWattsPerSqft.toFixed(2)} />
        <MetricBig label="Total connected W" value={fmt(result.totalConnectedWatts, 0)} />
      </div>

      {/* Monthly breakdown — stacked bar by category */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly energy by category (kWh)</CardTitle>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0", lineHeight: 1.5 }}>
            Lighting load is climate-insensitive — each month&apos;s share is
            its day-count fraction of the annual total ({"≈ daysInMonth / 365"}).
            December (31 days) is ~10% taller than February (28 days). The
            stack shows which category dominates the load.
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
              {visibleCategories.map((cat) => (
                <Bar
                  key={cat.category}
                  dataKey={cat.category}
                  name={LIGHTING_CATEGORY_LABELS[cat.category as LightingCategory]}
                  fill={CATEGORY_COLORS[cat.category as LightingCategory]}
                  stackId="e"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--accent-blue-bg)", color: "var(--text-secondary)" }}>
                <th style={th}>Category</th>
                <th style={thNum}>Connected W</th>
                <th style={thNum}>Annual hr</th>
                <th style={thNum}>kWh/yr</th>
                <th style={thNum}>$/yr</th>
                <th style={thNum}>lb CO₂/yr</th>
              </tr>
            </thead>
            <tbody>
              {result.categories.map((c) => (
                <tr key={c.category} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={td}>{LIGHTING_CATEGORY_LABELS[c.category as LightingCategory]}</td>
                  <td style={tdNum}>{fmt(c.connectedWatts, 0)}</td>
                  <td style={tdNum}>{fmt(c.annualHours, 0)}</td>
                  <td style={tdNum}>{fmt(c.annualKWh, 0)}</td>
                  <td style={tdNum}>{fmtUSD(c.annualCost, 0)}</td>
                  <td style={tdNum}>{fmt(c.annualCarbon, 0)}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--accent-blue-bg)", fontWeight: 700 }}>
                <td style={td}>Total</td>
                <td style={tdNum}>{fmt(result.totalConnectedWatts, 0)}</td>
                <td style={tdNum}>—</td>
                <td style={tdNum}>{fmt(result.annualKWh, 0)}</td>
                <td style={tdNum}>{fmtUSD(result.annualCost, 0)}</td>
                <td style={tdNum}>{fmt(result.annualCarbon, 0)}</td>
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

/** Memoized — only re-renders when `result` changes by reference, so
 *  parent-shell re-renders from unrelated state updates skip this tab's
 *  recharts re-paint entirely. */
export const EnergyTab = memo(EnergyTabInner);

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
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
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
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
