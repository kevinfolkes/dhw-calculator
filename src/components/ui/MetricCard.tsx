import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: ReactNode;
  accent?: string;
}

export function MetricCard({ label, value, unit, sub, accent = "var(--accent-blue)" }: MetricCardProps) {
  return (
    <div className="ve-card" style={{ borderLeft: `3px solid ${accent}` }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          marginTop: 4,
          fontSize: 26,
          fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginLeft: 4 }}>
            {unit}
          </span>
        )}
      </p>
      {sub && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>
      )}
    </div>
  );
}
