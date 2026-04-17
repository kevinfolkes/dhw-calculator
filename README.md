# DHW Sizing Calculator

Multifamily domestic-hot-water sizing and energy modeling tool. Ported from a
self-contained React artifact into a typed, testable Next.js project.

**Stack.** Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) ·
Tailwind v4 · Recharts · Vitest · jsPDF / docx for submittal export.

**Aesthetic.** Matches the VoltEdge / WeatherNorm ("wn-app") design system —
light theme, Manrope sans, JetBrains Mono for numerics, navy nav, blue
accent, rounded cards with soft borders.

## Getting started

```bash
npm install
npm run test        # vitest — engineering module tests
npm run dev         # next dev at http://localhost:3000
npm run build       # production build
```

## Project layout

```
src/
├── app/                  # Next.js App Router (layout, page, globals.css)
├── components/
│   ├── DhwCalculator.tsx # main client component (state + nav + routing)
│   ├── tabs/             # one file per tab
│   └── ui/               # shared primitives (Card, Field, Flag, MetricCard)
├── hooks/
│   └── useDhwInputs.ts   # URL param + localStorage persistence
└── lib/
    ├── engineering/      # ASHRAE constants, Hunter, HPWH, HDD, climate
    ├── sizing/           # per-system auto-sizing (min / recommended / lifecycle)
    ├── calc/             # DhwInputs type + runCalc() pipeline
    ├── export/           # PDF / DOCX submittal export
    ├── persistence.ts    # base64url encode / decode for share links
    └── utils.ts          # cn(), fmt(), fmtUSD()
```

## Engineering references

All coefficients are traceable to published standards. See the header of
[`src/lib/engineering/constants.ts`](src/lib/engineering/constants.ts).

- ASHRAE HVAC Applications Handbook, Ch. 51 — Service Water Heating
- ASHRAE 90.1-2022 — Energy Standard
- ASHRAE 188-2021 — Legionellosis Risk Management
- ASPE Data Book Vol. 2, Ch. 5 — Cold & Hot Water Supply (Modified Hunter)
- 2021 IPC / UPC — Water Supply Fixture Units
- EPA eGRID 2022 — Subregion emission factors
- NOAA 30-year climate normals — HDD65 and annual averages
- DOE UEF / AHRI 1300 & 1700 — Certified performance ratings
- ACCA Manual J — Abbreviated heating load method

## Persistence & sharing

Inputs are persisted to `localStorage` on every change. The
`Copy share link` button in the Compliance tab encodes the current inputs
into a base64url-safe URL parameter (`?s=…`), so a MEP can email a
specific sized design.

## Submittal export

The Compliance tab exports a PDF and DOCX package with:
1. Project inputs (unit mix, climate, setpoints, utility rates)
2. Sizing outputs (storage, recovery, tempered capacity, total load)
3. Auto-size recommendations (minimum / recommended / lifecycle)
4. Compliance flags with ASHRAE / code references

## Tests

Engineering modules have per-file unit tests plus an integration test for
the full `runCalc()` pipeline. Tests pin the published ASHRAE / Hunter curves
to the implementation, so refactors that break sizing accuracy will fail CI.

```bash
npm test
```
