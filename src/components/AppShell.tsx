"use client";

/**
 * App-level shell that wraps every calculator route. Hosts:
 *   - The fixed top brand bar (across all calculators)
 *   - The hamburger trigger that opens the cross-calculator picker drawer
 *   - The active route's content (each calculator renders inside the shell)
 *
 * The shell does NOT replace each calculator's INTERNAL tab nav — DHW still
 * has its 232px navy sidebar with internal tabs, and future calculators
 * follow the same pattern. The shell just adds a layer on top so the user
 * can switch BETWEEN calculators.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ ☰  Multifamily Building Energy Calculator        [reports]  │  ← brand bar (this file)
 * ├─────────────────────────────────────────────────────────────┤
 * │ [DHW         ] │                                            │  ← per-calculator
 * │ [tab nav     ] │   active calculator's main content         │     internal nav lives
 * │ [...         ] │                                            │     in the route, not
 * └─────────────────────────────────────────────────────────────┘     here.
 *
 * Clicking ☰ opens a slide-in drawer with the calculator picker
 * (DHW / Lighting / RTUs / Boilers & chillers / Reports / Compare).
 */
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { CalculatorPicker } from "./CalculatorPicker";

const BRAND_BAR_HEIGHT = 48;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on Escape and when route changes (route changes naturally
  // unmount the page underneath, but the shell persists across navigations
  // within a single client session — closing on link click keeps the UI
  // tidy).
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <>
      {/* ─── Fixed top brand bar ─────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          height: BRAND_BAR_HEIGHT,
          background: "var(--topbar-bg)",
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 24px",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <button
          aria-label={drawerOpen ? "Close calculator picker" : "Open calculator picker"}
          onClick={() => setDrawerOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "1px solid transparent",
            background: drawerOpen ? "var(--surface-subtle)" : "transparent",
            color: "var(--text-primary)",
            cursor: "pointer",
            transition: "background 120ms ease, border-color 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-subtle)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = drawerOpen
              ? "var(--surface-subtle)"
              : "transparent";
          }}
        >
          <Menu size={18} />
        </button>

        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          Multifamily Building Energy Calculator
        </div>

        {/* Right side reserved for future quick links (project switcher,
            reports / compare shortcuts) — kept empty for now to avoid
            churning the header design. */}
        <div style={{ marginLeft: "auto" }} />
      </header>

      {/* ─── Slide-in drawer (calculator picker) ─────────────────────── */}
      {drawerOpen && (
        <>
          <div
            // Backdrop captures clicks outside the drawer
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              top: BRAND_BAR_HEIGHT,
              background: "rgba(15, 15, 15, 0.32)",
              zIndex: 25,
              animation: "fade-in 120ms ease",
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: BRAND_BAR_HEIGHT,
              left: 0,
              bottom: 0,
              width: 320,
              maxWidth: "85vw",
              background: "var(--surface-subtle)",
              color: "var(--text-primary)",
              padding: "20px 18px",
              overflowY: "auto",
              zIndex: 26,
              borderRight: "1px solid var(--border-light)",
              boxShadow: "8px 0 24px rgba(15, 31, 54, 0.06)",
              animation: "slide-in 200ms ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                }}
              >
                Calculators
              </div>
              <button
                aria-label="Close"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <CalculatorPicker onPick={() => setDrawerOpen(false)} />
          </aside>
        </>
      )}

      {/* ─── Active route content ────────────────────────────────────── */}
      <div style={{ minHeight: `calc(100vh - ${BRAND_BAR_HEIGHT}px)` }}>{children}</div>

      {/* Tiny inline keyframes (one-off; not worth a new globals entry) */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slide-in {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
