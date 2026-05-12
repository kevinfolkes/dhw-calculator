/**
 * Shared typography + layout primitives for the per-calculator Calculations
 * tabs (worked-example walkthroughs that substitute current inputs into every
 * formula). Originally inlined inside `tabs/CalculationsTab.tsx` for DHW and
 * later duplicated in `tabs/inunit-hvac/CalculationsTab.tsx`; lifted here so
 * both consumers (and future calculators) render math walkthroughs with the
 * same visual identity.
 *
 * Note: the long-form Methodology tabs use a separate set of helpers in
 * `@/components/methodology/Helpers` with intentionally different styling
 * (large prose vs compact worked-example). The two are NOT interchangeable
 * — pick the import based on which kind of tab you're rendering.
 */
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/** Numbered card representing one step in the worked example. Renders a
 *  monospace step-number badge, the title, and an optional subtitle in a
 *  compact header row. */
export function Step({
  n,
  title,
  subtitle,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
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
        {subtitle && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {subtitle}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </Card>
  );
}

/** Compact paragraph for explanatory text within a Step. Renders smaller +
 *  muted compared to the long-form Methodology Prose, so it sits visually
 *  below the Formula / Sub blocks rather than competing with them. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 12.5,
        color: "var(--text-secondary)",
        lineHeight: 1.7,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

/** Inline emphasis — non-italic, bold, primary-text color. Used to lift a
 *  specific term inside a Prose block. */
export function Em({ children }: { children: ReactNode }) {
  return (
    <em
      style={{
        fontStyle: "normal",
        fontWeight: 700,
        color: "var(--text-primary)",
      }}
    >
      {children}
    </em>
  );
}

/** Monospaced formula block with a blue left-rule. The canonical form of
 *  the equation lives here; the substituted-values version goes in `Sub`. */
export function Formula({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        background: "var(--surface-subtle, rgba(0,0,0,0.02))",
        borderLeft: "2px solid var(--accent-blue)",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        color: "var(--text-primary)",
        lineHeight: 1.7,
        overflowX: "auto",
      }}
    >
      {children}
    </div>
  );
}

/** Indented monospace block showing the formula with current inputs
 *  substituted in. Visually subordinate to its Formula sibling — sits
 *  underneath, indented, in secondary text color. */
export function Sub({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "6px 12px",
        marginLeft: 14,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        color: "var(--text-secondary)",
        lineHeight: 1.7,
        overflowX: "auto",
      }}
    >
      {children}
    </div>
  );
}

/** Highlight wrapper for the final computed value at the end of a Sub —
 *  monospace, emerald, extra-bold. The pattern is "...formula = (some
 *  number) <Result>(final answer)</Result>". */
export function Result({ children }: { children: ReactNode }) {
  return (
    <strong
      style={{
        color: "var(--accent-emerald)",
        fontWeight: 800,
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </strong>
  );
}

/** Two-column key/value list — used for surfacing reference values + lookup
 *  results without taking up the full width of a Formula block. */
export function KVList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "4px 16px",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        padding: "4px 12px",
      }}
    >
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: "contents" }}>
          <div style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {k}
          </div>
          <div style={{ color: "var(--text-primary)" }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/** Compact callout — tonal background + colored left-rule. Use sparingly
 *  within Step bodies to flag a notable observation, warning, or
 *  cross-reference. Smaller and tighter than the long-form Methodology
 *  Callout. Tone "ok" = green, "info" = blue, "warn" = amber. */
export function Callout({
  tone,
  children,
}: {
  tone: "ok" | "info" | "warn";
  children: ReactNode;
}) {
  const palette =
    tone === "ok"
      ? {
          bg: "rgba(5,150,105,0.08)",
          border: "var(--accent-emerald)",
          color: "var(--accent-emerald)",
        }
      : tone === "warn"
      ? {
          bg: "rgba(245,158,11,0.10)",
          border: "var(--accent-amber)",
          color: "var(--accent-amber)",
        }
      : {
          bg: "rgba(29,78,216,0.08)",
          border: "var(--accent-blue)",
          color: "var(--accent-blue)",
        };
  return (
    <div
      style={{
        padding: "8px 12px",
        background: palette.bg,
        borderLeft: `3px solid ${palette.border}`,
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.6,
        color: palette.color,
      }}
    >
      {children}
    </div>
  );
}
