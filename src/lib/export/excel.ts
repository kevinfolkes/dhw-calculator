/**
 * Multi-sheet Excel (.xlsx) export of a DHW scenario, built with ExcelJS.
 *
 * `exceljs` is loaded via dynamic `import()` so the ~500KB minified bundle
 * stays out of the initial page load — users who never export pay no cost.
 * The download is triggered by the same Blob + anchor pattern used by the
 * CSV exporter.
 */
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult, MonthlyRow } from "@/lib/calc/types";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import { ENGINE_VERSION } from "@/lib/version";

// Narrow types for the subset of the ExcelJS API we use, so we can typecheck
// the dynamic-import path without pulling exceljs into the main type graph.
interface ExcelCell {
  value: unknown;
  font?: { bold?: boolean };
  numFmt?: string;
}
interface ExcelRow {
  values: unknown[];
  eachCell: (cb: (cell: ExcelCell) => void) => void;
  font?: { bold?: boolean };
}
interface ExcelColumn {
  header?: string;
  key?: string;
  width?: number;
  numFmt?: string;
}
interface ExcelWorksheet {
  columns: ExcelColumn[];
  addRow: (row: unknown[] | Record<string, unknown>) => ExcelRow;
  getRow: (n: number) => ExcelRow;
  getColumn: (k: number | string) => { numFmt?: string; width?: number };
}
interface ExcelWorkbook {
  addWorksheet: (name: string) => ExcelWorksheet;
  xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
}
interface ExcelJSModule {
  Workbook: new () => ExcelWorkbook;
}

/**
 * Build a multi-sheet workbook for the scenario and trigger a browser
 * download. SSR-safe: no-op when `window` is unavailable.
 */
export async function exportXLSX(
  inputs: DhwInputs,
  result: CalcResult,
  filename?: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const mod = (await import("exceljs")) as unknown as { default?: ExcelJSModule } & ExcelJSModule;
  const ExcelJS: ExcelJSModule = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();

  buildSummarySheet(wb, inputs, result);
  buildInputsSheet(wb, inputs);
  buildSizingSheet(wb, result);
  buildMonthlyEnergySheet(wb, result);
  buildAutoSizeSheet(wb, inputs, result);
  buildComplianceSheet(wb, result);

  const buf = await wb.xlsx.writeBuffer();
  const fname = filename ?? defaultFilename(inputs);
  triggerDownload(buf, fname);
}

function defaultFilename(inputs: DhwInputs): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `dhw-report-${inputs.systemType}-${stamp}.xlsx`;
}

/** Apply bold font to the first row of a worksheet. */
function boldHeader(ws: ExcelWorksheet): void {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.font = { bold: true };
  });
}

function buildSummarySheet(wb: ExcelWorkbook, inputs: DhwInputs, r: CalcResult): void {
  const ws = wb.addWorksheet("Summary");
  ws.columns = [
    { header: "Field", key: "field", width: 32 },
    { header: "Value", key: "value", width: 30 },
  ];
  const sys = SYSTEM_TYPES[inputs.systemType];
  const annualKWh = r.annualHPWHKWh_total + r.annualResistanceKWh;
  const annualCost = r.annualGasCost + r.annualHPWHCost + r.annualResistanceCost;
  const a = r.autoSize;
  const capex = a?.recommended?.capCost ?? 0;
  const lifecycle = a?.lifecycle?.total15 ?? a?.recommended?.total15 ?? 0;

  ws.addRow({ field: "Report name", value: `DHW ${sys.label}` });
  ws.addRow({ field: "System type", value: sys.label });
  ws.addRow({ field: "System type key", value: inputs.systemType });
  ws.addRow({ field: "Engine version", value: ENGINE_VERSION });
  ws.addRow({ field: "Generated", value: new Date().toISOString() });
  ws.addRow({ field: "Peak hour demand (GPH)", value: round(r.peakHourDemand) });
  ws.addRow({ field: "Storage (gal, usable)", value: round(r.storageVolGal) });
  ws.addRow({ field: "Recovery (GPH)", value: round(r.recoveryGPH) });
  ws.addRow({ field: "Annual gas (therms)", value: round(r.annualGasTherms) });
  ws.addRow({ field: "Annual electric (kWh)", value: round(annualKWh) });
  ws.addRow({ field: "Annual cost (USD)", value: round(annualCost, 2) });
  ws.addRow({ field: "Capex (USD)", value: round(capex, 2) });
  ws.addRow({ field: "15-yr lifecycle (USD)", value: round(lifecycle, 2) });
  boldHeader(ws);
}

function buildInputsSheet(wb: ExcelWorkbook, inputs: DhwInputs): void {
  const ws = wb.addWorksheet("Inputs");
  ws.columns = [
    { header: "Label", key: "label", width: 42 },
    { header: "Value", key: "value", width: 28 },
  ];
  const rows: [string, unknown][] = [
    ["System type", SYSTEM_TYPES[inputs.systemType].label],
    ["Studio units (count)", inputs.unitsStudio],
    ["1BR units (count)", inputs.units1BR],
    ["2BR units (count)", inputs.units2BR],
    ["3BR units (count)", inputs.units3BR],
    ["Occupancy profile", inputs.occupancyProfile],
    ["Occupants per unit, 0BR", inputs.occupantsPerUnit.br0],
    ["Occupants per unit, 1BR", inputs.occupantsPerUnit.br1],
    ["Occupants per unit, 2BR", inputs.occupantsPerUnit.br2],
    ["Occupants per unit, 3BR", inputs.occupantsPerUnit.br3],
    ["GPCD (gal/person/day)", inputs.gpcd],
    ["Avg sqft 0BR (sqft)", inputs.avgUnitSqft.br0],
    ["Avg sqft 1BR (sqft)", inputs.avgUnitSqft.br1],
    ["Avg sqft 2BR (sqft)", inputs.avgUnitSqft.br2],
    ["Avg sqft 3BR (sqft)", inputs.avgUnitSqft.br3],
    ["Climate zone", inputs.climateZone],
    ["Indoor design (F)", inputs.indoorDesignF],
    ["Inlet water (F)", inputs.inletWaterF ?? "auto"],
    ["Storage setpoint (F)", inputs.storageSetpointF],
    ["Delivery temp (F)", inputs.deliveryF],
    ["Demand method", inputs.demandMethod],
    ["Recirc loop length (ft)", inputs.recircLoopLengthFt],
    ["Pipe insulation (R-value)", inputs.pipeInsulationR],
    ["Recirc return temp (F)", inputs.recircReturnTempF],
    ["Ambient pipe temp (F)", inputs.ambientPipeF],
    ["Gas efficiency (fraction)", inputs.gasEfficiency],
    ["HPWH refrigerant", inputs.hpwhRefrigerant],
    ["HPWH ambient (F)", inputs.hpwhAmbientF ?? "auto"],
    ["HPWH tier", inputs.hpwhTier],
    ["Swing tank enabled", inputs.swingTankEnabled],
    ["Combi tank size (gal)", inputs.combiTankSize],
    ["Fan-coil supply (F)", inputs.fanCoilSupplyF],
    ["Buffer tank enabled", inputs.bufferTankEnabled],
    ["Combi DHW setpoint (F)", inputs.combiDHWSetpointF],
    ["HPWH operating limit (F)", inputs.hpwhOpLimitF],
    ["Ventilation load per unit (BTU/hr)", inputs.ventilationLoadPerUnit],
    ["Gas tank size (gal)", inputs.gasTankSize],
    ["Gas tank type", inputs.gasTankType],
    ["Gas tank setpoint (F)", inputs.gasTankSetpointF],
    ["Gas tankless input (kBTU/hr)", inputs.gasTanklessInput],
    ["Tankless design rise (F)", inputs.tanklessDesignRiseF],
    ["Tankless simultaneous fixtures (count)", inputs.tanklessSimultaneousFixtures],
    ["Gas tankless setpoint (F)", inputs.gasTanklessSetpointF],
    ["Electric rate (USD/kWh)", inputs.elecRate],
    ["Gas rate (USD/therm)", inputs.gasRate],
    ["Grid subregion", inputs.gridSubregion],
    ["Custom EF", inputs.customEF],
    ["Envelope preset", inputs.envelopePreset],
    ["Lavatory GPM", inputs.fixtureGPM.lavatory],
    ["Kitchen GPM", inputs.fixtureGPM.kitchen],
    ["Shower GPM", inputs.fixtureGPM.shower],
    ["Tub GPM", inputs.fixtureGPM.tub],
    ["Dishwasher GPM", inputs.fixtureGPM.dishwasher],
    ["Washer GPM", inputs.fixtureGPM.washer],
  ];
  for (const [label, value] of rows) {
    ws.addRow({ label, value });
  }
  boldHeader(ws);
}

function buildSizingSheet(wb: ExcelWorkbook, r: CalcResult): void {
  const ws = wb.addWorksheet("Sizing");
  ws.columns = [
    { header: "Metric", key: "metric", width: 36 },
    { header: "Value", key: "value", width: 18 },
    { header: "Unit", key: "unit", width: 12 },
  ];
  const rows: [string, number, string][] = [
    ["Total units", r.totalUnits, "count"],
    ["Total occupants", r.totalOccupants, "count"],
    ["ASHRAE peak hour", round(r.demandASHRAE_MH), "GPH"],
    ["Hunter peak", round(r.demandHunter_MH), "GPH"],
    ["Occupancy peak", round(r.demandOccupancy_MH), "GPH"],
    ["Peak hour demand", round(r.peakHourDemand), "GPH"],
    ["Peak day demand", round(r.peakDayDemand), "GPH"],
    ["Avg day demand", round(r.avgDayDemand), "GPH"],
    ["Peak instantaneous", round(r.peakInstantGPM, 2), "GPM"],
    ["Storage volume (usable)", round(r.storageVolGal), "gal"],
    ["Storage volume (nominal)", round(r.storageVolGal_nominal), "gal"],
    ["Tempered capacity", round(r.temperedCapacityGal), "gal"],
    ["Recovery", round(r.recoveryGPH), "GPH"],
    ["Recovery", round(r.recoveryBTUH), "BTU/hr"],
    ["Recovery", round(r.recoveryKW, 2), "kW"],
    ["First-hour rating (combi)", round(r.combi.fhr), "GPH"],
    ["Recirc loss", round(r.recircLossBTUH), "BTU/hr"],
    ["Total design load", round(r.totalBTUH), "BTU/hr"],
    ["Total design load", round(r.totalKW, 2), "kW"],
    ["Gas input", round(r.gasInputBTUH), "BTU/hr"],
    ["HPWH nameplate", round(r.hpwhNameplateKW, 2), "kW"],
    ["Annual COP", round(r.annualCOP, 3), ""],
  ];
  for (const [metric, value, unit] of rows) {
    ws.addRow({ metric, value, unit });
  }
  ws.getColumn(2).numFmt = "#,##0.00";
  boldHeader(ws);
}

function buildMonthlyEnergySheet(wb: ExcelWorkbook, r: CalcResult): void {
  const ws = wb.addWorksheet("Monthly Energy");
  ws.columns = [
    { header: "Month", key: "month", width: 14 },
    { header: "Ambient (F)", key: "ambient", width: 12 },
    { header: "Inlet (F)", key: "inlet", width: 12 },
    { header: "COP / UEF", key: "cop", width: 12 },
    { header: "Demand (BTU)", key: "demand", width: 16 },
    { header: "Recirc loss (BTU)", key: "recirc", width: 18 },
    { header: "Gas (therms)", key: "therms", width: 14 },
    { header: "Electric (kWh)", key: "kwh", width: 14 },
    { header: "Cost (USD)", key: "cost", width: 14 },
    { header: "CO2 (lb)", key: "co2", width: 14 },
  ];
  const monthly: MonthlyRow[] = r.monthly?.monthly ?? [];
  for (const m of monthly) {
    const isTherms = m.unit === "therms";
    const therms = isTherms ? round(m.totalEnergy, 2) : 0;
    const kwh = !isTherms ? round(m.totalEnergy, 2) : 0;
    const recircBTU = round(r.recircLossBTUH * 24 * m.daysInMonth);
    ws.addRow({
      month: m.month,
      ambient: round(m.monthAmbient, 1),
      inlet: round(m.monthInlet, 1),
      cop: round(m.monthCOP_dhw, 3),
      demand: round(m.dhwEnergy, 0),
      recirc: recircBTU,
      therms,
      kwh,
      cost: round(m.totalCost, 2),
      co2: round(m.totalCarbon, 1),
    });
  }
  ws.getColumn("therms").numFmt = "#,##0.00";
  ws.getColumn("kwh").numFmt = "#,##0.00";
  ws.getColumn("demand").numFmt = "#,##0";
  ws.getColumn("recirc").numFmt = "#,##0";
  ws.getColumn("cost").numFmt = '"$"#,##0.00';
  ws.getColumn("co2").numFmt = "#,##0.00";
  boldHeader(ws);
}

function buildAutoSizeSheet(wb: ExcelWorkbook, inputs: DhwInputs, r: CalcResult): void {
  const ws = wb.addWorksheet("Auto-Size");
  ws.columns = [
    { header: "Variant", key: "variant", width: 16 },
    { header: "Cap", key: "cap", width: 18 },
    { header: "Cap Cost (USD)", key: "capCost", width: 16 },
    { header: "Annual Cost (USD)", key: "annCost", width: 18 },
    { header: "15-yr Lifecycle (USD)", key: "total15", width: 22 },
    { header: "System type", key: "systemType", width: 24 },
  ];
  const a = r.autoSize;
  const variants = ["minimum", "recommended", "lifecycle"] as const;
  for (const variant of variants) {
    const rec = a?.[variant];
    if (!rec) {
      ws.addRow({ variant, systemType: inputs.systemType });
      continue;
    }
    ws.addRow({
      variant,
      cap: formatCap(rec),
      capCost: round(rec.capCost, 2),
      annCost: round(rec.annCost, 2),
      total15: rec.total15 !== undefined ? round(rec.total15, 2) : null,
      systemType: a?.system ?? inputs.systemType,
    });
  }
  ws.getColumn("capCost").numFmt = '"$"#,##0.00';
  ws.getColumn("annCost").numFmt = '"$"#,##0.00';
  ws.getColumn("total15").numFmt = '"$"#,##0.00';
  boldHeader(ws);
}

function buildComplianceSheet(wb: ExcelWorkbook, r: CalcResult): void {
  const ws = wb.addWorksheet("Compliance");
  ws.columns = [
    { header: "Level", key: "level", width: 10 },
    { header: "Code", key: "code", width: 24 },
    { header: "Message", key: "msg", width: 80 },
  ];
  for (const f of r.flags) {
    ws.addRow({ level: f.level, code: f.code, msg: f.msg });
  }
  boldHeader(ws);
}

function formatCap(rec: { [k: string]: unknown }): string | number {
  const cap = rec.cap ?? rec.capacity ?? rec.size ?? rec.kBTU ?? rec.gal;
  if (cap === null || cap === undefined) return "";
  if (typeof cap === "number") return round(cap, 2);
  return String(cap);
}

function round(n: number, digits = 0): number {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function triggerDownload(buf: ArrayBuffer, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
