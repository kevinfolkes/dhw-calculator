"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  MoreHorizontal,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { exportCSV } from "@/lib/export/csv";
import { exportXLSX } from "@/lib/export/excel";
import { exportDOCX, exportPDF } from "@/lib/export/submittal";
import {
  deleteReport,
  exportLibrary,
  importLibrary,
  listReports,
  saveReport,
  updateReport,
  type SavedReport,
} from "@/lib/reports/storage";
import { ENGINE_VERSION } from "@/lib/version";
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";

interface Props {
  inputs: DhwInputs;
  result: CalcResult;
  setInputs: (next: DhwInputs) => void;
}

/**
 * Reports tab — save / load / rename / delete scenarios, export individual
 * reports to PDF / DOCX / Excel / CSV, and back up or restore the entire
 * library as JSON. Backed by `lib/reports/storage` (localStorage).
 */
export function ReportsTab({ inputs, result, setInputs }: Props) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [loadedFlash, setLoadedFlash] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate list once on mount (storage is browser-only).
  useEffect(() => {
    setReports(listReports());
  }, []);

  // Auto-dismiss inline flash messages.
  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(null), 3000);
    return () => clearTimeout(t);
  }, [savedFlash]);
  useEffect(() => {
    if (!loadedFlash) return;
    const t = setTimeout(() => setLoadedFlash(null), 3000);
    return () => clearTimeout(t);
  }, [loadedFlash]);
  useEffect(() => {
    if (!importSummary) return;
    const t = setTimeout(() => setImportSummary(null), 5000);
    return () => clearTimeout(t);
  }, [importSummary]);

  const refresh = () => setReports(listReports());

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveReport(trimmed, inputs, result, notes.trim() ? notes.trim() : undefined);
    setName("");
    setNotes("");
    setSavedFlash(`Saved as "${trimmed}"`);
    refresh();
  };

  const handleLoad = (r: SavedReport) => {
    setInputs(r.inputs);
    setLoadedFlash(`Loaded "${r.name}"`);
  };

  const handleDelete = (r: SavedReport) => {
    if (!window.confirm(`Delete report "${r.name}"?`)) return;
    deleteReport(r.id);
    refresh();
  };

  const handleRename = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    updateReport(id, { name: trimmed });
    refresh();
  };

  const handleExportLibrary = () => {
    if (typeof window === "undefined") return;
    const json = exportLibrary();
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `dhw-reports-${stamp}.json`;
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportPick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!text) {
        setImportSummary("Import failed — empty file");
        return;
      }
      const { imported, skipped } = importLibrary(text, importMode);
      setImportSummary(`Imported ${imported}, skipped ${skipped}`);
      refresh();
    };
    reader.onerror = () => {
      setImportSummary("Import failed — could not read file");
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Intro */}
      <Card accent="var(--accent-blue)">
        <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "var(--text-primary)" }}>
          <strong>Reports</strong> let you save snapshots of the current scenario — inputs and
          frozen calculation results — to your browser. Saved reports can be loaded back, exported
          (PDF / DOCX / Excel / CSV), or compared side-by-side on the next tab. The library is
          stored locally; use the backup card at the bottom to move it between machines.
        </p>
      </Card>

      {/* Save current scenario */}
      <Card>
        <CardHeader>
          <CardTitle>Save current scenario</CardTitle>
        </CardHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="ve-field-label" htmlFor="report-name">Report name</label>
            <input
              id="report-name"
              type="text"
              className="ve-input"
              placeholder="e.g. Baseline gas + 50 gal tanks"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <div>
            <label className="ve-field-label" htmlFor="report-notes">Notes (optional)</label>
            <textarea
              id="report-notes"
              className="ve-input"
              rows={3}
              placeholder="What is this scenario? Any caveats?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontFamily: "var(--font-sans)", resize: "vertical" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="ve-btn"
              onClick={handleSave}
              disabled={name.trim().length === 0}
              style={{
                opacity: name.trim().length === 0 ? 0.5 : 1,
                cursor: name.trim().length === 0 ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Save size={13} />
              Save Report
            </button>
            {savedFlash && (
              <span style={{ fontSize: 12, color: "var(--accent-emerald)", fontWeight: 600 }}>
                {savedFlash}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Saved reports list */}
      <Card>
        <CardHeader>
          <CardTitle>Saved reports ({reports.length})</CardTitle>
        </CardHeader>
        {loadedFlash && (
          <div
            style={{
              fontSize: 12,
              color: "var(--accent-emerald)",
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            {loadedFlash}
          </div>
        )}
        {reports.length === 0 ? (
          <div
            style={{
              padding: "20px 12px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            No saved reports yet. Save your current scenario above to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reports.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                onLoad={() => handleLoad(r)}
                onDelete={() => handleDelete(r)}
                onRename={(newName) => handleRename(r.id, newName)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Library backup (collapsible) */}
      <Card>
        <button
          onClick={() => setBackupOpen((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            textAlign: "left",
          }}
        >
          {backupOpen ? (
            <ChevronDown size={14} color="var(--text-secondary)" />
          ) : (
            <ChevronRight size={14} color="var(--text-secondary)" />
          )}
          <span
            className="ve-section-title"
            style={{ fontSize: 15, margin: 0, borderLeft: "none", paddingLeft: 0 }}
          >
            Library backup
          </span>
        </button>
        {backupOpen && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              Export downloads the entire saved-reports library as JSON. Import reads a previously
              exported file. Choose <em>Merge</em> to add to your current library (skipping id
              collisions) or <em>Replace</em> to overwrite it.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="ve-btn ve-btn-secondary"
                onClick={handleExportLibrary}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={13} />
                Export library
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                Import mode
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="import-mode"
                    value="merge"
                    checked={importMode === "merge"}
                    onChange={() => setImportMode("merge")}
                  />
                  Merge (keep existing)
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="import-mode"
                    value="replace"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                  />
                  Replace (wipe first)
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  className="ve-btn ve-btn-secondary"
                  onClick={handleImportPick}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Upload size={13} />
                  Import library…
                </button>
                {importSummary && (
                  <span style={{ fontSize: 12, color: "var(--accent-emerald)", fontWeight: 600 }}>
                    {importSummary}
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                  e.target.value = ""; // allow re-selecting the same file
                }}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

interface RowProps {
  report: SavedReport;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (next: string) => void;
}

function ReportRow({ report, onLoad, onDelete, onRename }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(report.name);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close the Export menu when clicking outside.
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  // Focus the rename input when entering edit mode.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const sysLabel = SYSTEM_TYPES[report.inputs.systemType]?.label ?? report.inputs.systemType;
  const dateLabel = new Date(report.updatedAt).toLocaleDateString();
  const stale = report.engineVersion !== ENGINE_VERSION;

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== report.name) {
      onRename(trimmed);
    } else {
      setDraft(report.name);
    }
    setEditing(false);
  };

  const cancelRename = () => {
    setDraft(report.name);
    setEditing(false);
  };

  const handleExportPDF = async () => {
    setExportOpen(false);
    try {
      await exportPDF(report.inputs, report.results);
    } catch (e) {
      console.error("[reports] PDF export failed", e);
    }
  };
  const handleExportDOCX = async () => {
    setExportOpen(false);
    try {
      await exportDOCX(report.inputs, report.results);
    } catch (e) {
      console.error("[reports] DOCX export failed", e);
    }
  };
  const handleExportXLSX = async () => {
    setExportOpen(false);
    try {
      await exportXLSX(report.inputs, report.results);
    } catch (e) {
      console.error("[reports] XLSX export failed", e);
    }
  };
  const handleExportCSV = () => {
    setExportOpen(false);
    try {
      exportCSV(report.inputs, report.results);
    } catch (e) {
      console.error("[reports] CSV export failed", e);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--surface-subtle, rgba(0,0,0,0.02))",
        border: "1px solid var(--border-light)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              className="ve-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                else if (e.key === "Escape") cancelRename();
              }}
              style={{ maxWidth: 320, fontFamily: "var(--font-sans)" }}
            />
          ) : (
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={report.name}
            >
              {report.name}
            </span>
          )}
          <VersionBadge version={report.engineVersion} />
          {stale && <StaleChip />}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 11,
            color: "var(--text-muted)",
            flexWrap: "wrap",
          }}
        >
          <span>{sysLabel}</span>
          <span aria-hidden>·</span>
          <span>Saved {dateLabel}</span>
          {report.notes && (
            <>
              <span aria-hidden>·</span>
              <span style={{ fontStyle: "italic" }} title={report.notes}>
                {report.notes.length > 60 ? `${report.notes.slice(0, 60)}…` : report.notes}
              </span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button className="ve-btn ve-btn-secondary" onClick={onLoad} style={{ fontSize: 12, padding: "6px 10px" }}>
          Load
        </button>
        <div ref={exportRef} style={{ position: "relative" }}>
          <button
            className="ve-btn ve-btn-secondary"
            onClick={() => setExportOpen((v) => !v)}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Export
            <ChevronDown size={12} />
          </button>
          {exportOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                minWidth: 160,
                background: "#fff",
                border: "1px solid var(--border-light)",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
                zIndex: 10,
                padding: 4,
              }}
            >
              <ExportMenuItem icon={<FileText size={13} />} label="PDF submittal" onClick={handleExportPDF} />
              <ExportMenuItem icon={<FileType size={13} />} label="DOCX" onClick={handleExportDOCX} />
              <ExportMenuItem icon={<FileSpreadsheet size={13} />} label="Excel (.xlsx)" onClick={handleExportXLSX} />
              <ExportMenuItem icon={<FileSpreadsheet size={13} />} label="CSV" onClick={handleExportCSV} />
            </div>
          )}
        </div>
        <button
          className="ve-btn ve-btn-secondary"
          onClick={() => setEditing(true)}
          style={{ fontSize: 12, padding: "6px 10px" }}
          title="Rename"
        >
          <MoreHorizontal size={13} />
          <span style={{ marginLeft: 4 }}>Rename</span>
        </button>
        <button
          className="ve-btn ve-btn-secondary"
          onClick={onDelete}
          style={{
            fontSize: 12,
            padding: "6px 10px",
            color: "var(--accent-red)",
            borderColor: "var(--accent-red)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function ExportMenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "8px 10px",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 12,
        color: "var(--text-primary)",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--accent-blue-bg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function VersionBadge({ version }: { version: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        background: "var(--accent-blue-bg)",
        color: "var(--accent-blue)",
        letterSpacing: "0.02em",
      }}
    >
      v{version}
    </span>
  );
}

function StaleChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        background: "var(--accent-amber-bg)",
        color: "var(--accent-amber)",
      }}
      title="Saved with an older engine version — frozen results may be outdated"
    >
      Stale (current v{ENGINE_VERSION})
    </span>
  );
}
