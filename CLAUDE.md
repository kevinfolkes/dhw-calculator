# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev                  # next dev — http://localhost:3000
npm run build                # static export to ./out (GitHub Pages target)
npm run lint                 # eslint
npm test                     # vitest run — full suite (354+ tests)
npm run test:watch           # vitest in watch mode

# Run a single test file
npx vitest run src/lib/inunit-hvac/calibration.test.ts

# Run tests matching a name pattern
npx vitest run -t "ASHRAE 90.1"
```

The dev server uses `basePath: ""` so URLs work at `localhost:3000/dhw`. Production builds set `basePath: "/dhw-calculator"` (GitHub Pages subpath) — see `next.config.ts`.

## Architecture

This is a **multi-end-use multifamily energy calculator suite**, not a single-purpose app. The codebase is structured so each end use (DHW, lighting, in-unit HVAC, plus planned RTUs / boilers-chillers / etc.) is an independent calculator that follows the same anatomy. Most of the architectural value is in the *shared shape* — understand it once and any new calculator slots in.

### Per-calculator anatomy

For each domain `<x>` (currently `calc` for DHW, `lighting`, `inunit-hvac`):

```
src/lib/<x>/inputs.ts          <X>Inputs type + DEFAULT_INPUTS + presets
src/lib/<x>/types.ts           <X>Result type
src/lib/<x>/pipeline.ts        runCalc(inputs): <X>Result — PURE FUNCTION
src/lib/<x>/calibration.test.ts cross-checks vs published references
src/components/<X>Calculator.tsx  shell: tab nav + state + routing
src/components/tabs/<x>/*.tsx     per-tab UI (Overview, Equipment, Energy, Retrofit, Calculations, Methodology)
src/hooks/use<X>Inputs.ts      localStorage persistence
src/app/<x>/page.tsx           Next.js route entry
```

DHW is the exception — its tabs live at `src/components/tabs/*.tsx` (top-level, no `dhw/` subdir) for historical reasons. New calculators should namespace their tabs under `tabs/<x>/`.

`runCalc` is a **pure deterministic function** with zero external dependencies (no I/O, no Date.now, no Math.random). Every output traces back to inputs. This is what makes the calibration tests possible — they assert against published reference values without mocking anything.

### Engine versioning

`src/lib/version.ts` exports `ENGINE_VERSIONS` as a per-domain map. When you change a calculator's math in a way that could shift a numeric result by >0.5% on default inputs, **bump that domain's version**. Saved reports stamp `engineVersion` at save time; the Reports + Compare tabs surface a stale banner when `ENGINE_VERSIONS[report.domain] !== report.engineVersion`.

Current versions: `dhw: 0.5.1`, `lighting: 1.0.0`, `inunit_hvac: 1.1.0`. Future domains (`rtus`, `boilers_chillers`) are stubbed at `1.0.0`.

### Saved reports schema (v2)

`src/lib/reports/storage.ts` defines the multi-domain `SavedReport<I, R>` with a `domain` discriminator and a `scenarios: SavedScenario<I, R>[]` array. Single-snapshot reports have one scenario; **retrofit comparisons have two** (labels `"current"` and `"proposed"`). Same library holds all domains.

A `migrateRecord` function auto-upgrades v1 records (single `{inputs, results}`, no domain) on read into v2-shaped DHW reports. Storage key stays at `"dhw-calc.reports.v1"` to preserve user data across the schema bump.

`useDhwInputs.setInputs` merges with `DEFAULT_INPUTS` on every call so older serialized inputs that lack newly-added fields hydrate cleanly. The lighting + in-unit HVAC hooks follow the same pattern.

### Retrofit comparison pattern

`src/components/RetrofitComparison.tsx` is a generic two-column widget with type parameters `<I, R>`. Each calculator passes:
- `currentInputs / proposedInputs` (independent input objects of type `I`)
- `runCalc: (i: I) => R` (the domain pipeline)
- `extractMetrics: (r: R) => RetrofitMetrics` (5-line domain adapter that pulls kwh/therms/cost/carbon out of the result — kept per-calculator since field names differ)
- `renderInputs` (a compact per-side input form, written by the calculator)
- `proposedPreset` (an "Apply [retrofit]" one-click — calculators that have smart heuristics, like in-unit HVAC's ducted-central-detect, compute this dynamically)
- `onSave` (persists via `saveScenarios(name, domain, scenarios)`)

`SavingsStrip.tsx` displays kWh / therms / $ / lb CO₂ deltas + simple payback when capex is provided. The `RetrofitMetrics` interface separates kWh and therms intentionally (don't conflate fuel switching by adding them).

### Navigation: two patterns

- **`TopTabNav.tsx`** — horizontal scrollable row with active underline. Used by lighting (4 tabs) and in-unit HVAC (6 tabs). Has scroll chevrons + fade overlays + auto-scroll-active-tab-into-view for cases where the row outgrows the viewport (these affordances are conditional on overflow).
- **`SideTabNav.tsx`** — vertical left rail with collapsible groups. Used by DHW (13 tabs across 4 workflow stages: Inputs / Evaluation / Documentation / Output). Active group auto-expands so the user never lands on a hidden active tab.

Pick `SideTabNav` when a calculator has >10 tabs or strong workflow hierarchy; `TopTabNav` otherwise.

### Calibration discipline

Every domain has a `calibration.test.ts` that pins the engine to **published reference bands** from authoritative sources — ASHRAE standards, AHRI rating procedures, ENERGY STAR specifications, NEEP / NEEA databases, EPA eGRID, DOE Building America. Comments cite the specific source.

Tests assert ranges (e.g., "35–65% kWh reduction on PTAC → mini-split retrofit in CZ4A") rather than exact values, because the underlying references publish bands. **Don't replace these with point assertions** — the looseness is the point.

A release can't ship if calibration tests fail. When changing engine math, run the calibration suite first; if it goes red and the change was intentional, update the test ranges in the same commit and explain in the commit message which published source you cross-checked against.

`docs/calibration.md` is the human-readable companion. Keep it in sync when adding domains or changing tolerances.

### Chart palette

`src/lib/chart-palette.ts` is the **single source of truth for chart colors**. Recharts passes `fill` / `stroke` straight through to SVG attributes, which **do not resolve CSS `var()` references**. Hardcode the literal hex values there, mirror them in `globals.css` for non-chart UI usages, keep them in sync. Calculator code imports the typed maps (`LIGHTING_CATEGORY_COLORS`, `INUNIT_HVAC_ENDUSE_COLORS`, etc.) — never hardcodes hex in component files.

### Methodology vs Calculations helpers

Two separate helper modules with intentionally different visual styling:

- **`src/components/methodology/Helpers.tsx`** — large prose for long-form reference content (`Prose`, `H4`, `Code`, `Em`, `Formula`, `Table`, `Callout`). Used by every domain's Methodology tab.
- **`src/components/calculations/Helpers.tsx`** — compact worked-example primitives (`Step`, `Formula`, `Sub`, `Result`, `KVList`, `Callout`, `Prose`, `Em`). Used by every domain's Calculations tab.

Names overlap (`Prose`, `Em`, `Formula`, `Callout`) but they're styled differently. Import from the module appropriate to which kind of tab you're rendering — don't mix.

## Static export deployment

`next.config.ts` sets `output: "export"`, `basePath: "/dhw-calculator"` (production only), `trailingSlash: true`, and `images.unoptimized: true`. The app is a fully client-rendered SPA — no backend, no API routes, no environment variables, no runtime dependencies on Node. Saved reports live in browser localStorage; PDF / DOCX / Excel / CSV export happens entirely client-side via `jspdf`, `docx`, `exceljs`, and `file-saver`.

GitHub Actions deploys `out/` to GitHub Pages on push to `main`. The Live demo is `kevinfolkes.github.io/dhw-calculator`.

## Engineering references (don't trust assumptions — check the source)

When touching a coefficient or formula, the reference should be cited in the surrounding comment. Authoritative sources used:

- ASHRAE HVAC Applications Handbook Ch. 51 (Service Water Heating)
- ASHRAE 90.1-2022 (§6.4 HVAC, §9 Lighting)
- ASHRAE 188-2021 (Legionellosis Risk Management)
- ASPE Data Book Vol. 2 Ch. 5 (Modified Hunter)
- AHRI 210/240, 310/380, 1300, 1700 (equipment rating standards)
- ENERGY STAR Central AC/HP v6.1, Lamps v4.0, Luminaires v2.0, MFNC v1.2
- NEEP Cold Climate ASHP Specification + Product List
- DOE Building America multifamily reference designs
- EPA eGRID 2022 (subregion emission factors)
- IES Lighting Handbook 11th ed.
- NOAA 30-year climate normals (HDD65, annual averages)

The header comment of `src/lib/engineering/constants.ts` lists the specific tables / sections referenced for each DHW constant. Per-domain references live in each domain's `pipeline.ts` header and its in-app Methodology tab.

## Gotchas

- **`.claude/` is gitignored** — Claude Code session config (plans, history, IDE bindings) does not follow this repo. Each new clone starts fresh.
- **Compare tab reads `monthly.monthlyAnnualCost` etc.** — not the cross-tech "what-if" fields. The latter produce identical values across systems and were the bug that motivated DHW v0.4.1. Don't reintroduce them.
- **In-unit HVAC monthly fractions are normalized inside the pipeline** so the published rounded HDD/CDD fraction tables sum to exactly 1.0. Annual = sum of monthly within float tolerance; calibration asserts this.
- **DHW `gasTankUEFOverride` precedence**: non-zero override beats the size + atmospheric/condensing lookup. Out-of-range values (>1) fall back to lookup — guards typos like entering 90 instead of 0.90.
- **`extractMetrics` is duplicated per-calculator on purpose** — same shape, different field names (`result.annualKWh` for lighting, `result.totalAnnualKWh` for in-unit HVAC). They're domain adapters, not duplication.
- **Heavy tabs are lazy-loaded** via `next/dynamic` in each calculator shell (`EnergyTab` for the recharts cost; `CalculationsTab` for size; `MethodologyTab` for the long-form prose). Use the same pattern when adding new heavy tabs. The `TabSkeleton` component at `src/components/ui/TabSkeleton.tsx` is the shared loader placeholder.
- **`EnergyTab` + `CalculationsTab` + `MethodologyTab` are wrapped in `React.memo`** so unrelated parent state updates don't trigger recharts re-paints or long-prose re-renders. Wrap new heavy tabs the same way (rename `function X` → `function XInner`, export `const X = memo(XInner)`).
- **DHW `CalculationsTab.tsx` is ~1400 lines but intentionally not split** — it's lazy-loaded (no first-paint cost), uses shared helpers from `calculations/Helpers.tsx`, and represents the worked example for one tab. Splitting it would scatter the math walkthrough across files; the ergonomic boundary is the file itself.

## Keeping the docs current — non-negotiable

The following files are part of the architecture, not just commentary on it. They MUST be updated in the same commit that introduces an architectural change. "Architectural change" = anything that would alter the answers in `architecture.json` — adding a calculator, refactoring a shared module, changing the storage schema, bumping engine versions, changing nav patterns, adding/removing routes, changing the deployment target, etc.

| File | What to keep current |
|---|---|
| `README.md` | "What's shipped" table (tab counts, engine versions), project layout if directory shape changed, engineering references when adding new authoritative sources |
| `architecture.json` | Components list, dataFlows, constraints, architectureDecisions, issues, entry points, engineVersions in `entryPoints`, testCount |
| `architecture-map.html` | The `ARCH` object at the top of the `<script>` block — same data as architecture.json but shaped for SVG rendering. Update the nodes / flows / decisions / issues arrays in lockstep. |
| `CLAUDE.md` | This file. New architectural patterns, new conventions, new gotchas, new constraints. |
| `docs/calibration.md` | When adding or tightening calibration assertions, or adding a new domain's calibration suite. |

Convention checklist when touching `src/`:

1. Did the routes change? → Update README "What's shipped", architecture.json `entryPoints`, architecture-map.html routes layer.
2. Did a new calculator domain land? → Update README everywhere, architecture.json + architecture-map.html every section, CLAUDE.md per-calculator notes, version.ts ENGINE_VERSIONS.
3. Did engine math change? → Bump `ENGINE_VERSIONS[domain]` (the >0.5% rule), update calibration test ranges if needed with a source citation, update docs/calibration.md.
4. Did a shared module's contract change? → Update architecture.json `components.sharedInfrastructure`, architecture-map.html corresponding nodes/flows, CLAUDE.md if a new convention emerged.
5. Did test count change? → Update README, architecture.json `testingStrategy.testCount`, architecture-map.html banner.

When in doubt, regenerate `architecture.json` from scratch by walking the codebase and diff against the committed version — drift is easier to catch when the diff is fresh.
