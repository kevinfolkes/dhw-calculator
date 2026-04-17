/**
 * Submittal export — PDF (jsPDF + autoTable) and DOCX (docx). Both formats
 * include the full input snapshot, key sizing outputs, auto-size
 * recommendations, and compliance flags so the file can stand alone as a
 * design-review deliverable.
 */
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult, ComplianceFlag } from "@/lib/calc/types";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";

const HEADING = "Multifamily DHW Sizing — Submittal Package";

interface Row { label: string; value: string }

export async function exportPDF(inputs: DhwInputs, result: CalcResult): Promise<void> {
  const { jsPDF } = await import("jspdf");
  type JsPDFDoc = InstanceType<typeof jsPDF>;
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = (autoTableMod as unknown as { default: (doc: JsPDFDoc, opts: object) => void }).default
    ?? (autoTableMod as unknown as (doc: JsPDFDoc, opts: object) => void);

  const doc: JsPDFDoc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(HEADING, 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`System: ${SYSTEM_TYPES[inputs.systemType].label}`, 40, 70);
  doc.text(`Generated: ${new Date().toLocaleString("en-US")}`, 40, 84);

  const inputRows = buildInputRows(inputs);
  autoTable(doc, {
    startY: 100,
    head: [["Input", "Value"]],
    body: inputRows.map((r) => [r.label, r.value]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 30, 64] },
    theme: "grid",
  });

  const sizingRows = buildSizingRows(result);
  autoTable(doc, {
    head: [["Output", "Value"]],
    body: sizingRows.map((r) => [r.label, r.value]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [29, 78, 216] },
    theme: "grid",
  });

  const flagRows = buildFlagRows(result.flags);
  autoTable(doc, {
    head: [["Level", "Code", "Note"]],
    body: flagRows,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [124, 58, 237] },
    theme: "grid",
  });

  doc.save(submittalFilename("pdf"));
}

export async function exportDOCX(inputs: DhwInputs, result: CalcResult): Promise<void> {
  const docxMod = await import("docx");
  const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = docxMod;

  const mkTable = (head: string[], rows: string[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: head.map(
            (h) =>
              new TableCell({
                children: [new Paragraph({ text: h, alignment: AlignmentType.LEFT })],
                shading: { fill: "0F1E40" },
              }),
          ),
        }),
        ...rows.map(
          (r) =>
            new TableRow({
              children: r.map((c) => new TableCell({ children: [new Paragraph(c)] })),
            }),
        ),
      ],
    });

  const inputRows = buildInputRows(inputs).map((r) => [r.label, r.value]);
  const sizingRows = buildSizingRows(result).map((r) => [r.label, r.value]);
  const flagRows = buildFlagRows(result.flags);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ text: HEADING, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `System: ${SYSTEM_TYPES[inputs.systemType].label}` }),
          new Paragraph({ text: `Generated: ${new Date().toLocaleString("en-US")}` }),
          new Paragraph({ text: "Inputs", heading: HeadingLevel.HEADING_2 }),
          mkTable(["Input", "Value"], inputRows),
          new Paragraph({ text: "Sizing & Energy", heading: HeadingLevel.HEADING_2 }),
          mkTable(["Output", "Value"], sizingRows),
          new Paragraph({ text: "Compliance Flags", heading: HeadingLevel.HEADING_2 }),
          mkTable(["Level", "Code", "Note"], flagRows),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const saveAs = (await import("file-saver")).default.saveAs;
  saveAs(blob, submittalFilename("docx"));
}

function submittalFilename(ext: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `dhw-submittal-${stamp}.${ext}`;
}

function buildInputRows(i: DhwInputs): Row[] {
  const sys = SYSTEM_TYPES[i.systemType];
  return [
    { label: "System type", value: sys.label },
    {
      label: "Unit mix",
      value:
        (i.unitsStudio > 0 ? `${i.unitsStudio}×Studio / ` : "") +
        `${i.units1BR}×1BR / ${i.units2BR}×2BR / ${i.units3BR}×3BR`,
    },
    { label: "Occupancy profile", value: i.occupancyProfile },
    { label: "Climate zone", value: i.climateZone },
    { label: "Inlet / storage / delivery", value: `${i.inletWaterF}°F / ${i.storageSetpointF}°F / ${i.deliveryF}°F` },
    { label: "Demand method", value: i.demandMethod },
    ...(sys.hasRecirc
      ? [
          { label: "Recirc loop", value: `${i.recircLoopLengthFt} ft, R-${i.pipeInsulationR}` },
          { label: "Return / ambient", value: `${i.recircReturnTempF}°F / ${i.ambientPipeF}°F` },
        ]
      : []),
    { label: "Gas efficiency", value: `${(i.gasEfficiency * 100).toFixed(0)}%` },
    { label: "HPWH refrigerant", value: i.hpwhRefrigerant },
    { label: "Electric rate", value: `$${i.elecRate}/kWh` },
    { label: "Gas rate", value: `$${i.gasRate}/therm` },
    { label: "Grid subregion", value: i.gridSubregion },
  ];
}

function buildSizingRows(r: CalcResult): Row[] {
  const rows: Row[] = [
    { label: "Total units", value: String(r.totalUnits) },
    { label: "Peak hour demand", value: `${Math.round(r.peakHourDemand)} GPH` },
    { label: "Peak day demand", value: `${Math.round(r.peakDayDemand)} GPH` },
    { label: "Avg daily demand", value: `${Math.round(r.avgDayDemand)} GPH` },
    { label: "Storage volume", value: `${Math.round(r.storageVolGal)} gal usable / ${Math.round(r.storageVolGal_nominal)} gal nominal` },
    { label: "Tempered capacity", value: `${Math.round(r.temperedCapacityGal)} gal` },
    { label: "Recovery", value: `${Math.round(r.recoveryGPH)} GPH @ ${Math.round(r.temperatureRise)}°F rise = ${Math.round(r.recoveryBTUH).toLocaleString()} BTU/hr` },
    { label: "Recirc loss", value: `${Math.round(r.recircLossBTUH).toLocaleString()} BTU/hr` },
    { label: "Total design load", value: `${Math.round(r.totalBTUH).toLocaleString()} BTU/hr (${r.totalKW.toFixed(1)} kW)` },
    { label: "Gas input (if applicable)", value: `${Math.round(r.gasInputBTUH / 1000)} MBH` },
    { label: "HPWH nameplate (if applicable)", value: `${r.hpwhNameplateKW.toFixed(1)} kW, COP ${r.cop.toFixed(2)}` },
    { label: "Annual gas", value: `${Math.round(r.annualGasTherms).toLocaleString()} therms / $${Math.round(r.annualGasCost).toLocaleString()}` },
    { label: "Annual HPWH", value: `${Math.round(r.annualHPWHKWh_total).toLocaleString()} kWh / $${Math.round(r.annualHPWHCost).toLocaleString()}` },
    { label: "Annual carbon (HPWH)", value: `${Math.round(r.annualHPWHCarbon).toLocaleString()} lb CO₂e` },
  ];
  const a = r.autoSize;
  if (a?.recommended) {
    rows.push({ label: "Auto-size recommended", value: JSON.stringify(a.recommended) });
  }
  if (a?.lifecycle) {
    rows.push({ label: "Auto-size lifecycle optimal", value: JSON.stringify(a.lifecycle) });
  }
  return rows;
}

function buildFlagRows(flags: ComplianceFlag[]): string[][] {
  return flags.map((f) => [f.level.toUpperCase(), f.code, f.msg]);
}
