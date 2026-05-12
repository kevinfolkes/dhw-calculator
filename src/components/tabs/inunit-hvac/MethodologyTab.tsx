"use client";

/**
 * In-unit HVAC Methodology tab — long-form reference document covering every
 * source the calculator pulls from, key insights and assumptions baked in,
 * and known limitations. Mirrors the lighting MethodologyTab structure so an
 * MEP reviewer can read this page and trust (or challenge) outputs without
 * leaving the app.
 *
 * Wrapped in React.memo because the component takes no props — every parent
 * re-render would otherwise re-render the entire (long-form) tab content.
 */
import { memo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Callout,
  Code,
  Em,
  Formula,
  H4,
  Prose,
  Table,
} from "@/components/methodology/Helpers";

function MethodologyTabInner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        Methodology &amp; sources
      </h1>

      {/* ─── OVERVIEW ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            This calculator estimates annual cooling and heating energy, cost,
            and carbon emissions for a multifamily building running per-
            apartment in-unit HVAC equipment. Eight archetypes are modeled:
            PTAC + electric resistance heat, PTHP, ductless mini-split heat
            pump, ductless mini-split cooling-only + electric baseboards,
            window AC + resistance baseboards, cold-climate ductless heat
            pump (NEEP CCHP listed), <strong>ducted central split heat
            pump</strong> (outdoor condenser + indoor air handler + apartment
            ductwork), and <strong>ducted central split AC + electric
            resistance heat</strong>. The pipeline lives at{" "}
            <Code>src/lib/inunit-hvac/pipeline.ts</Code>; engineering math
            is documented in this page.
          </p>
          <p>
            Outputs include annual kWh / $ / lb CO₂ split by cooling and
            heating end-use, monthly profiles weighted by climate-zone
            HDD / CDD shares (so cold-climate winters concentrate heating
            kWh in Dec–Feb and hot-climate summers concentrate cooling kWh
            in Jul–Aug), advisory flags for code-minimum compliance, and a
            two-column current-vs-proposed retrofit comparison with simple-
            payback math.
          </p>
          <p>
            <Em>Calibration:</Em> 35 published-reference assertions in{" "}
            <Code>src/lib/inunit-hvac/calibration.test.ts</Code> cross-check
            the engine against the sources documented below. They run on
            every CI build and have to land within tolerance for a release
            to ship.
          </p>
        </Prose>
      </Card>

      {/* ─── ENGINEERING MATH ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>1. Engineering math — EFLH method</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            The calculator uses the <Em>Equivalent Full-Load Hours</Em>{" "}
            (EFLH) screening method — the simplest defensible approach for
            estimating residential / multifamily cooling and heating energy
            given a piece of equipment&apos;s nameplate capacity and rated
            efficiency. EFLH is the number of hours a piece of equipment
            would need to run at 100% capacity to deliver the same total
            output it actually delivers across the year.
          </p>

          <H4>Per-apartment annual kWh</H4>
          <p>
            For SEER2 / EER / HSPF2 (BTU per Watt-hour ratings):
          </p>
          <Formula>{`annualKWh = (capacityBtuh × eflhHours) ÷ (rating × 1000)`}</Formula>
          <p>
            For COP (dimensionless output/input ratio):
          </p>
          <Formula>{`annualKWh = (capacityBtuh × eflhHours) ÷ (COP × 3412)`}</Formula>
          <p>
            For electric resistance (COP fixed at 1.0):
          </p>
          <Formula>{`annualKWh = (capacityBtuh × eflhHours) ÷ 3412`}</Formula>
          <p>
            Whole-building rollup is per-apartment × <Code>apartmentCount</Code>,
            then site cost = kWh × electric rate, carbon = kWh × eGRID factor.
          </p>

          <H4>Why the unit constants</H4>
          <p>
            <Em>3412 BTU/kWh</Em> is the conversion between thermal energy
            (BTU) and electric energy (kWh). 1 kWh = 3,412.14 BTU.
          </p>
          <p>
            <Em>SEER2, EER, HSPF2</Em> are BTU per Watt-hour ratings — they
            already incorporate the unit conversion implicitly. Capacity ×
            hours ÷ rating gives Wh; ÷ 1000 → kWh.
          </p>
          <p>
            <Em>COP</Em> is dimensionless. Capacity × hours / 3412 gives
            kWh of thermal output; ÷ COP gives kWh of electric input.
          </p>

          <Callout>
            <strong>EFLH method limitations.</strong> EFLH is a screening
            method, not a simulation. It captures the dominant first-order
            effect (climate × equipment efficiency) but smooths over
            second-order effects: hour-by-hour ambient variation, capacity
            derating at low ambients, defrost cycle penalties, part-load
            efficiency curves, indoor temperature setbacks. For
            sub-5% accuracy on a specific building, run an hourly simulation
            (eQUEST, EnergyPlus, BEopt). EFLH is ~10–20% accurate at the
            building-scale rollup, which is plenty for retrofit screening.
          </Callout>
        </Prose>
      </Card>

      {/* ─── EFLH BY CLIMATE ZONE ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>2. EFLH defaults by climate zone</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            EFLH varies dramatically with climate. The calculator looks up
            cooling and heating EFLH from the user&apos;s selected climate
            zone using values aggregated from ASHRAE 90.1-2022 Appendix
            G3.1.3.10 + DOE Building America HVAC reference designs:
          </p>
          <Table
            head={["Climate zone (representative city)", "Cooling EFLH (hr/yr)", "Heating EFLH (hr/yr)"]}
            rows={[
              ["1A — Miami", "2,400", "200"],
              ["2A — Houston", "2,000", "800"],
              ["2B — Phoenix", "2,200", "600"],
              ["3A — Atlanta", "1,500", "1,300"],
              ["3B — LA", "1,200", "700"],
              ["3C — SF", "600", "1,200"],
              ["4A — NYC", "1,100", "1,900"],
              ["4C — Seattle", "500", "2,000"],
              ["5A — Chicago", "800", "2,500"],
              ["5B — Denver", "1,000", "2,300"],
              ["6A — Minneapolis", "600", "2,900"],
              ["7 — Duluth", "400", "3,300"],
            ]}
          />
          <p>
            These are <Em>residential</Em> EFLH values — multifamily apartments
            and single-family homes share roughly the same operating profiles
            (~75°F cooling setpoint, ~68°F heating setpoint, ~18°F design
            ΔT). Commercial EFLH would be higher because of longer occupancy
            hours and higher internal gains.
          </p>
          <H4>When to override the lookup</H4>
          <p>
            The Equipment tab exposes <Code>coolingEflhOverride</Code> and{" "}
            <Code>heatingEflhOverride</Code> fields. Use these only if you
            have a genuinely different number — for example:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Metered building data</strong> showing apartment-level
              run hours that differ from the climate-zone average
            </li>
            <li>
              <strong>Specialty programs</strong> (occupancy-based setbacks,
              demand-response cycling, free-cooling economizers) that reduce
              effective load
            </li>
            <li>
              <strong>Outlier microclimates</strong> not reflected in the
              ASHRAE climate zone (e.g., coastal SF vs inland Bay Area)
            </li>
          </ul>
          <p>
            Otherwise leave at <Code>0</Code> to use the climate-zone
            default. The lookup is conservative-typical — if you don&apos;t
            know your specific building&apos;s EFLH, the lookup is the
            right answer.
          </p>
        </Prose>
      </Card>

      {/* ─── ASHRAE 90.1-2022 §6.4 ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>3. ASHRAE 90.1-2022 §6.4 — minimum equipment efficiency</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            ASHRAE Standard 90.1 is the U.S. federal commercial building
            energy code by reference; §6.4 governs HVAC equipment minimum
            efficiency. Multifamily buildings ≥ 4 stories follow §6 directly;
            low-rise MF (≤ 3 stories) follows IECC residential, but the
            efficiency floors are essentially the same.
          </p>

          <H4>3a. Minimum efficiency by equipment class (MF-relevant subset)</H4>
          <Table
            head={["Equipment class", "Cooling minimum", "Heating minimum", "ASHRAE 90.1 reference"]}
            rows={[
              ["PTAC (≤ 7,000 BTU/h)", "EER 12.0", "—", "§6.4.1.4 Table 6.8.1-3"],
              ["PTAC (7,000–15,000)", "EER 9.5", "—", "§6.4.1.4 Table 6.8.1-3"],
              ["PTHP (≤ 15,000)", "EER 9.5–11.0", "COP 3.0–3.4", "§6.4.1.4 Table 6.8.1-3"],
              ["Split + packaged AC < 65k BTU/h", "SEER2 14.0", "—", "DOE 2023 Federal Min"],
              ["Split + packaged HP < 65k BTU/h", "SEER2 14.3", "HSPF2 7.5", "DOE 2023 Federal Min"],
              ["Mini-split (single-zone)", "SEER2 14–17", "HSPF2 7.5–9.0", "DOE 2023 Federal Min"],
              ["Room AC (window unit)", "CEER 10.5–12.0", "—", "DOE 2023 Federal Min"],
            ]}
          />
          <p>
            <Em>SEER2 / HSPF2 took effect Jan 1, 2023</Em> as the new AHRI
            210/240 testing standard, replacing SEER / HSPF. SEER2 ≈ SEER ×
            0.95, HSPF2 ≈ HSPF × 0.85. If your equipment cut sheet is
            pre-2023 it likely lists SEER / HSPF; convert before entering.
          </p>

          <H4>3b. PTAC EER 9.5 = code minimum since the 1990s</H4>
          <p>
            The PTAC EER 9.5 floor has been in place since federal NAECA
            updates in the late 1990s. Equipment installed today must meet
            or exceed this. Older installations (pre-1995) may have EERs as
            low as 7.5–8.5 — those buildings see disproportionate retrofit
            savings just from a like-for-like PTAC replacement, before any
            heat-pump conversion.
          </p>

          <Callout tone="warn">
            <strong>What this calculator does:</strong> the engine flags{" "}
            <Em>warn</Em>-level when entered cooling efficiency is below the
            ASHRAE 90.1-2022 minimum for the chosen equipment class.
            Heating-side compliance flags surface when an HP&apos;s HSPF2
            falls below the federal minimum. The flag is advisory; some
            jurisdictions allow exceptions for major-system retrofits or
            historic buildings.
          </Callout>
        </Prose>
      </Card>

      {/* ─── AHRI RATING STANDARDS ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>4. AHRI 210/240 + 310/380 — what the ratings mean</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            AHRI (Air-Conditioning, Heating &amp; Refrigeration Institute)
            publishes the rating standards every U.S. HVAC manufacturer must
            follow. Two standards matter for in-unit MF equipment:
          </p>
          <Table
            head={["Standard", "Scope", "Rating method"]}
            rows={[
              [
                "AHRI 210/240-2023",
                "Unitary AC and HP < 65,000 BTU/h",
                "SEER2 (cooling), HSPF2 (heating) — seasonal averages over a representative climate",
              ],
              [
                "AHRI 310/380",
                "Packaged Terminal AC and HP (PTAC / PTHP)",
                "EER (cooling steady-state at 95°F outdoor), COP (heating steady-state at 47°F outdoor)",
              ],
              [
                "AHRI 1230",
                "Variable Refrigerant Flow (VRF)",
                "IEER + COP — out of scope for this calculator",
              ],
            ]}
          />

          <H4>4a. SEER2 vs EER — which to enter?</H4>
          <p>
            <strong>SEER2</strong> is a seasonal rating that simulates a full
            cooling season at varying outdoor temperatures (65–95°F) and
            accounts for compressor cycling at part loads. It applies to
            split / mini-split AC and HP systems.
          </p>
          <p>
            <strong>EER</strong> is a steady-state rating taken at a single
            95°F outdoor / 80°F indoor condition. It applies to PTAC, PTHP,
            and window units rated under AHRI 310/380. EER values are
            typically <Em>lower</Em> than SEER2 for the same physical
            equipment — a SEER2 16 mini-split running steady-state at design
            would deliver maybe EER 11–12.
          </p>
          <Callout>
            <strong>Don&apos;t convert between SEER2 and EER.</strong> The
            calculator&apos;s pipeline handles either correctly because the
            EFLH used for SEER2-rated equipment is an annual average
            (matching SEER2&apos;s seasonal scope), while EER-rated PTAC EFLH
            is also a season average. Both rating methods × their respective
            EFLH produce comparable annual kWh — so don&apos;t multiply EER
            by 0.875 to &quot;convert&quot; or you&apos;ll double-discount.
          </Callout>

          <H4>4b. HSPF2 vs COP — same story</H4>
          <p>
            <strong>HSPF2</strong> (BTU/Wh) is a seasonal rating averaged
            over a heating season at varying outdoor temperatures, including
            defrost cycles and capacity derating. It applies to mini-split HPs.
          </p>
          <p>
            <strong>COP</strong> is steady-state output/input at AHRI&apos;s
            47°F rating point. It applies to PTHPs. PTHP COP 3.0 (the §6.4
            minimum) means the unit delivers 3.0 BTU of heat per BTU of
            electric input — at 47°F. At 17°F a PTHP&apos;s real-world COP
            might be 1.5–1.8, with the calculator&apos;s annual EFLH model
            smoothing across these conditions implicitly.
          </p>

          <H4>4c. Ducted central split vs ductless mini-split</H4>
          <p>
            Both system types are rated under the same AHRI 210/240
            standard (SEER2 / HSPF2), but they differ in installation
            pattern, sizing, and use case:
          </p>
          <Table
            head={["Aspect", "Ductless mini-split", "Ducted central split"]}
            rows={[
              ["Outdoor unit", "Condenser on roof / balcony / pad", "Same"],
              ["Indoor unit", "Wall cassette per zone (1–4 per apt)", "Air handler in closet, attic, or chase"],
              ["Distribution", "Refrigerant directly to each cassette", "Refrigerant to one AHU; ductwork to each room"],
              ["Thermostats", "One per zone (per room)", "One per apartment"],
              ["Typical capacity", "0.75–1.5 ton per zone (9k–18k BTU/h)", "1.5–3 ton per apt (18k–36k BTU/h)"],
              ["Duct losses", "None (point-source delivery)", "5–10% baked into AHRI rating; more for poor ducts"],
              ["Common use case", "Per-room comfort, retrofit in pre-2000s buildings", "Single-thermostat operation, townhouse / newer mid-rise"],
            ]}
          />
          <p>
            AHRI 210/240 testing for ducted central splits assumes properly
            installed ducts in conditioned space — the rating already
            includes ~5% typical duct distribution loss. For ducts in
            unconditioned attics or mechanical chases (rare in MF but
            possible), real-world performance can be 10–20% below rated
            SEER2 / HSPF2. If your building has poorly insulated or leaky
            ducts, manually derate the SEER2 / HSPF2 you enter (e.g.,
            SEER2 16 → SEER2 13 for a leaky-duct scenario).
          </p>
          <Callout>
            <strong>Same-archetype vintage comparison.</strong> The Retrofit
            tab supports comparing two ducted central splits installed years
            apart with different efficiencies — useful for end-of-life
            replacement decisions. The smart preset detects when the current
            archetype is a ducted central split and proposes a higher-
            efficiency ducted central HP rather than a ductless mini-split,
            preserving the duct system + outdoor-unit pad assumption.
          </Callout>
          <p>
            <strong>SEER → SEER2 / HSPF → HSPF2 conversion.</strong>{" "}
            Equipment rated before Jan 1, 2023 lists SEER and HSPF (the
            pre-AHRI-210/240-2023 metrics). To compare with the post-2023
            standard the calculator uses, multiply by approximately{" "}
            <Code>0.95</Code> (SEER → SEER2) and <Code>0.85</Code>{" "}
            (HSPF → HSPF2). A 2014 unit rated SEER 14 / HSPF 8.2 enters as
            SEER2 ~13.3 / HSPF2 ~7.0.
          </p>
        </Prose>
      </Card>

      {/* ─── ENERGY STAR ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>5. ENERGY STAR Central AC/HP v6.1 — the retrofit rebate threshold</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            ENERGY STAR Central AC/HP v6.1 (effective 2023+) is the EPA&apos;s
            voluntary spec that most utility rebate programs require for
            heat-pump retrofit incentives. Mini-splits at or above the
            ENERGY STAR threshold typically qualify for $500–$2,500 per
            apartment in utility / IRA tax credit incentives.
          </p>
          <Table
            head={["Equipment class", "ENERGY STAR cooling min", "ENERGY STAR heating min", "Note"]}
            rows={[
              ["Split / packaged HP < 65k BTU/h", "SEER2 16.0", "HSPF2 8.5", "Most rebated tier"],
              ["Mini-split single-zone", "SEER2 16.0", "HSPF2 8.5", "Same as split"],
              ["Mini-split multi-zone", "SEER2 18.0", "HSPF2 9.0", "Premium tier — higher rebates"],
              ["VRF systems", "Variable", "Variable", "AHRI 1230 IEER ≥ 16.5"],
            ]}
          />
          <p>
            The default <Code>DEFAULT_HP_RETROFIT</Code> preset (visible in
            the Retrofit tab as &quot;Apply standard HP&quot;) uses SEER2 16
            / HSPF2 8.5 — exactly the ENERGY STAR threshold. This produces
            realistic mid-range retrofit savings for most U.S. climates.
          </p>

          <H4>5a. ENERGY STAR vs DOE federal minimum</H4>
          <p>
            DOE federal minimum (the legal floor): SEER2 14.0 / HSPF2 7.5.
            ENERGY STAR (the rebate floor): SEER2 16.0 / HSPF2 8.5. The
            efficiency gap is meaningful — at 1100 cooling EFLH (CZ4A NYC),
            SEER2 14 → 16 saves ~12% kWh on cooling alone. ENERGY STAR
            equipment also typically uses inverter compressors (the federal
            min can still be single-stage), which deliver better part-load
            efficiency the rating doesn&apos;t fully capture.
          </p>
        </Prose>
      </Card>

      {/* ─── NEEP CCHP ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>6. NEEP Cold Climate ASHP — for CZ5A+ retrofits</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            The Northeast Energy Efficiency Partnerships (NEEP) maintains
            the <Em>Cold Climate Air Source Heat Pump (CC-ASHP) Specification</Em>
            and Product List — a public registry of mini-split HPs that retain
            usable heating capacity at very low outdoor temperatures.
          </p>

          <H4>6a. CC-ASHP qualification criteria</H4>
          <Table
            head={["Criterion", "Threshold", "Why it matters"]}
            rows={[
              ["HSPF2 (Region IV)", "≥ 10.0", "Higher seasonal efficiency than ENERGY STAR floor"],
              ["Capacity at 5°F", "≥ 70% of nameplate (47°F rating)", "Standard HPs lose ~50% of capacity at 5°F"],
              ["COP at 5°F", "≥ 1.75", "Net usable heating at very cold outdoor temps"],
              ["Variable-speed compressor", "Required", "Modulates 25–100% to track varying loads"],
              ["AHRI Certificate", "Required", "Must be third-party rated"],
            ]}
          />
          <p>
            A standard HSPF2 8.5 mini-split installed in CZ5A (Chicago) or
            colder will lose capacity faster than the load drops, eventually
            requiring electric resistance backup that wipes out the heat-pump
            efficiency advantage. A NEEP-listed CC-ASHP retains capacity
            through the design temperature, eliminating most or all of the
            backup-resistance share.
          </p>

          <H4>6b. When the cold-climate HP is required</H4>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>CZ5A+ retrofits without backup resistance:</strong>{" "}
              required for full electrification
            </li>
            <li>
              <strong>Buildings without a gas connection:</strong> required
              for heat-pump-only operation in any cold climate
            </li>
            <li>
              <strong>NYSERDA Clean Heating + Cooling rebate program:</strong>{" "}
              CC-ASHP qualification = $1,000–$2,000 per ton additional rebate
            </li>
            <li>
              <strong>MassSave heat-pump rebate:</strong> CC-ASHP required
              for the &quot;whole-home&quot; tier
            </li>
          </ul>

          <Callout>
            <strong>Calculator impact:</strong> the engine flags <Em>info</Em>-
            level when a standard mini-split is configured in CZ5A+, suggesting
            the user switch to the <Code>ccshp</Code> archetype. The default
            HSPF2 10.5 used by <Code>ccshp</Code> is the median of NEEP CC-ASHP
            list ratings.
          </Callout>
        </Prose>
      </Card>

      {/* ─── DOE BUILDING AMERICA ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>7. DOE Building America — multifamily HVAC benchmarks</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            DOE Building America publishes whole-building performance
            benchmarks for residential building types based on metered data
            from thousands of homes. For multifamily HVAC the relevant
            energy use intensity (EUI) ranges are:
          </p>
          <Table
            head={[
              "Equipment vintage / archetype",
              "Cooling EUI (kWh/apt/yr)",
              "Heating EUI (kWh/apt/yr)",
              "Total HVAC EUI (kWh/apt/yr)",
            ]}
            rows={[
              ["PTAC + resistance, CZ4A (NYC)", "1,000–1,800", "5,000–8,000", "6,000–9,800"],
              ["PTAC + resistance, CZ5A (Chicago)", "700–1,200", "7,000–10,000", "7,700–11,200"],
              ["Mini-split HP, CZ4A", "600–1,100", "1,800–3,000", "2,400–4,100"],
              ["Mini-split HP, CZ5A", "400–800", "2,500–4,000", "2,900–4,800"],
              ["CC-ASHP, CZ5A", "400–800", "2,000–3,200", "2,400–4,000"],
              ["Window AC + resistance, CZ4A", "1,200–2,200", "5,500–8,500", "6,700–10,700"],
            ]}
          />

          <H4>7a. What drives the spread within a vintage</H4>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Apartment size + occupant count</strong> — a 600 sf
              studio runs ~50% of a 1,200 sf 2BR&apos;s HVAC load
            </li>
            <li>
              <strong>Setpoint discipline</strong> — occupants who hold 72°F
              year-round consume 30–50% more than those tolerating 68°F
              winter / 76°F summer
            </li>
            <li>
              <strong>Envelope quality</strong> — pre-1980 buildings with R-9
              walls and single-pane windows can have 2× the heating EUI of
              code-built (R-19+) walls
            </li>
            <li>
              <strong>Common-wall geometry</strong> — center apartments
              (3 shared walls) consume less than corner apartments (2 shared
              walls)
            </li>
            <li>
              <strong>Appliance load + internal gains</strong> — kitchens
              with electric ranges + LED lighting see less heating need from
              waste heat than gas-range buildings
            </li>
          </ul>

          <Callout>
            <strong>Cross-validation:</strong> the calibration suite asserts
            that calculator outputs at default inputs land in the published
            EUI bands above for each archetype. If your output falls
            outside these bands, double-check apartment count, climate zone,
            and capacity entries — the engine math is unlikely to be wrong,
            but per-apartment capacity entered as whole-building (e.g., 60
            apartments × 9000 BTU/h entered as 540,000 BTU/h) will cause a
            60× error.
          </Callout>
        </Prose>
      </Card>

      {/* ─── EPA eGRID ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>8. EPA eGRID — grid carbon emission factors</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            EPA eGRID is the authoritative U.S. database for power-sector
            emission factors. The calculator uses eGRID 2022 (released 2024)
            factors for the chosen subregion. Carbon math is:
          </p>
          <Formula>{`annualCarbon (lb CO₂e) = annualKWh × emissionFactor[gridSubregion]`}</Formula>
          <Table
            head={["Subregion (eGRID 2022)", "lb CO₂e/kWh", "Region"]}
            rows={[
              ["NYUP (NY upstate)", "0.24", "Heavy hydro + nuclear (lowest in CONUS)"],
              ["CAMX (California)", "0.48", "California ISO"],
              ["NEWE (New England)", "0.52", "ISO-NE"],
              ["NWPP (Northwest)", "0.62", "Pacific NW (heavy hydro)"],
              ["RFCE (Mid-Atlantic)", "0.65", "PJM East — PA/NJ/MD/DC"],
              ["SRSO (Southeast)", "0.82", "AL/GA/MS"],
              ["FRCC (Florida)", "0.83", "Florida"],
              ["ERCT (Texas)", "0.83", "ERCOT"],
              ["MROW (Upper MW)", "1.04", "MN/WI/IA/ND/SD"],
              ["RMPA (Rockies)", "1.10", "CO/WY heavy coal"],
            ]}
          />
          <Callout>
            <strong>Why this matters for retrofits:</strong> a heat-pump
            retrofit replacing electric resistance heat saves identical kWh
            regardless of grid mix, but its <Em>carbon</Em> savings scale with
            the eGRID factor. A 100,000 kWh/yr resistance-to-HP swap saves
            <Em> 24,000 lb CO₂e</Em>/year in upstate NY (NYUP) but{" "}
            <Em>110,000 lb</Em> in the Upper Midwest (MROW). For full
            electrification advocacy, picking the subregion accurately
            matters more than picking the equipment efficiency tier.
          </Callout>
          <p>
            Switching FROM resistance heat (where 1 kWh in = 1 kWh out) TO a
            heat pump (where 1 kWh in = 2.5–4 kWh out) cuts grid kWh by
            60–75% on the heating side. If the grid is dirty (MROW, RMPA),
            the absolute carbon savings are much larger than on a clean grid.
            Counterintuitively, dirty-grid regions have the biggest carbon
            wins from electrification when paired with heat pumps — the
            inefficiency of resistance heat dwarfs the dirty-grid penalty.
          </p>
        </Prose>
      </Card>

      {/* ─── ASSUMPTIONS ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>9. Calculator assumptions</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Assumptions baked into the engine — call these out in any report
            so reviewers know what to challenge:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>EFLH method (single-bin annual screening).</strong>{" "}
              No hourly simulation. Captures climate × efficiency well at the
              annual scale; misses peak-load nuances and capacity derating
              at extreme ambients.
            </li>
            <li>
              <strong>Per-apartment uniform equipment.</strong> Every
              apartment is assumed to run the same equipment spec. For
              mixed-equipment buildings (some PTACs, some retrofits), run
              the calc twice and add.
            </li>
            <li>
              <strong>Climate-zone EFLH lookup.</strong> Single representative
              city per zone (Miami / Houston / Phoenix / Atlanta / LA / SF /
              NYC / Seattle / Chicago / Denver / Minneapolis / Duluth).
              Buildings in the same zone but different microclimates may see
              ±20% variation around the lookup value.
            </li>
            <li>
              <strong>HSPF2 used at face value.</strong> No additional climate
              derate. AHRI&apos;s HSPF2 testing simulates DOE Region IV
              (moderate climate); cold climates see lower seasonal COP than
              the rating suggests. The methodology callout in the Equipment
              tab guides users to enter HSPF2 values that already reflect a
              cold-climate derate, or to use the <Code>ccshp</Code>{" "}
              archetype (HSPF2 10.5 default).
            </li>
            <li>
              <strong>Resistance backup not modeled separately.</strong>{" "}
              For HPs in cold climates that need supplemental electric
              resistance heat at low ambients, the user&apos;s entered HSPF2
              should already incorporate this (HSPF2 testing includes backup
              resistance hours). Most CCHPs minimize backup; standard
              mini-splits in CZ6+ may lose 20–30% to resistance even though
              it&apos;s already in the HSPF2 number.
            </li>
            <li>
              <strong>No latent load split.</strong> The cooling EFLH includes
              both sensible (temperature) and latent (moisture) load. Humid
              climates (1A, 2A, 3A) get extra latent that pushes EFLH up —
              already captured in the climate-zone lookup.
            </li>
            <li>
              <strong>Steady-state setpoints.</strong> No occupancy-based
              setbacks, no demand response, no economizer free-cooling. If
              your building has these, override EFLH with measured run hours.
            </li>
            <li>
              <strong>1 ton refrigeration = 12,000 BTU/h.</strong> Standard
              tonnage convention. The calculator surfaces &quot;connected
              tons&quot; as a sanity-check rollup vs the apartment count.
            </li>
            <li>
              <strong>AHRI 210/240 ratings include ~5% duct loss for ducted
              systems.</strong> A SEER2 16 ducted central split is tested
              with representative ductwork in conditioned space already
              accounting for typical distribution losses. For ducts in
              unconditioned space (rare in MF but possible — attic-mounted
              AHUs in low-rise garden apartments), real performance can be
              10–20% below rated. Manually derate the entered SEER2 / HSPF2
              if your duct system is in unconditioned or leaky space.
            </li>
          </ul>
        </Prose>
      </Card>

      {/* ─── LIMITATIONS ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>10. Known limitations</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Things the calculator does <Em>not</Em> currently model. Treat
            results as approximate when these factors are material:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Peak demand charges.</strong> Some commercial electric
              tariffs charge for peak kW demand (especially during summer
              cooling peaks). Mini-split HPs typically draw 1.5–3 kW per
              apartment at peak. For 60+ apartments running concurrently in
              an afternoon peak, demand charges can be 10–25% of the total
              electric bill. The calculator uses energy-only ($/kWh).
            </li>
            <li>
              <strong>Defrost cycle penalties (cold-climate HPs).</strong>{" "}
              Mini-split HPs in CZ4A+ enter defrost cycles ~30–60× per heating
              season, each cycle running auxiliary resistance for 5–15 min.
              HSPF2 testing captures this implicitly, but real-world defrost
              losses can exceed the rating in very cold or very humid winters.
            </li>
            <li>
              <strong>Indoor air quality + ventilation.</strong> The
              calculator models conditioning energy only. Ventilation
              (ASHRAE 62.1 / 62.2 mandatory rates) consumes 200–500 kWh/yr
              per apartment depending on rate + ERV/HRV use — captured by the
              future ventilation calculator, not here.
            </li>
            <li>
              <strong>Refrigerant leakage / GWP.</strong> Mini-split HPs use
              R-410A (GWP 2,088) or newer R-32 (GWP 675). Leakage rates of
              2–5%/yr add 50–150 lb CO₂e/yr per apartment in scope-1 emissions
              not captured by the eGRID-based scope-2 carbon math here.
            </li>
            <li>
              <strong>HVAC interaction with envelope retrofits.</strong> A
              window retrofit reducing infiltration, or insulation upgrade,
              shrinks the underlying load — your existing HVAC equipment
              becomes oversized and loses part-load efficiency. The
              calculator runs each scenario at the entered capacity without
              considering whether that capacity is well-matched to the load.
            </li>
            <li>
              <strong>Multi-zone vs single-zone mini-splits.</strong> Multi-
              zone units (one outdoor unit, multiple indoor heads) typically
              rate 1–2 SEER2 / HSPF2 lower than single-zone equivalents at
              the same nameplate. The calculator treats either at face value.
            </li>
            <li>
              <strong>Installation labor + commissioning.</strong> Real
              retrofit capex includes installation labor (often 40–60% of
              equipment cost), refrigerant line pulls, electrical service
              upgrades, and commissioning. Enter a conservative installed
              cost as <Code>capex</Code> in the Retrofit tab&apos;s proposed
              side if you want simple-payback to reflect installed cost.
            </li>
          </ul>
        </Prose>
      </Card>

      {/* ─── REFERENCES ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>11. References</CardTitle>
        </CardHeader>
        <Prose>
          <ul style={{ marginLeft: 20, lineHeight: 1.85, fontSize: 12.5 }}>
            <li>
              <strong>ASHRAE 90.1-2022</strong> — <em>Energy Standard for
              Buildings Except Low-Rise Residential Buildings</em>, Section
              6 (HVAC). §6.4 minimum efficiency tables; Appendix G3.1.3.10
              EFLH for residential equipment.
            </li>
            <li>
              <strong>AHRI 210/240-2023</strong> — <em>Performance Rating of
              Unitary Air-Conditioning &amp; Air-Source Heat Pump Equipment</em>.
              SEER2 / HSPF2 testing conditions and reporting.
            </li>
            <li>
              <strong>AHRI 310/380</strong> — <em>Standard for Packaged
              Terminal Air-Conditioners and Heat Pumps</em>. EER / COP
              testing for PTAC / PTHP.
            </li>
            <li>
              <strong>AHRI 1230</strong> — <em>Performance Rating of
              Variable Refrigerant Flow Multi-Split AC and HP Equipment</em>.
              IEER for VRF (out of scope here, but referenced for cross-tier
              comparison).
            </li>
            <li>
              <strong>ENERGY STAR Central AC and HP Specification v6.1</strong>{" "}
              (EPA, 2023). Rebate-tier minimum efficiencies.
            </li>
            <li>
              <strong>NEEP Cold Climate ASHP Specification + Product List</strong>{" "}
              (Northeast Energy Efficiency Partnerships, 2024 update). Cold-
              climate HP qualification criteria.
            </li>
            <li>
              <strong>DOE Federal Minimum HVAC Efficiency Standards
              (10 CFR 430)</strong> — 2023 federal floors for residential HVAC.
            </li>
            <li>
              <strong>DOE Building America Multifamily HVAC Reference
              Designs</strong> — published EFLH and EUI ranges by climate
              zone and equipment archetype.
            </li>
            <li>
              <strong>ASHRAE Handbook — HVAC Systems and Equipment, Ch. 18
              (Variable Refrigerant Flow)</strong> — VRF design and rating
              context.
            </li>
            <li>
              <strong>EPA eGRID 2022</strong> (released 2024) — power-sector
              subregion emission factors.
            </li>
            <li>
              <strong>NYSERDA Clean Heating &amp; Cooling Program</strong> —
              CC-ASHP rebate criteria and field-measured savings tracking.
            </li>
            <li>
              <strong>MassSave Heat Pump Program — Field Studies (2020–2024)</strong>{" "}
              — measured retrofit savings ranges informing the 35–65%
              kWh-reduction calibration band.
            </li>
            <li>
              <strong>ConEd / NYSERDA Multifamily Electrification Field
              Studies</strong> — utility-program savings data used to
              cross-check the PTAC → mini-split retrofit savings range.
            </li>
            <li>
              <strong>ASHRAE Standard 62.1 / 62.2</strong> — ventilation
              minimum rates (referenced for the ventilation interaction
              limitation; not applied here).
            </li>
          </ul>
        </Prose>
      </Card>

      {/* ─── CALIBRATION ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>12. Calibration status</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            35 published-reference assertions in{" "}
            <Code>src/lib/inunit-hvac/calibration.test.ts</Code> run on every
            CI build. Categories:
          </p>
          <Table
            head={["Test category", "Cases", "Reference"]}
            rows={[
              ["Engineering math (deterministic)", "5", "Internal — formula sanity"],
              ["ASHRAE 90.1-2022 §6.4 minimum efficiency", "4", "ASHRAE 90.1-2022 §6.4.1.4"],
              ["ENERGY STAR / NEEP retrofit savings", "4", "ENERGY STAR Central AC/HP v6.1; NEEP CCHP list"],
              ["DOE Building America EUI / EFLH bands", "4", "DOE BA MF HVAC reference designs"],
              ["Climate-sensitivity integration", "3", "ASHRAE 90.1 Appendix G3"],
              ["Monthly model fairness", "3", "Internal — invariant"],
              ["Compare-tab fairness", "1", "Internal — regression fence"],
              ["Determinism", "1", "Internal — guards Math.random()"],
              ["Ducted central split — engineering math", "3", "AHRI 210/240; ENERGY STAR Central AC/HP v6.1"],
              ["Vintage comparison (same-archetype efficiency upgrade)", "2", "AHRI 210/240; DOE 2023 SEER2 / HSPF2 conversion"],
              ["Central AC+resistance → central HP retrofit", "2", "MassSave / NYSERDA field studies"],
              ["Central split — compliance flags", "3", "DOE Federal Min; ENERGY STAR; Electrification advisory"],
            ]}
          />
          <Callout tone="success">
            <strong>Status as of engine v1.1.0:</strong> all 35 in-unit HVAC
            calibration assertions pass. The default scenario (PTAC +
            resistance, CZ4A NYC, 60 apartments) produces outputs within the
            DOE Building America EUI bands documented above; the standard HP
            retrofit preset reproduces the 35–65% kWh reduction range
            measured in MassSave + NYSERDA field studies; and the ducted
            central HP / AC+resistance archetypes added in v1.1.0 reproduce
            same-archetype vintage-comparison savings (25–40% on a SEER2 13
            → SEER2 18 / HSPF2 7 → HSPF2 10 upgrade in CZ4A) within ENERGY
            STAR field-data tolerance.
          </Callout>
        </Prose>
      </Card>
    </div>
  );
}

export const MethodologyTab = memo(MethodologyTabInner);
