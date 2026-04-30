#!/usr/bin/env node
/**
 * Cross-system smoke report. Runs runCalc with DEFAULT_INPUTS for every
 * SystemTypeKey and prints a comparison table of the most-relied-on
 * outputs. Intended for human review during testing checkpoints.
 *
 * Usage: npx tsx scripts/smoke-report.mjs
 */
import { runCalc } from "../src/lib/calc/pipeline.ts";
import { DEFAULT_INPUTS } from "../src/lib/calc/inputs.ts";
import { SYSTEM_TYPE_KEYS, SYSTEM_TYPES } from "../src/lib/engineering/system-types.ts";

const fmt = (n, dp = 0) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp });

const rows = SYSTEM_TYPE_KEYS.map((sys) => {
  try {
    const r = runCalc({ ...DEFAULT_INPUTS, systemType: sys });
    const rec = r.autoSize?.recommended;
    return {
      sys,
      label: SYSTEM_TYPES[sys].short,
      peakGPH: r.peakHourDemand,
      storageGal: r.storageVolGal,
      totalBTUH: r.totalBTUH,
      annualCost: r.monthly.monthlyAnnualCost,
      annualCarbon: r.monthly.monthlyAnnualCarbon,
      capCost: rec?.capCost ?? null,
      annCost: rec?.annCost ?? null,
      flagsCount: r.flags.length,
      monthlyUnit: r.monthly.monthlyUnit,
      effectiveInletF: r.effectiveInletF,
      ok: true,
      err: null,
    };
  } catch (e) {
    return { sys, label: SYSTEM_TYPES[sys].short, ok: false, err: String(e) };
  }
});

console.log("");
console.log("System type cross-comparison (DEFAULT_INPUTS — 60 unit Chicago bldg, MROW grid)");
console.log("=".repeat(132));
const header = [
  "System".padEnd(22),
  "Peak GPH".padStart(9),
  "Storage".padStart(9),
  "BTU/hr".padStart(11),
  "Ann Cost".padStart(11),
  "Ann CO2".padStart(11),
  "Cap Cost".padStart(11),
  "Op Cost".padStart(11),
  "Flags".padStart(6),
  "Unit".padStart(7),
  "Inlet".padStart(7),
].join(" │ ");
console.log(header);
console.log("─".repeat(132));
for (const r of rows) {
  if (!r.ok) {
    console.log(`${r.label.padEnd(22)} │ ❌ ${r.err}`);
    continue;
  }
  console.log(
    [
      r.label.padEnd(22),
      fmt(r.peakGPH).padStart(9),
      fmt(r.storageGal).padStart(9),
      fmt(r.totalBTUH).padStart(11),
      ("$" + fmt(r.annualCost)).padStart(11),
      (fmt(r.annualCarbon) + " lb").padStart(11),
      ("$" + fmt(r.capCost)).padStart(11),
      ("$" + fmt(r.annCost)).padStart(11),
      String(r.flagsCount).padStart(6),
      (r.monthlyUnit || "—").padStart(7),
      (fmt(r.effectiveInletF) + "°F").padStart(7),
    ].join(" │ "),
  );
}
console.log("=".repeat(132));
const fails = rows.filter((r) => !r.ok);
if (fails.length) {
  console.log(`\n❌ ${fails.length} system(s) errored:`);
  for (const f of fails) console.log(`  - ${f.sys}: ${f.err}`);
  process.exit(1);
}
console.log(`\n✅ All ${rows.length} system types produced valid results.\n`);
