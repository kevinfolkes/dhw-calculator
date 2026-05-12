import type { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** When set, renders a colored left border — used for callouts (warn /
   *  info / success blocks). Implies `bordered` styling regardless of the
   *  `bordered` prop value. */
  accent?: string;
  /** When true, renders the classic boxed card (white bg + border + soft
   *  shadow) used for callouts, savings strips, and any block that needs
   *  visual definition. When false (the default), the card is borderless
   *  — content flows with only padding + a header rule for separation.
   *  This shift is the single biggest visual change of the latest reskin:
   *  the page becomes a flowing document instead of a wall of boxes. */
  bordered?: boolean;
}

export function Card({ children, className, style, accent, bordered }: CardProps) {
  // Show the boxed treatment when explicitly bordered OR when `accent` is
  // provided (the colored left border only reads correctly against a
  // white card background).
  const isBoxed = bordered || Boolean(accent);

  const baseStyle: CSSProperties = isBoxed
    ? {
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--card-radius)",
        boxShadow: "var(--card-shadow)",
        padding: "20px 24px",
        ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
      }
    : {
        // Borderless default: a flowing section block. No background,
        // no border, no shadow — just padding so the contents have
        // breathing room. Visual separation between sections comes from
        // the parent container's `gap` and from CardHeader's bottom rule.
        background: "transparent",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        padding: "8px 0 24px",
      };

  return (
    <div
      className={cn(isBoxed ? "ve-card" : undefined, className)}
      style={{ ...baseStyle, ...style }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(className)}
      style={{
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: "1px solid var(--border-light)",
      }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={cn("ve-section-title", className)}
      style={{ fontSize: 15, margin: 0 }}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children }: { children: ReactNode }) {
  return (
    <p style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}
