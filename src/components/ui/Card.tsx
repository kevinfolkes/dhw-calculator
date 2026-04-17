import type { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  accent?: string;
}

export function Card({ children, className, style, accent }: CardProps) {
  return (
    <div
      className={cn("ve-card", className)}
      style={{
        ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(className)}
      style={{ marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--border-light)" }}
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
