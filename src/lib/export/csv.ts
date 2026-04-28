/**
 * CSV export of a DHW scenario. Produces a single .csv file with several
 * blank-line-separated sections (metadata, inputs, demand, sizing, energy,
 * equipment, auto-size, compliance) so a reviewer can open it in Excel /
 * Google Sheets and see the whole report at a glance.
 *
 * Trigger pattern follows the Blob + anchor idiom used by the existing PDF
 * export in `src/lib/export/submittal.ts`.
 */
import type { DhwInputs } from "@/lib/calc/inputs";
import type { CalcResult } from "@/lib/calc/types";
import { SYSTEM_TYPES } from "@/lib/engineering/system-types";
import { ENGINE_VERSION } from "@/lib/version";

type Cell = string | number | null | undefined;
type Row = Cell[];

/**
 * Build a CSV string for the scenario and trigger a browser download.
 * SSR-safe: no-op when `window` is unavailable.
 */
export function exportCSV(inputs: DhwInputs, result: CalcResult, filename?: string): void {
  const csv = buildCSV(inputs, result);
  const fname = filename ?? defaultFilename(inputs);
  triggerDownload(csv, fname);
}

/** Default filename: `dhw-report-{systemType}-{YYYY-MM-DD}.csv`. */
function defaultFilename(inputs: DhwInputs): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `dhw-report-${inputs.systemType}-${stamp}.csv`;
}

/** Compose all sections into a single CSV string. */
function buildCSV(inputs: DhwInputs, result: CalcResult): string {
  const sys = SYSTEM_TYPES[inputs.systemType];
  const sections: Row[][] = [
    metadataSection(inputs, sys.label),
    buildingSection(inputs),
    demandSection(inputs, result),
    sizingSection(result),
    annualEnergySection(result),
    equipmentSection(inputs, result),
    autoSizeSection(result),
    complianceSection(result),
  ];
  return sections
    .map((rows) => rows.map(serializeRow).join("\n"))
    .join("\n\n");
}

function metadataSection(inputs: DhwInputs, sysLabel: string): Row[] {
  return [
    ["Section", "Metadata"],
    ["Field", "Value"],
    ["Report name", `DHW ${sysLabel}`],
    ["System type", sysLabel],
    ["System type key", inputs.systemType],
    ["Engine version", ENGINE_VERSION],
    ["Generated", new Date().toISOString()],
    ["Climate zone", inputs.climateZone],
  ];
}

function buildingSection(inputs: DhwInputs): Row[] {
  return [
    ["Section", "Building Inputs"],
    ["Field", "Value"],
    ["Studio units", inputs.unitsStudio],
    ["1BR units", inputs.units1BR],
    ["2BR units", inputs.units2BR],
    ["3BR units", inputs.units3BR],
    ["Occupancy profile", inputs.occupancyProfile],
    ["Avg sqft 0BR", inputs.avgUnitSqft.br0],
    ["Avg sqft 1BR", inputs.avgUnitSqft.br1],
    ["Avg sqft 2BR", inputs.avgUnitSqft.br2],
    ["Avg sqft 3BR", inputs.avgUnitSqft.br3],
    ["Climate zone", inputs.climateZone],
    ["Indoor design (F)", inputs.indoorDesignF],
    ["Inlet water (F)", inputs.inletWaterF ?? "auto (climate-derived)"],
    ["Storage setpoint (F)", inputs.storageSetpointF],
    ["Delivery temp (F)", inputs.deliveryF],
  ];
}

function demandSection(inputs: DhwInputs, r: CalcResult): Row[] {
  return [
    ["Section", "Demand"],
    ["Field", "Value"],
    ["Demand method", inputs.demandMethod],
    ["ASHRAE peak hour (GPH)", round(r.demandASHRAE_MH)],
    ["Total occupants", r.totalOccupants],
    ["Total units", r.totalUnits],
  ];
}

function sizingSection(r: CalcResult): Row[] {
  return [
    ["Section", "Sizing Results"],
    ["Field", "Value", "Unit"],
    ["Peak hour demand", round(r.peakHourDemand), "GPH"],
    ["Storage volume (usable)", round(r.storageVolGal), "gal"],
    ["Storage volume (nominal)", round(r.storageVolGal_nominal), "gal"],
    ["Tempered capacity", round(r.temperedCapacityGal), "gal"],
    ["Recovery", round(r.recoveryGPH), "GPH"],
    ["Recovery", round(r.recoveryBTUH), "BTU/hr"],
    ["Recovery", round(r.recoveryKW, 2), "kW"],
    ["First-hour rating (combi)", round(r.combi.fhr), "GPH"],
    ["HPWH nameplate", round(r.hpwhNameplateKW, 2), "kW"],
  ];
}

function annualEnergySection(r: CalcResult): Row[] {
  const annualKWh = r.annualHPWHKWh_total + r.annualResistanceKWh;
  const annualCost = r.annualGasCost + r.annualHPWHCost + r.annualResistanceCost;
  const annualCarbon = r.annualGasCarbon + r.annualHPWHCarbon + r.annualResistanceCarbon;
  return [
    ["Section", "Annual Energy"],
    ["Field", "Value", "Unit"],
    ["Annual gas", round(r.annualGasTherms), "therms"],
    ["Annual electric", round(annualKWh), "kWh"],
    ["Annual COP", round(r.annualCOP, 3), ""],
    ["Annual cost", round(annualCost, 2), "USD"],
    ["Annual CO2", round(annualCarbon), "lb"],
  ];
}

/** System-type-specific equipment summary. Switch on systemType so each
 *  variant emits the most relevant equipment fields. */
function equipmentSection(inputs: DhwInputs, r: CalcResult): Row[] {
  const rows: Row[] = [
    ["Section", "Equipment Selected"],
    ["Field", "Value"],
  ];
  switch (inputs.systemType) {
    case "central_gas":
    case "central_resistance":
      rows.push(
        ["Gas efficiency", `${(inputs.gasEfficiency * 100).toFixed(0)}%`],
        ["Storage setpoint (F)", inputs.storageSetpointF],
        ["Recirc loop length (ft)", inputs.recircLoopLengthFt],
        ["Pipe insulation R-value", inputs.pipeInsulationR],
      );
      break;
    case "central_hpwh":
      rows.push(
        ["HPWH refrigerant", inputs.hpwhRefrigerant],
        ["HPWH tier", inputs.hpwhTier],
        ["Swing tank enabled", inputs.swingTankEnabled ? "Yes" : "No"],
        ["Recirc loop length (ft)", inputs.recircLoopLengthFt],
        ["Pipe insulation R-value", inputs.pipeInsulationR],
      );
      break;
    case "inunit_gas_tank":
      rows.push(
        ["Gas tank size", `${inputs.gasTankSize} gal`],
        ["Gas tank type", inputs.gasTankType],
        ["Gas tank setpoint (F)", inputs.gasTankSetpointF],
        ["Gas tank UEF", round(r.inUnitGas.gasTankUEF, 3)],
      );
      break;
    case "inunit_gas_tankless":
      rows.push(
        ["Tankless input (kBTU/hr)", inputs.gasTanklessInput],
        ["Tankless design rise (F)", inputs.tanklessDesignRiseF],
        ["Simultaneous fixtures", inputs.tanklessSimultaneousFixtures],
        ["Tankless setpoint (F)", inputs.gasTanklessSetpointF],
      );
      break;
    case "inunit_hpwh":
    case "inunit_combi":
      rows.push(
        ["Combi tank size (gal)", inputs.combiTankSize],
        ["HPWH refrigerant", inputs.hpwhRefrigerant],
        ["HPWH tier", inputs.hpwhTier],
        ["Combi DHW setpoint (F)", inputs.combiDHWSetpointF],
        ["Fan-coil supply (F)", inputs.fanCoilSupplyF],
        ["Buffer tank enabled", inputs.bufferTankEnabled ? "Yes" : "No"],
      );
      break;
    case "inunit_combi_gas":
      rows.push(
        ["Gas tank size", `${inputs.gasTankSize} gal`],
        ["Gas tank type", inputs.gasTankType],
        ["Gas tank setpoint (F)", inputs.gasTankSetpointF],
        ["Fan-coil supply (F)", inputs.fanCoilSupplyF],
      );
      break;
  }
  return rows;
}

function autoSizeSection(r: CalcResult): Row[] {
  const a = r.autoSize;
  const rows: Row[] = [
    ["Section", "Auto-Size Summary"],
    ["Variant", "Cap", "Cap Cost (USD)", "Annual Cost (USD)", "15-yr Lifecycle (USD)"],
  ];
  if (!a) {
    rows.push(["(no auto-size result for this system type)", "", "", "", ""]);
    return rows;
  }
  for (const variant of ["minimum", "recommended", "lifecycle"] as const) {
    const rec = a[variant];
    if (!rec) {
      rows.push([variant, "", "", "", ""]);
      continue;
    }
    rows.push([
      variant,
      formatCap(rec),
      round(rec.capCost, 2),
      round(rec.annCost, 2),
      rec.total15 !== undefined ? round(rec.total15, 2) : "",
    ]);
  }
  return rows;
}

/** Best-effort cap label — many SizingRec shapes use `cap`, some use other keys. */
function formatCap(rec: { [k: string]: unknown }): string {
  const cap = rec.cap ?? rec.capacity ?? rec.size ?? rec.kBTU ?? rec.gal;
  if (cap === null || cap === undefined) return "";
  if (typeof cap === "number") return String(round(cap, 2));
  return String(cap);
}

function complianceSection(r: CalcResult): Row[] {
  const rows: Row[] = [
    ["Section", "Compliance Flags"],
    ["Level", "Code", "Message"],
  ];
  for (const f of r.flags) {
    rows.push([f.level, f.code, f.msg]);
  }
  if (r.flags.length === 0) {
    rows.push(["(none)", "", ""]);
  }
  return rows;
}

/** Round a number to `digits` places. Returns the original value if not a number. */
function round(n: number, digits = 0): number {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/** Serialize a single row, escaping per RFC 4180. */
function serializeRow(row: Row): string {
  return row.map(escapeCell).join(",");
}

/** Escape a CSV cell: wrap in quotes if it contains comma, quote, or newline. */
function escapeCell(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  const s = String(cell);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a Blob and click an anchor to trigger the download. SSR-safe. */
function triggerDownload(csv: string, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
