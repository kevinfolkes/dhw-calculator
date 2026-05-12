"use client";

/**
 * `/compare` — centralized cross-end-use scenario comparison.
 *
 * STUB: the multi-domain compare view (which lets you put a DHW retrofit
 * next to a lighting retrofit, or compare scenarios across calculators)
 * lands in a follow-up phase. Until then, this route explains the
 * temporary path: use the Compare tab inside the DHW calculator for
 * DHW-vs-DHW comparisons.
 */
import Link from "next/link";
import { GitCompare, ArrowRight } from "lucide-react";

export default function ComparePage() {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--accent-violet-bg)",
            color: "var(--accent-violet)",
          }}
        >
          <GitCompare size={18} />
        </span>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            margin: 0,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          Compare scenarios
        </h1>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-secondary)", margin: 0 }}>
        Cross-end-use comparison — picking a DHW retrofit alongside a lighting
        retrofit, for example — is being built as part of the Phase 1
        multi-domain rollout. In the meantime, each end-use calculator&apos;s
        embedded Compare tab handles same-domain comparisons (e.g., compare 2-4
        DHW scenarios with a Δ column).
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "16px 18px",
          background: "var(--accent-violet-bg)",
          borderRadius: 10,
          border: "1px solid var(--border-light)",
          fontSize: 13,
          color: "var(--text-primary)",
        }}
      >
        <strong>Where to compare scenarios today</strong>
        <Link
          href="/dhw"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--accent-violet)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Open the DHW calculator <ArrowRight size={14} />
        </Link>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          → click the <em>Compare</em> tab in the left sidebar.
        </span>
      </div>
    </div>
  );
}
