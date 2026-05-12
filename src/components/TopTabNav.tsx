"use client";

/**
 * Horizontal scrollable tab nav that sits below the AppShell brand bar
 * within each calculator. Replaces the previous 232px persistent left
 * sidebar — the structural change that makes the layout feel like a
 * different app rather than the same dashboard with a paint job.
 *
 * Pattern: a small per-calculator label on the left, then a horizontal
 * row of tabs with an active underline. Sticky just below the global
 * brand bar so users keep their navigation anchored as they scroll the
 * (now full-width) main content.
 *
 * Overflow handling: when the tab row is wider than its container (e.g.,
 * the DHW calculator with 13 tabs on a typical 1100–1400px viewport), the
 * row scrolls horizontally. The native scrollbar is suppressed for visual
 * cleanliness, but we surface overflow with three affordances:
 *   1. Fade gradients on each end of the visible region (decorative cue).
 *   2. ◀ ▶ chevron buttons that scroll by ~70% of the visible width per
 *      click (clear, clickable navigation for users who don't realize they
 *      can two-finger scroll horizontally).
 *   3. Active tab auto-scrolls into view when `active` changes — so users
 *      navigating programmatically (URL change, smart preset, etc.) never
 *      end up with an active tab they can't see.
 *
 * Accessibility: each tab is a real `<button>` with proper roles. The
 * scroll container only horizontally overflows; on narrow viewports the
 * row scrolls horizontally rather than wrapping (Linear / Stripe Docs
 * convention — keeps the visual line clean).
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

const APP_BRAND_BAR = 48;

export interface TopTab<TId extends string = string> {
  id: TId;
  label: string;
  icon?: LucideIcon;
}

interface Props<TId extends string> {
  /** Calculator-level identity rendered left of the tabs (small icon +
   *  label). Optional — pass null to render tabs alone. */
  label?: { icon: LucideIcon; text: string; iconColor?: string };
  tabs: ReadonlyArray<TopTab<TId>>;
  active: TId;
  onSelect: (id: TId) => void;
  /** Optional right-side slot for status / config indicator (e.g.,
   *  "60 units · 140 occ"). Renders to the right of the tabs row. */
  trailing?: React.ReactNode;
}

export function TopTabNav<TId extends string>({
  label,
  tabs,
  active,
  onSelect,
  trailing,
}: Props<TId>) {
  const navRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    hasOverflow: false,
    atStart: true,
    atEnd: true,
  });

  // Track scroll position + overflow status. Recomputes on scroll, on
  // container resize (ResizeObserver), and when the tab list changes
  // length (different topology, etc.). Fades + chevrons render
  // conditionally based on this state.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => {
      const overflow = nav.scrollWidth > nav.clientWidth + 1;
      const atStart = nav.scrollLeft <= 1;
      const atEnd = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 1;
      setScrollState({ hasOverflow: overflow, atStart, atEnd });
    };
    update();
    nav.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => {
      nav.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [tabs.length]);

  // Scroll the active tab into view whenever it changes — so navigating
  // programmatically (e.g., a parent component setActive after a smart
  // preset, URL hash, or stale-tab reset) doesn't strand the user with an
  // active tab off-screen. `inline: "nearest"` is gentler than "center" —
  // only scrolls if the tab is partially or fully out of view.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeBtn = nav.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({
        inline: "nearest",
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [active]);

  const scrollByAmount = (delta: number) => {
    const nav = navRef.current;
    if (!nav) return;
    nav.scrollBy({ left: delta, behavior: "smooth" });
  };

  const scrollLeft = () => {
    const w = navRef.current?.clientWidth ?? 400;
    scrollByAmount(-Math.max(200, w * 0.7));
  };
  const scrollRight = () => {
    const w = navRef.current?.clientWidth ?? 400;
    scrollByAmount(Math.max(200, w * 0.7));
  };

  return (
    <div
      style={{
        position: "sticky",
        top: APP_BRAND_BAR,
        zIndex: 20,
        background: "var(--background)",
        borderBottom: "1px solid var(--border-light)",
        backdropFilter: "saturate(180%) blur(8px)",
        WebkitBackdropFilter: "saturate(180%) blur(8px)",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "stretch",
          gap: 24,
        }}
      >
        {label && <CalculatorLabel {...label} />}

        {/* Chevron + nav + fade assembly. Chevrons hug the nav directly
            (no inter-element gap) so the affordance reads as part of the
            tab row, not as separate controls floating beside it. */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            flex: 1,
            minWidth: 0,
          }}
        >
          {scrollState.hasOverflow && (
            <ChevronButton
              direction="left"
              disabled={scrollState.atStart}
              onClick={scrollLeft}
            />
          )}

          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <nav
              ref={navRef}
              style={{
                display: "flex",
                alignItems: "stretch",
                overflowX: "auto",
                // Kill the native scrollbar on this nav so the tab row
                // stays visually clean — users get chevrons + fade
                // overlays + native two-finger scroll instead.
                scrollbarWidth: "none",
              }}
            >
              {tabs.map((tab) => {
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
                      gap: 7,
                      padding: "14px 14px 13px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      whiteSpace: "nowrap",
                      transition: "color 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                  >
                    {Icon && (
                      <Icon
                        size={14}
                        style={{
                          color: isActive ? "var(--accent-blue)" : "var(--text-muted)",
                        }}
                      />
                    )}
                    {tab.label}
                    {/* Active underline — sits flush with the parent's
                        border-bottom so it overlaps it cleanly. */}
                    {isActive && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          bottom: -1,
                          left: 12,
                          right: 12,
                          height: 2,
                          background: "var(--accent-blue)",
                          borderRadius: "2px 2px 0 0",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Fade overlays — decorative cue that more content is hidden.
                Only render on the side(s) where there's actually scrollable
                content. Pointer events disabled so they don't intercept
                clicks on tabs underneath. */}
            {scrollState.hasOverflow && !scrollState.atStart && (
              <FadeOverlay side="left" />
            )}
            {scrollState.hasOverflow && !scrollState.atEnd && (
              <FadeOverlay side="right" />
            )}
          </div>

          {scrollState.hasOverflow && (
            <ChevronButton
              direction="right"
              disabled={scrollState.atEnd}
              onClick={scrollRight}
            />
          )}
        </div>

        {trailing && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--text-secondary)",
              flexShrink: 0,
            }}
          >
            {trailing}
          </div>
        )}
      </div>
    </div>
  );
}

function CalculatorLabel({
  icon: Icon,
  text,
  iconColor,
}: {
  icon: LucideIcon;
  text: string;
  iconColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        paddingRight: 20,
        marginRight: 4,
        borderRight: "1px solid var(--border-light)",
        flexShrink: 0,
      }}
    >
      <Icon size={14} style={{ color: iconColor ?? "var(--accent-blue)" }} />
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.005em",
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** Subtle gradient overlay on one side of the nav — visual cue that more
 *  tabs are hidden beyond this edge. Width is intentionally small (~24px)
 *  so it doesn't significantly obscure the tab labels at the boundary. */
function FadeOverlay({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 24,
        pointerEvents: "none",
        background:
          side === "left"
            ? "linear-gradient(to right, var(--background), rgba(255,255,255,0))"
            : "linear-gradient(to left, var(--background), rgba(255,255,255,0))",
      }}
    />
  );
}

/** Scroll-affordance chevron button. Renders only when the nav is overflowing.
 *  Disabled (faded + non-interactive) when at the corresponding scroll
 *  boundary, but still occupies the slot to avoid layout shift as the user
 *  scrolls back and forth. Hugs the nav with no flex gap — reads as part of
 *  the tab row rather than a separate control. */
function ChevronButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  const label = direction === "left" ? "Scroll tabs left" : "Scroll tabs right";
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        border: "none",
        background: "transparent",
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
        opacity: disabled ? 0.35 : 1,
        flexShrink: 0,
        transition: "color 120ms ease, opacity 120ms ease",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.color = "var(--text-secondary)";
      }}
    >
      <Icon size={16} />
    </button>
  );
}
