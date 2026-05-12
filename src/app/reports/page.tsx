"use client";

/**
 * `/reports` — centralized cross-end-use report library.
 *
 * STUB: the multi-domain rendering layer (per-domain registry that decides
 * how to render each report row + which export template to use) lands in a
 * follow-up phase. Until then, this route explains the temporary path:
 * use the Reports tab inside the DHW calculator for DHW reports.
 */
import Link from "next/link";
import { ClipboardList, ArrowRight } from "lucide-react";

export default function ReportsPage() {
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
            background: "var(--accent-blue-bg)",
            color: "var(--accent-blue)",
          }}
        >
          <ClipboardList size={18} />
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
          Reports library
        </h1>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-secondary)", margin: 0 }}>
        The cross-end-use report library — listing every saved scenario across
        DHW, lighting, RTUs, and other end uses in one place — is being built
        as part of the Phase 1 multi-domain rollout. In the meantime, each
        end-use calculator has its own embedded Reports tab that handles
        save / load / rename / delete / export for that domain&apos;s reports.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "16px 18px",
          background: "var(--accent-blue-bg)",
          borderRadius: 10,
          border: "1px solid var(--border-light)",
          fontSize: 13,
          color: "var(--text-primary)",
        }}
      >
        <strong>Where to find your saved reports today</strong>
        <Link
          href="/dhw"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--accent-blue)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Open the DHW calculator <ArrowRight size={14} />
        </Link>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          → click the <em>Reports</em> tab in the left sidebar.
        </span>
      </div>
    </div>
  );
}
