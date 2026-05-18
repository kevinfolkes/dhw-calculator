# Multifamily Building Energy Calculator

[![Live Demo](https://img.shields.io/badge/demo-live-success?style=flat-square)](https://kevinfolkes.github.io/dhw-calculator/)
[![Deploy to GitHub Pages](https://github.com/kevinfolkes/dhw-calculator/actions/workflows/deploy.yml/badge.svg)](https://github.com/kevinfolkes/dhw-calculator/actions/workflows/deploy.yml)

A web-based engineering tool for sizing and retrofitting equipment in
multifamily residential buildings. Each major end use — domestic hot
water, lighting, in-unit HVAC, with rooftop HVAC and central plants
planned — has its own calculator that ingests a building configuration
and produces annual kWh / $ / lb CO₂ outputs, a current-vs-proposed
retrofit comparison, and a step-by-step worked-example walkthrough of
the math.

**Live demo:** [kevinfolkes.github.io/dhw-calculator](https://kevinfolkes.github.io/dhw-calculator/)

**Stack:** Next.js 16 (App Router, static export) · React 19 ·
TypeScript 5 strict · Tailwind v4 · Recharts · jsPDF / docx / exceljs
for submittal export · Vitest with 350+ calibration tests.

## Why it exists

Standard practice for multifamily energy work involves spreadsheets
cobbled together per project, manual lookups in ASHRAE / AHRI / NEEP /
EPA reference tables, and informal back-of-the-envelope retrofit
comparisons. The numbers are usually right but the work is opaque, slow
to repeat across a portfolio, and hard to audit.

This tool replaces that workflow with a single application that:

- **Embeds the published engineering standards directly in the engine** —
  every coefficient is traceable to a specific reference (ASHRAE 90.1-
  2022 §9 LPD limits, AHRI 210/240 SEER2 rating, ENERGY STAR thresholds,
  EPA eGRID emission factors, etc.).
- **Cross-validates against published reference values in CI** — 354
  calibration tests run on every build, asserting that the engine
  reproduces field-measured savings bands from MassSave, NYSERDA, NEEA,
  DOE Building America, and similar sources.
- **Produces a defensible retrofit estimate** — kWh, $, and lb CO₂
  savings for any current-vs-proposed equipment swap, with the math
  shown step-by-step on a Calculations tab.
- **Saves scenarios to a cross-domain report library** that can be
  exported to PDF / DOCX / Excel / CSV for inclusion in submittals or
  design-review packages.

The intended user is an energy manager, engineer, or consultant at a
multifamily portfolio owner, ESCO, utility, or design firm who needs to
quantify retrofit value at portfolio scale without spinning up a custom
spreadsheet per project.

## What's shipped

| End use | Route | Engine | Tabs | Status |
|---|---|---|---|---|
| **Domestic Hot Water** | `/dhw` | `0.5.1` | 13 (SideTabNav, grouped) | Live |
| **Lighting** | `/lighting` | `1.0.0` | 4 (TopTabNav) | Live |
| **In-Unit HVAC** | `/inunit-hvac` | `1.1.0` | 6 (TopTabNav) | Live |
| Rooftop HVAC (RTUs) | `/rtus` | — | — | Planned |
| Central Boilers / Chillers | `/boilers-chillers` | — | — | Planned |
| Ventilation (common-area, ERV/HRV) | — | — | — | Planned |
| Common-area appliances (laundry, elevators) | — | — | — | Planned |
| Plug loads + in-unit refrigerators | — | — | — | Planned |
| Pool / hot tub heating | — | — | — | Planned |
| EV charging | — | — | — | Planned |

Plus two cross-domain views:
- **`/reports`** — saved scenarios across every end use, with import / export
- **`/compare`** — side-by-side any 2–4 scenarios with delta column

### Domestic Hot Water
19 system types covering central plants (gas, gas tankless, indirect,
hybrid HPWH + gas, steam HX, all-electric HPWH, per-floor decentralized,
heat-recovery chiller, sewer-source HPWH, cogeneration) and in-unit
equipment (gas tank atmospheric/condensing with optional user-overridable
UEF, gas tankless, HPWH, resistance, combi variants). Sizing per ASHRAE
Chapter 51 / ASPE / Hunter; auto-size against three philosophies
(minimum, recommended, 15-year lifecycle). Calibrated against ASHRAE
Applications Ch. 51, ASPE Data Book Vol. 2, AHRI 1300 / 1700, NEEA HPWH
benchmarks, ENERGY STAR MFNC v1.2, EPA eGRID 2022.

### Lighting
Seven luminaire categories (corridor, stairwell, common area, exterior
site, exterior façade, in-unit, garage / parking) with occupancy-sensor
and daylight-credit modeling. LPD compliance check against ASHRAE 90.1-
2022 §9.5.1. Retrofit comparison reproduces the 75–85% kWh reduction
range published by ENERGY STAR LED retrofit field data. Calibrated
against ASHRAE 90.1 §9, ENERGY STAR Lamps v4.0 + Luminaires v2.0, DLC
Qualified Products List, DOE Building America, IES Lighting Handbook
11th ed., NEEA MF Lighting Field Study.

### In-Unit HVAC
Eight archetypes per apartment: PTAC + resistance heat, PTHP, ductless
mini-split heat pump, mini-split cooling + resistance baseboards, window
AC + resistance, cold-climate ductless heat pump (NEEP CCHP listed),
ducted central split heat pump (outdoor condenser + indoor air handler +
apartment ductwork), and ducted central AC + electric resistance heat
strip. Equivalent Full-Load Hours method keyed to climate zone. Smart
retrofit preset detects the current archetype and proposes a like-for-
like higher-efficiency replacement — handles same-archetype vintage
comparisons (e.g., 2014 SEER 14 vs 2024 SEER2 18 ducted central) cleanly.
Calibrated against ASHRAE 90.1-2022 §6.4, AHRI 210/240, AHRI 310/380,
ENERGY STAR Central AC / HP v6.1, NEEP Cold Climate ASHP Specification,
MassSave + NYSERDA field studies.

## Architecture

Per-calculator standardized anatomy — every new end use follows this
recipe:

```
src/lib/<domain>/inputs.ts          <X>Inputs type + DEFAULT_INPUTS + presets
src/lib/<domain>/types.ts           <X>Result type
src/lib/<domain>/pipeline.ts        runCalc(inputs): <X>Result — pure function
src/lib/<domain>/calibration.test.ts cross-checks vs published references
src/components/<X>Calculator.tsx    shell: tab nav + state + routing
src/components/tabs/<domain>/*.tsx  per-tab UI (extracted, lazy-loaded for heavy ones)
src/hooks/use<X>Inputs.ts           localStorage persistence
src/app/<domain>/page.tsx           Next.js route entry
```

Key architectural properties:

- **Pure functional pipelines** — `runCalc` is deterministic, no I/O, no
  `Date.now`, no `Math.random`. Makes calibration tests sound; makes the
  React layer thin.
- **No backend** — fully static export to GitHub Pages. Saved reports
  live in browser localStorage. PDF / DOCX / Excel / CSV export happens
  entirely client-side.
- **Multi-domain reports** — `SavedReport` carries a `domain`
  discriminator + `scenarios[]` array. Same library holds DHW snapshots,
  lighting retrofits, in-unit HVAC vintage comparisons. Legacy v1
  records auto-migrate on read.
- **Per-domain engine versioning** — `ENGINE_VERSIONS` is a per-domain
  map. Saved reports stamp the version at save time; stale banner fires
  when math has evolved since save.
- **Lazy-loaded heavy tabs** — `EnergyTab` (recharts), `CalculationsTab`
  (long worked example), and `MethodologyTab` (long-form prose) are
  loaded via `next/dynamic` in each calculator shell so first paint
  doesn't pay the chunk cost.

For the full architectural picture see [`architecture.json`](architecture.json)
(structured for AI-agent consumption) and [`architecture-map.html`](architecture-map.html)
(interactive single-file diagram — open in any browser, no server needed).
The architecture map shows every component, every flow, every layer,
clickable for details.

## Project layout

```
src/
├── app/                              # Next.js App Router (per-route page.tsx)
│   ├── layout.tsx                    # RootLayout wrapping every route in AppShell
│   ├── page.tsx                      # Landing — calculator picker tile grid
│   ├── dhw/                          # /dhw → DhwCalculator
│   ├── lighting/                     # /lighting → LightingCalculator
│   ├── inunit-hvac/                  # /inunit-hvac → InUnitHvacCalculator
│   ├── reports/                      # /reports — cross-domain library
│   └── compare/                      # /compare — cross-domain diff
├── components/
│   ├── AppShell.tsx                  # brand bar + calculator picker drawer
│   ├── CalculatorPicker.tsx
│   ├── DhwCalculator.tsx             # DHW shell — 13 tabs, SideTabNav
│   ├── LightingCalculator.tsx        # Lighting shell — 4 tabs, TopTabNav
│   ├── InUnitHvacCalculator.tsx      # In-unit HVAC shell — 6 tabs, TopTabNav
│   ├── TopTabNav.tsx                 # horizontal nav (overflow-aware)
│   ├── SideTabNav.tsx                # vertical nav with collapsible groups
│   ├── RetrofitComparison.tsx        # generic <I,R> current-vs-proposed widget
│   ├── SavingsStrip.tsx              # delta + simple-payback display
│   ├── methodology/Helpers.tsx       # long-form prose primitives
│   ├── calculations/Helpers.tsx      # compact worked-example primitives
│   ├── tabs/                         # DHW tabs (at root for historical reasons)
│   ├── tabs/lighting/                # Lighting tabs
│   ├── tabs/inunit-hvac/             # In-unit HVAC tabs
│   └── ui/                           # Card / Field / Grid / MetricCard / Flag / TabSkeleton
├── hooks/
│   ├── useDhwInputs.ts               # +URL share link
│   ├── useLightingInputs.ts
│   └── useInUnitHvacInputs.ts
└── lib/
    ├── calc/                         # DHW pipeline + types + calibration
    ├── lighting/                     # Lighting pipeline + types + calibration
    ├── inunit-hvac/                  # In-unit HVAC pipeline + types + calibration
    ├── engineering/                  # DHW engineering modules (constants / climate / hunter / hpwh / etc.)
    ├── sizing/                       # auto-sizing + lifecycle cost models
    ├── reports/storage.ts            # multi-domain SavedReport library
    ├── export/                       # PDF / DOCX / Excel / CSV
    ├── chart-palette.ts              # recharts hex literals (CSS vars can't reach SVG attrs)
    ├── version.ts                    # ENGINE_VERSIONS per-domain map
    ├── persistence.ts                # base64url for share links
    └── utils.ts                      # cn / fmt / fmtUSD
```

## Getting started

```bash
npm install
npm run dev          # next dev — http://localhost:3000
npm test             # vitest run — full suite (350+ tests)
npm run test:watch   # vitest in watch mode
npm run build        # static export to ./out (GitHub Pages target)
npm run lint         # eslint

# Run a single test file
npx vitest run src/lib/inunit-hvac/calibration.test.ts

# Run tests matching a name pattern
npx vitest run -t "ASHRAE 90.1"
```

The calculator runs entirely client-side — no environment variables, no
API keys, no external services. Saved reports persist to browser
localStorage; use the export buttons (PDF / DOCX / Excel / CSV) to move
them between machines.

## Engineering references

Every coefficient is traceable to a published source. Per-calculator
references live in the in-app Methodology tab; the underlying constants
are documented in source-file headers.

- **ASHRAE Applications Handbook Ch. 51** — Service Water Heating
- **ASHRAE 90.1-2022** — Energy Standard (§6.4 HVAC, §9 Lighting)
- **ASHRAE 188-2021** — Legionellosis Risk Management
- **ASPE Data Book Vol. 2 Ch. 5** — Modified Hunter
- **AHRI 210/240, 310/380, 1300, 1700** — equipment rating standards
- **ENERGY STAR** Central AC/HP v6.1, Lamps v4.0, Luminaires v2.0, MFNC v1.2
- **NEEP Cold Climate ASHP** Specification + Product List
- **DOE Building America** multifamily reference designs
- **EPA eGRID 2022** subregion emission factors
- **IES Lighting Handbook** 11th ed.
- **NOAA 30-year climate normals** (HDD65, annual averages)
- **NEEA / NYSERDA / MassSave** retrofit field-study data

## Contributing — keep the docs current

When you modify the architecture (add a calculator, change the storage
schema, refactor a navigation pattern, bump an engine version, etc.) the
following docs MUST be updated in the same change:

- `README.md` — top-level scope, the "What's shipped" table, the
  Project layout section if the directory shape changed
- `architecture.json` — structured data for AI-agent consumption
- `architecture-map.html` — interactive visual diagram
- `CLAUDE.md` — architecture notes for future Claude Code sessions
- `docs/calibration.md` — when adding or tightening calibration assertions

Treat them as part of the code, not as "documentation." Drift between
the source tree and these files makes future architectural decisions
harder and erodes the calibration discipline that keeps the engine
trustworthy.

## License

Currently unspecified — treat as all rights reserved until a LICENSE
file is added.
