"use client";

/**
 * Landing page (`/`) — first thing users see. Briefly introduces the
 * calculator suite + provides a tile grid for jumping into any individual
 * end-use calculator. Future enhancement: project / building info form
 * (climate zone, fuel rates, grid region) so subsequent calculator pages
 * can read shared building inputs from a ProjectContext provider.
 */
import Link from "next/link";
import {
  AirVent,
  Building2,
  ChevronRight,
  ClipboardList,
  Droplets,
  GitCompare,
  Lightbulb,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

interface Tile {
  href: string;
  label: string;
  icon: LucideIcon;
  status: "live" | "next" | "future";
  description: string;
}

const TILES: Tile[] = [
  {
    href: "/dhw",
    label: "Domestic Hot Water",
    icon: Droplets,
    status: "live",
    description:
      "19 system types: central + in-unit, gas + electric + HPWH + hybrid + cogen. ASHRAE / NEEA / EPA calibrated.",
  },
  {
    href: "/lighting",
    label: "Lighting",
    icon: Lightbulb,
    status: "live",
    description:
      "Common-area, exterior, and in-unit fixture inventory. LED retrofit savings vs incumbent.",
  },
  {
    href: "/inunit-hvac",
    label: "In-unit HVAC",
    icon: AirVent,
    status: "live",
    description:
      "PTACs, PTHPs, mini-splits, window units. Per-apartment cooling + heating retrofit math, ASHRAE / NEEP / ENERGY STAR calibrated.",
  },
  {
    href: "/rtus",
    label: "Rooftop HVAC",
    icon: Wind,
    status: "future",
    description: "Packaged RTUs serving common areas + retail. IEER / SEER2 retrofit math.",
  },
  {
    href: "/boilers-chillers",
    label: "Boilers & chillers",
    icon: Wrench,
    status: "future",
    description: "Central plant retrofit: boiler stage-up, chiller upgrade, distribution pumps.",
  },
];

const CROSS_TILES: Tile[] = [
  {
    href: "/reports",
    label: "Reports library",
    icon: ClipboardList,
    status: "next",
    description: "All saved scenarios across every end use. Export to PDF / DOCX / Excel / CSV.",
  },
  {
    href: "/compare",
    label: "Compare",
    icon: GitCompare,
    status: "next",
    description:
      "Side-by-side any 2–4 saved reports. Δ column for two-scenario retrofit deltas.",
  },
];

export default function LandingPage() {
  return (
    <div
      style={{
        maxWidth: 1024,
        margin: "0 auto",
        padding: "40px 32px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 36,
      }}
    >
      {/* Hero — Stripe-docs scale: clear but not loud ────────────────── */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "8px 0",
          maxWidth: 720,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-muted)",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          <Building2 size={13} /> Multifamily building energy
        </div>
        <h1
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(26px, 2.6vw, 32px)",
            fontWeight: 700,
            letterSpacing: "-0.018em",
            lineHeight: 1.2,
            margin: 0,
            color: "var(--text-primary)",
          }}
        >
          Pick an end use to size or retrofit
        </h1>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            margin: "4px 0 0 0",
            maxWidth: 620,
          }}
        >
          Each calculator covers one major multifamily end use. Configure your
          existing equipment, then run a current-vs-proposed comparison to
          quantify the kWh, $, and lb CO₂ saved by upgrading. Save scenarios
          to the cross-end-use report library to revisit, export, or compare.
        </p>
      </section>

      {/* End-use tiles ──────────────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionHeader>End-use calculators</SectionHeader>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {TILES.map((tile) => (
            <TileCard key={tile.href} tile={tile} />
          ))}
        </div>
      </section>

      {/* Cross-calculator tiles ─────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionHeader>Reports &amp; comparison</SectionHeader>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {CROSS_TILES.map((tile) => (
            <TileCard key={tile.href} tile={tile} />
          ))}
        </div>
      </section>

      {/* Footer / methodology pointer ──────────────────────────────── */}
      <section
        style={{
          marginTop: 4,
          padding: "14px 18px",
          background: "var(--surface-subtle)",
          borderRadius: 8,
          border: "1px solid var(--border-light)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text-primary)",
        }}
      >
        <Zap size={15} style={{ marginTop: 2, flexShrink: 0, color: "var(--accent-blue)" }} />
        <div>
          <strong>Engineering calibration.</strong> Every shipped calculator is
          cross-validated against published ASHRAE / NEEA / EPA / NREL
          reference values, with regression tests in CI. See{" "}
          <code style={{ fontSize: 12, background: "#fff", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border-light)" }}>docs/calibration.md</code>{" "}
          for current verification status per end use.
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        margin: "0 0 2px 0",
      }}
    >
      {children}
    </h2>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  const disabled = tile.status === "future";

  const inner = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            background: disabled ? "var(--surface-muted)" : "var(--accent-blue-bg)",
            color: disabled ? "var(--text-muted)" : "var(--accent-blue)",
          }}
        >
          <Icon size={17} />
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
            gap: 2,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.005em",
              color: disabled ? "var(--text-muted)" : "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {tile.label}
            {tile.status === "next" && (
              <StatusBadge color="var(--accent-emerald)" bg="var(--accent-emerald-bg)">
                Next
              </StatusBadge>
            )}
            {tile.status === "future" && (
              <StatusBadge color="var(--text-muted)" bg="var(--surface-muted)">
                Future
              </StatusBadge>
            )}
            {tile.status === "live" && (
              <StatusBadge color="var(--accent-blue)" bg="var(--accent-blue-bg)">
                Live
              </StatusBadge>
            )}
          </div>
        </div>
        {!disabled && (
          <ChevronRight
            size={15}
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
          />
        )}
      </div>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text-secondary)",
          margin: 0,
        }}
      >
        {tile.description}
      </p>
    </>
  );

  const baseStyle: React.CSSProperties = {
    display: "block",
    padding: "16px 18px 18px",
    borderRadius: 8,
    border: "1px solid var(--border-light)",
    background: disabled ? "var(--surface-subtle)" : "var(--card-bg)",
    transition:
      "border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease",
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };

  if (disabled) {
    return (
      <div style={baseStyle} title="Planned for a future phase">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={tile.href}
      style={baseStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-blue)";
        e.currentTarget.style.boxShadow = "var(--card-shadow-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-light)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {inner}
    </Link>
  );
}

function StatusBadge({
  children,
  color,
  bg,
}: {
  children: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 7px",
        borderRadius: 4,
        background: bg,
        color: color,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}
