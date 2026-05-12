"use client";

/**
 * Vertical sidebar tab navigation with collapsible groups. Used by the DHW
 * calculator (13 tabs across 4 workflow stages — Inputs, Evaluation,
 * Documentation, Output) where the horizontal `TopTabNav` couldn't fit all
 * the tabs without overflow. Stripe Docs / Linear / Notion all use this
 * exact pattern for navigating complex documentation hierarchies.
 *
 * Other calculators (lighting, in-unit HVAC) keep `TopTabNav` since their
 * tab lists are small enough to fit a horizontal row — this nav is reserved
 * for surfaces with genuine workflow hierarchy.
 *
 * Layout: sticky left rail, ~220px wide, sits below the AppShell brand bar
 * (so the calculator picker hamburger remains accessible at the top). The
 * rail itself scrolls vertically when its content exceeds viewport height.
 *
 * Behavior:
 *   - All groups start expanded; user can collapse any of them.
 *   - When `active` changes (URL hash, parent state, smart preset), the
 *     group containing the active tab is force-expanded so the user never
 *     ends up with an active tab hidden inside a collapsed group. The
 *     other groups' user-driven collapse state is preserved.
 *   - The active tab gets a colored left border + tinted background so it
 *     reads as "you are here" regardless of which group is active.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

const APP_BRAND_BAR = 48;
const SIDE_NAV_WIDTH = 220;

export interface SideTab<TId extends string = string> {
  id: TId;
  label: string;
  icon?: LucideIcon;
}

export interface SideTabGroup<TId extends string = string> {
  title: string;
  tabs: SideTab<TId>[];
}

interface Props<TId extends string> {
  /** Calculator-level identity rendered at the top of the rail. Mirrors
   *  TopTabNav's `label` slot — same icon + text, vertical layout. */
  label?: { icon: LucideIcon; text: string; iconColor?: string };
  /** Grouped tab list. Each group renders as a collapsible section. */
  groups: ReadonlyArray<SideTabGroup<TId>>;
  active: TId;
  onSelect: (id: TId) => void;
  /** Optional bottom-of-rail slot for status / config indicator (system
   *  type, unit count, etc.). Renders below the tabs with a top border. */
  trailing?: React.ReactNode;
}

export function SideTabNav<TId extends string>({
  label,
  groups,
  active,
  onSelect,
  trailing,
}: Props<TId>) {
  // Index of the group containing the active tab — used to force its
  // collapsed state to "expanded" when active changes.
  const activeGroupIdx = useMemo(
    () => groups.findIndex((g) => g.tabs.some((t) => t.id === active)),
    [groups, active],
  );

  // All groups start expanded. Users can collapse any of them.
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  // When the active tab moves to a different group, ensure that group is
  // expanded — never strand the user with an active tab inside a collapsed
  // section. Don't touch other groups' user-driven state.
  useEffect(() => {
    if (activeGroupIdx < 0) return;
    setCollapsed((prev) => {
      if (!prev[activeGroupIdx]) return prev;
      const next = { ...prev };
      next[activeGroupIdx] = false;
      return next;
    });
  }, [activeGroupIdx]);

  const toggle = (idx: number) =>
    setCollapsed((prev) => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <aside
      style={{
        position: "sticky",
        top: APP_BRAND_BAR,
        height: `calc(100vh - ${APP_BRAND_BAR}px)`,
        width: SIDE_NAV_WIDTH,
        flexShrink: 0,
        borderRight: "1px solid var(--border-light)",
        background: "var(--background)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {label && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "16px 16px 12px",
            borderBottom: "1px solid var(--border-light)",
            flexShrink: 0,
          }}
        >
          <label.icon
            size={14}
            style={{ color: label.iconColor ?? "var(--accent-blue)" }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.005em",
            }}
          >
            {label.text}
          </span>
        </div>
      )}

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "10px 0 16px",
          flex: 1,
          gap: 6,
        }}
      >
        {groups.map((group, idx) => {
          const isOpen = !collapsed[idx];
          return (
            <div key={group.title}>
              <button
                type="button"
                onClick={() => toggle(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "6px 16px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-sans)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <ChevronRight
                  size={11}
                  style={{
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 120ms ease",
                    marginRight: 6,
                    flexShrink: 0,
                  }}
                />
                {group.title}
              </button>

              {isOpen && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginTop: 2,
                  }}
                >
                  {group.tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = active === tab.id;
                    return (
                      <button
                        key={tab.id}
                        data-active={isActive ? "true" : "false"}
                        onClick={() => onSelect(tab.id)}
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          padding: "7px 16px 7px 30px",
                          border: "none",
                          borderLeft: isActive
                            ? "2px solid var(--accent-blue)"
                            : "2px solid transparent",
                          background: isActive
                            ? "var(--accent-blue-bg, rgba(29,78,216,0.06))"
                            : "transparent",
                          cursor: "pointer",
                          fontFamily: "var(--font-sans)",
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                          textAlign: "left",
                          width: "100%",
                          transition:
                            "color 120ms ease, background 120ms ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color = "var(--text-primary)";
                            e.currentTarget.style.background =
                              "rgba(0,0,0,0.025)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color =
                              "var(--text-secondary)";
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        {Icon && (
                          <Icon
                            size={13}
                            style={{
                              color: isActive
                                ? "var(--accent-blue)"
                                : "var(--text-muted)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {trailing && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border-light)",
            fontSize: 11.5,
            lineHeight: 1.5,
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          {trailing}
        </div>
      )}
    </aside>
  );
}
