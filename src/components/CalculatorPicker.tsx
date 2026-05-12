"use client";

/**
 * Calculator picker — the contents of the AppShell drawer. Lists every
 * end-use calculator grouped by tier, with availability status (live now /
 * coming next / future). Picking a calculator navigates to that route.
 *
 * Status icons:
 *   ●  — Live and ready to use
 *   ○  — Planned next phase (route exists but stub or in progress)
 *   —  — Future phase (no route yet)
 *
 * Adding a new calculator: append to `CALCULATORS` and create the route
 * under `src/app/<href>/page.tsx`. The picker auto-renders it.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AirVent,
  Building2,
  ClipboardList,
  Droplets,
  GitCompare,
  Lightbulb,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Status = "live" | "next" | "future";

interface CalculatorEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  status: Status;
  description: string;
}

interface TierGroup {
  title: string;
  entries: CalculatorEntry[];
}

const TIERS: TierGroup[] = [
  {
    title: "Tier 1 — Major end uses",
    entries: [
      {
        href: "/dhw",
        label: "Domestic Hot Water",
        icon: Droplets,
        status: "live",
        description: "19 system types · sizing, energy, retrofit",
      },
      {
        href: "/lighting",
        label: "Lighting",
        icon: Lightbulb,
        status: "live",
        description: "Common-area, exterior, in-unit · LED retrofit",
      },
      {
        href: "/rtus",
        label: "Rooftop HVAC (RTUs)",
        icon: Wind,
        status: "future",
        description: "Packaged units · cooling tonnage, heating MBH",
      },
      {
        href: "/boilers-chillers",
        label: "Boilers & chillers",
        icon: Wrench,
        status: "future",
        description: "Central heating + chilled water plants",
      },
    ],
  },
  {
    title: "Tier 2 — Common end uses",
    entries: [
      {
        href: "/inunit-hvac",
        label: "In-unit HVAC",
        icon: AirVent,
        status: "live",
        description: "PTACs, mini-splits, through-wall · per-apt retrofit math",
      },
      {
        href: "/laundry-elevators",
        label: "Laundry & elevators",
        icon: Zap,
        status: "future",
        description: "Common-area appliances",
      },
      {
        href: "/ventilation",
        label: "Ventilation",
        icon: Wind,
        status: "future",
        description: "Common-area exhaust, MUA, in-unit ERVs",
      },
      {
        href: "/plug-refrigerator",
        label: "Plug + refrigerators",
        icon: Zap,
        status: "future",
        description: "Per-apartment baseline + ENERGY STAR",
      },
    ],
  },
  {
    title: "Cross-calculator",
    entries: [
      {
        href: "/reports",
        label: "Reports library",
        icon: ClipboardList,
        status: "next",
        description: "All saved scenarios across every end use",
      },
      {
        href: "/compare",
        label: "Compare",
        icon: GitCompare,
        status: "next",
        description: "Side-by-side any 2–4 saved scenarios",
      },
      {
        href: "/",
        label: "Building overview",
        icon: Building2,
        status: "live",
        description: "Project info, climate, fuel rates",
      },
    ],
  },
];

export function CalculatorPicker({ onPick }: { onPick?: () => void }) {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {TIERS.map((tier) => (
        <div key={tier.title}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 8,
              paddingLeft: 4,
            }}
          >
            {tier.title}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {tier.entries.map((entry) => (
              <CalculatorRow
                key={entry.href}
                entry={entry}
                active={pathname === entry.href}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function CalculatorRow({
  entry,
  active,
  onPick,
}: {
  entry: CalculatorEntry;
  active: boolean;
  onPick?: () => void;
}) {
  const Icon = entry.icon;
  const disabled = entry.status === "future";

  const baseStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 6,
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    background: active ? "var(--card-bg)" : "transparent",
    border: active
      ? "1px solid var(--border-light)"
      : "1px solid transparent",
    boxShadow: active ? "var(--card-shadow)" : "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
    textDecoration: "none",
  };

  const content = (
    <>
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: active ? "var(--accent-blue)" : "transparent",
          color: active ? "#fff" : disabled ? "var(--text-muted)" : "var(--text-secondary)",
          flexShrink: 0,
          transition: "background 120ms ease, color 120ms ease",
        }}
      >
        <Icon size={14} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: active ? 600 : 500,
            color: disabled ? "var(--text-muted)" : "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {entry.label}
          {entry.status === "next" && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 3,
                background: "var(--accent-emerald-bg)",
                color: "var(--accent-emerald)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Next
            </span>
          )}
          {entry.status === "future" && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 3,
                background: "var(--surface-muted)",
                color: "var(--text-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Future
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
            marginTop: 1,
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.description}
        </div>
      </div>
    </>
  );

  if (disabled) {
    return (
      <div
        style={{ ...baseStyle, opacity: 0.65 }}
        title="Planned for a future phase"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={entry.href}
      style={baseStyle}
      onClick={onPick}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "var(--surface-muted)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {content}
    </Link>
  );
}
