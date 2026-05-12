/**
 * Shared typography + layout primitives for the per-calculator Methodology
 * tabs. Originally inlined inside `tabs/MethodologyTab.tsx` for DHW; lifted
 * here so the lighting (and future) calculators can render long-form
 * reference content with a consistent visual identity.
 */
import type { ReactNode } from "react";

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        color: "var(--text-primary)",
        lineHeight: 1.7,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

export function H4({ children }: { children: ReactNode }) {
  return (
    <h4
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: "var(--accent-blue)",
        margin: "8px 0 0",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </h4>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        background: "var(--accent-blue-bg)",
        color: "var(--accent-blue)",
        padding: "1px 6px",
        borderRadius: 4,
      }}
    >
      {children}
    </code>
  );
}

export function Em({ children }: { children: ReactNode }) {
  return (
    <em style={{ fontStyle: "normal", fontWeight: 600, color: "var(--accent-violet)" }}>
      {children}
    </em>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        background: "#F8FAFC",
        border: "1px solid var(--border-light)",
        borderLeft: "3px solid var(--accent-blue)",
        padding: "8px 12px",
        borderRadius: 6,
        color: "var(--text-primary)",
        whiteSpace: "pre-wrap",
        margin: "4px 0",
      }}
    >
      {children}
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto", margin: "4px 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "6px 10px",
                  background: "var(--accent-blue-bg)",
                  color: "var(--text-secondary)",
                  borderBottom: "1px solid var(--border-light)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontSize: 10.5,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: "6px 10px",
                    borderBottom: "1px solid var(--border-light)",
                    color: "var(--text-primary)",
                    verticalAlign: "top",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Quote / callout block — used to surface a reference's verbatim language
 *  or a key insight that should stand apart from the running prose. */
export function Callout({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn" | "success";
}) {
  const colorMap = {
    info: { border: "var(--accent-blue)", bg: "var(--accent-blue-bg)" },
    warn: { border: "var(--accent-amber)", bg: "var(--accent-amber-bg)" },
    success: { border: "var(--accent-emerald)", bg: "var(--accent-emerald-bg)" },
  } as const;
  const c = colorMap[tone];
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeft: `4px solid ${c.border}`,
        padding: "10px 14px",
        borderRadius: 6,
        fontSize: 12.5,
        lineHeight: 1.65,
        color: "var(--text-primary)",
        margin: "4px 0",
      }}
    >
      {children}
    </div>
  );
}
