"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import type { CalcResult } from "@/lib/calc/types";

interface Props {
  result: CalcResult;
  onExportPDF: () => void;
  onExportDOCX: () => void;
  onShareLink: () => void;
}

export function ComplianceTab({ result, onExportPDF, onExportDOCX, onShareLink }: Props) {
  const flags = result.flags;
  const groups = {
    error: flags.filter((f) => f.level === "error"),
    warn: flags.filter((f) => f.level === "warn"),
    info: flags.filter((f) => f.level === "info"),
    ok: flags.filter((f) => f.level === "ok"),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <CardHeader>
          <CardTitle>Submittal Export</CardTitle>
        </CardHeader>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
          Generate MEP-ready deliverables with current inputs, sizing, and
          compliance flags embedded.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="ve-btn" onClick={onExportPDF}>
            Export PDF submittal
          </button>
          <button className="ve-btn ve-btn-secondary" onClick={onExportDOCX}>
            Export DOCX
          </button>
          <button className="ve-btn ve-btn-secondary" onClick={onShareLink}>
            Copy share link
          </button>
        </div>
      </Card>

      {groups.warn.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Warnings ({groups.warn.length})</CardTitle>
          </CardHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groups.warn.map((f, i) => <Flag key={i} flag={f} />)}
          </div>
        </Card>
      )}
      {groups.info.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Informational ({groups.info.length})</CardTitle>
          </CardHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groups.info.map((f, i) => <Flag key={i} flag={f} />)}
          </div>
        </Card>
      )}
      {groups.ok.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Passing checks ({groups.ok.length})</CardTitle>
          </CardHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groups.ok.map((f, i) => <Flag key={i} flag={f} />)}
          </div>
        </Card>
      )}
    </div>
  );
}
