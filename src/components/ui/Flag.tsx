import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import type { ComplianceFlag } from "@/lib/calc/types";

const STYLES: Record<ComplianceFlag["level"], { bg: string; fg: string; border: string; Icon: LucideIcon }> = {
  ok: {
    bg: "var(--accent-emerald-bg)",
    fg: "var(--accent-emerald)",
    border: "var(--accent-emerald)",
    Icon: CheckCircle2,
  },
  info: {
    bg: "var(--accent-blue-bg)",
    fg: "var(--accent-blue)",
    border: "var(--accent-blue)",
    Icon: Info,
  },
  warn: {
    bg: "var(--accent-amber-bg)",
    fg: "#92400E",
    border: "var(--accent-amber)",
    Icon: AlertTriangle,
  },
  error: {
    bg: "var(--accent-red-bg)",
    fg: "var(--accent-red)",
    border: "var(--accent-red)",
    Icon: AlertTriangle,
  },
};

export function Flag({ flag }: { flag: ComplianceFlag }) {
  const s = STYLES[flag.level];
  const Icon = s.Icon;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        borderLeft: `3px solid ${s.border}`,
        background: s.bg,
      }}
    >
      <Icon size={16} color={s.fg} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: s.fg, letterSpacing: "0.02em" }}>{flag.code}</div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2, lineHeight: 1.5 }}>{flag.msg}</div>
      </div>
    </div>
  );
}
