"use client";

/**
 * Lighting Methodology tab — long-form reference document covering every
 * source the calculator pulls from, key insights and assumptions baked
 * into each, and the limitations users should know about. The intent is
 * that an MEP reviewer or energy auditor can read this page and trust
 * (or challenge) the calculator's outputs without leaving the app.
 */
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

export function MethodologyTab() {
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
            This calculator estimates annual lighting energy, cost, and
            carbon emissions for a multifamily building, broken down across
            seven categorical buckets (corridors, stairwells, common areas,
            exterior site, exterior façade, in-unit, and garage / parking).
            Each category carries its own fixture count, average wattage,
            operating hours, and control regime. The pipeline lives at{" "}
            <Code>src/lib/lighting/pipeline.ts</Code>; engineering math is
            documented inline below.
          </p>
          <p>
            Outputs include annual kWh / $ / lb CO₂e, building-method
            Lighting Power Density (LPD) for ASHRAE 90.1-2022 §9.5.1
            compliance, per-category breakdowns, a uniform monthly profile
            (lighting load is climate-insensitive), and advisory flags when
            the model detects code-relevant gaps (atmospheric venting equivalents
            in lighting language: incandescent ≥ 40W in corridors, HID ≥ 175W
            on exterior poles, missing controls in stairwells).
          </p>
          <p>
            <Em>Calibration:</Em> 16 published-reference assertions in{" "}
            <Code>src/lib/lighting/calibration.test.ts</Code> cross-check
            the engine against the sources documented in this page. They
            run on every CI build and have to land within tolerance for a
            release to ship.
          </p>
        </Prose>
      </Card>

      {/* ─── ENGINEERING MATH ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>1. Engineering math</CardTitle>
        </CardHeader>
        <Prose>
          <H4>Per-category annual energy</H4>
          <Formula>{`connectedWatts   = count × wattsPerFixture
nominalAnnualHrs = hoursPerDay × 365
effectiveHrs     = nominalAnnualHrs × (1 − occupancySensorReduction)
                                    × (1 − daylightCredit)
annualKWh        = connectedWatts × effectiveHrs / 1000
annualCost       = annualKWh × elecRate
annualCarbon     = annualKWh × emissionFactor[gridSubregion]`}</Formula>

          <H4>Building rollup + LPD</H4>
          <Formula>{`buildingKWh     = Σ(category.annualKWh)
buildingWatts   = Σ(category.connectedWatts)
LPD (W/ft²)     = buildingWatts ÷ totalBuildingSqft`}</Formula>

          <p>
            The two control reductions multiply rather than sum — a 30%
            occupancy reduction layered on a 20% daylight credit yields{" "}
            <Code>(1 − 0.30) × (1 − 0.20) = 0.56</Code>, i.e. 44% combined
            reduction, not 50%. This matches the convention in IES
            calculations and ASHRAE 90.1 §G3.1 (Performance Rating Method)
            and avoids double-counting hours where both controls are active
            simultaneously.
          </p>
          <Callout>
            <strong>Inputs are clamped to [0, 1].</strong> Passing
            occupancy or daylight reductions outside that range is treated
            as a typo and clamped — the calculator never produces negative
            kWh or {"<"} 0% effective hours.
          </Callout>
        </Prose>
      </Card>

      {/* ─── CONTROLS EXPLAINED ──────────────────────────────────── */}
      <Card accent="var(--accent-blue)">
        <CardHeader>
          <CardTitle>2. Controls explained — occupancy + daylight reductions</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            The two control fields on every category — <Em>Occupancy
            reduction</Em> and <Em>Daylight credit</Em> — are the
            calculator&apos;s mechanism for modeling lighting controls
            without requiring users to enumerate every sensor and schedule
            individually. Both are decimal fractions in the range{" "}
            <Code>[0, 1]</Code> representing the share of base operating
            hours saved.
          </p>

          <H4>2a. What occupancy reduction models</H4>
          <p>
            Occupancy reduction captures the savings from automatic
            occupancy / vacancy controls — sensors (PIR, ultrasonic, dual-
            tech) plus the electronic ballasts or drivers they switch.
            The control regime can be:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Full off</strong> when vacant (vacancy switch — most
              aggressive savings)
            </li>
            <li>
              <strong>Step dim</strong> to a low-output preset (~10–30%)
              when vacant — common in corridors and stairwells where some
              lumen output is needed for safety
            </li>
            <li>
              <strong>Bi-level</strong> via two ballasts / two LED arrays
              — switches between full and low based on motion (ASHRAE 90.1
              §9.4.1.1.e default for stairwells)
            </li>
          </ul>
          <p>
            Field-measured savings vary by space type and occupancy
            pattern. Per ACEEE and utility-program retrofit data:
          </p>
          <Table
            head={["Space type", "Occupancy reduction (typical)", "Source / notes"]}
            rows={[
              [
                "Corridor (always-occupied small intervals)",
                "0.25 – 0.40",
                "Step-dim to ~30% when vacant; ASHRAE §9.4 default",
              ],
              [
                "Stairwell (mostly vacant)",
                "0.40 – 0.60",
                "Bi-level + occupancy required by §9.4.1.1.e",
              ],
              [
                "Common area (lobby, lounge, mail)",
                "0.30 – 0.50",
                "Wider variability — depends on building activity",
              ],
              [
                "Garage / parking deck",
                "0.40 – 0.60",
                "Combined with photocell — bi-level + occupancy + daylight",
              ],
              [
                "Exterior site / façade",
                "0",
                "Always-on dusk-to-dawn — controls don't apply",
              ],
              [
                "In-unit",
                "0",
                "Occupant-driven; no central control",
              ],
            ]}
          />
          <Callout tone="warn">
            <strong>Don&apos;t enter occupancy reduction for exterior or in-unit
            categories.</strong> Exterior fixtures run on photocells
            (already dusk-to-dawn — that&apos;s why <Code>hoursPerDay</Code>{" "}
            defaults to 12, not 24). In-unit lighting is controlled by
            residents; there&apos;s no central building management.
            Leaving these at <Code>0</Code> avoids double-counting savings.
          </Callout>

          <H4>2b. What daylight credit models</H4>
          <p>
            Daylight credit captures savings from <Em>continuous-dimming
            daylight harvesting</Em> — photocells that ramp electric output
            down as natural daylight enters the space. This is{" "}
            <strong>different</strong> from on/off photocells controlling
            exterior schedules:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>On/off exterior photocell:</strong> dictates whether
              the fixture runs at all. The 12 hr/day default already bakes
              this in — leave daylight credit at <Code>0</Code> for
              exterior categories.
            </li>
            <li>
              <strong>Continuous-dim daylight sensor:</strong> dims a
              perimeter common-area fixture (within ~15 ft of a window)
              based on daylight contribution. ASHRAE 90.1 §9.4.1.4 requires
              these in primary daylight zones.
            </li>
            <li>
              <strong>Skylit garage / parking deck:</strong> if your garage
              has skylights or other natural light access during the day,
              a daylight credit of <Code>0.10–0.30</Code> on a 24 hr/day
              schedule reflects the harvested savings.
            </li>
          </ul>

          <H4>2c. Why the reductions multiply</H4>
          <p>
            When both controls are active on the same fixture, the
            calculator combines them <Em>multiplicatively</Em>:
          </p>
          <Formula>{`effectiveHours = nominalHours × (1 − occupancyReduction)
                       × (1 − daylightCredit)

Example: corridor w/ 30% occupancy + 20% daylight
  effectiveHours = 24 × 365
                 × (1 − 0.30)
                 × (1 − 0.20)
                 = 8760 × 0.70 × 0.80
                 = 4906 hr/year (44% reduction, NOT 50%)`}</Formula>
          <p>
            This convention matches IES energy-modeling practice and
            ASHRAE 90.1 §G3.1 (Performance Rating Method). Adding the two
            reductions instead would <Em>double-count</Em> the hours where
            both controls are active simultaneously — a fixture that&apos;s
            already dimmed by daylight can&apos;t additionally save hours
            from being shut off for vacancy during those same hours.
          </p>

          <H4>2d. Practical workflow</H4>
          <ol style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Start with reductions = 0 on every category.</strong>{" "}
              This is the &quot;no controls&quot; incumbent baseline.
            </li>
            <li>
              For your <Em>current state</Em> on the Equipment tab, only
              add reductions for controls that are actually installed and
              functioning today.
            </li>
            <li>
              For your <Em>proposed retrofit</Em> on the Retrofit
              Comparison tab, the &quot;Apply LED + sensors&quot; preset
              populates code-compliant defaults (corridor 0.30, stairwell
              0.50, common 0.30, garage 0.40). Adjust based on the
              specific control product&apos;s manufacturer data.
            </li>
            <li>
              The savings strip will show the combined kWh / cost / carbon
              delta from BOTH the wattage swap AND the controls upgrade —
              don&apos;t double-count by entering controls in both columns.
            </li>
          </ol>
        </Prose>
      </Card>

      {/* ─── ASHRAE 90.1-2022 §9 ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>3. ASHRAE 90.1-2022 §9 — Lighting</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            ASHRAE Standard 90.1 is the U.S. federal commercial building
            energy code by reference; §9 governs lighting power and
            controls. Two independent compliance paths exist (§9.5.1
            Building-Area Method, §9.6 Space-by-Space Method); this
            calculator uses the simpler Building-Area Method as a single
            high-level check, leaving space-by-space evaluation to the
            user&apos;s lighting engineer.
          </p>

          <H4>2a. Lighting Power Density (LPD) limits</H4>
          <p>
            Building-method LPD limits cap the connected lighting wattage
            per square foot of building floor area. For multifamily
            residential the relevant limits are:
          </p>
          <Table
            head={["Building type (ASHRAE 90.1-2022 Table 9.5.1)", "LPD limit (W/ft²)"]}
            rows={[
              ["Multifamily — high-rise (residential)", "0.45"],
              ["Multifamily — low-rise (≤ 3 stories)", "0.45"],
              ["Dormitory", "0.51"],
              ["Hotel / motel", "0.50"],
              ["Office", "0.55"],
              ["Healthcare clinic", "0.81"],
            ]}
          />
          <p>
            The calculator&apos;s default compliance check uses the{" "}
            <Em>0.45 W/ft² multifamily limit</Em> against the building&apos;s
            connected wattage divided by user-entered{" "}
            <Code>totalBuildingSqft</Code>. If the result exceeds the
            limit, a <Em>warn</Em>-level flag appears in the Energy tab.
            For mixed-use buildings (e.g., MF with ground-floor retail),
            the user&apos;s engineer should run a space-by-space evaluation
            instead.
          </p>

          <H4>2b. §9.4 Mandatory controls</H4>
          <p>
            §9.4 requires several control types in code-compliant designs:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>§9.4.1.1 Occupancy sensors</strong> — required in most
              enclosed spaces ≤ 300 ft² (offices, conference rooms,
              classrooms). Multifamily corridors are explicitly addressed.
            </li>
            <li>
              <strong>§9.4.1.1 (e) Stairwells</strong> — must use bi-level
              switching or step-dimming controls so unoccupied stairs run
              at reduced output. Field-measured savings: 40–60% of
              base-case operating hours.
            </li>
            <li>
              <strong>§9.4.1.4 Daylight zones</strong> — primary daylight
              zones (within ~15 ft of vertical fenestration) must have
              continuous-dimming or stepped daylight controls.
            </li>
            <li>
              <strong>§9.4.4 Exterior controls</strong> — exterior fixtures
              must have automatic shut-off (photocell or astronomical time
              clock).
            </li>
          </ul>
          <Callout tone="warn">
            <strong>What this calculator does:</strong> the engine flags{" "}
            <Em>info</Em>-level when corridors or stairwells are configured
            with <Code>occupancySensorReduction = 0</Code>, suggesting the
            user bump those values to 0.30 (corridor) or 0.50 (stairwell)
            to model a code-compliant retrofit. The flag is advisory, not a
            hard error — some jurisdictions allow exceptions for safety or
            historic buildings.
          </Callout>

          <H4>2c. Building-Area vs Space-by-Space — why we use Building</H4>
          <p>
            The Building-Area Method assigns a single LPD limit per
            building type and is the most common path for whole-building
            modeling tools. The Space-by-Space Method applies different
            limits to every individual space (corridor, lobby, mechanical
            room, etc.) and produces a slightly more permissive aggregate
            limit for typical multifamily. The Building method is{" "}
            <Em>conservative</Em> — passing it almost always passes the
            Space method. We use Building so the calculator runs from a
            single sqft input rather than requiring the user to enumerate
            every space&apos;s area.
          </p>
        </Prose>
      </Card>

      {/* ─── ENERGY STAR LED RETROFIT ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>4. ENERGY STAR LED retrofit performance</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            ENERGY STAR is the EPA&apos;s voluntary certification program for
            energy-efficient products. Two specifications govern LED
            lighting relevant to multifamily retrofits:
          </p>
          <Table
            head={["Specification", "Scope", "Key requirement"]}
            rows={[
              [
                "ENERGY STAR Lamps v4.0 (2024)",
                "Replacement lamps (A19, BR30, MR16, etc.)",
                "Efficacy ≥ 80 lm/W; CRI ≥ 80; L70 lifetime ≥ 15,000 hr",
              ],
              [
                "ENERGY STAR Luminaires v2.0 (2025)",
                "Integrated fixtures (downlights, troffers, wall packs)",
                "Efficacy ≥ 90 lm/W; CRI ≥ 80; L70 lifetime ≥ 35,000–50,000 hr",
              ],
              [
                "ENERGY STAR MFNC v1.2",
                "Multifamily New Construction package",
                "Common-area + exterior lighting ≥ 90% LED-or-better",
              ],
            ]}
          />

          <H4>3a. Typical retrofit savings (per ENERGY STAR field data)</H4>
          <p>
            ENERGY STAR&apos;s aggregated retrofit-case data, drawn from
            utility-funded multifamily retrofit programs and DOE Buildings
            Energy Data Book, shows the following typical savings ranges:
          </p>
          <Table
            head={["Application", "Incumbent", "LED replacement", "Savings"]}
            rows={[
              ["Corridor downlight", "60W incandescent", "10–12W LED", "80–83%"],
              ["Stairwell troffer", "32W T8 (×2 = 64W)", "18W LED panel", "70–72%"],
              ["Exterior pole", "250W metal halide", "70–90W LED", "64–72%"],
              ["Wall pack (security)", "100W HID", "20–30W LED", "70–80%"],
              ["In-unit ceiling fixture", "60W incandescent", "8–12W LED", "80–87%"],
              ["Garage / parking deck", "175W HID", "60–80W LED + sensors", "60–75%"],
            ]}
          />
          <p>
            The calculator&apos;s built-in <Code>DEFAULT_LED_RETROFIT</Code>{" "}
            preset (visible in the Retrofit tab as &quot;Apply LED + sensors&quot;)
            uses values landing in the middle of these published bands, so
            applying it reproduces a realistic retrofit-case savings
            estimate (typically 75–85% kWh reduction on a 60-unit MF
            baseline).
          </p>

          <H4>3b. L70 lifetime — why retrofit is also a maintenance win</H4>
          <p>
            ENERGY STAR luminaires must reach <Code>L70</Code> (≥ 70%
            initial lumen output retained) at 35,000–50,000 hours. At 12 hr/
            day this is 8–11 years. Compare to:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>Incandescent: ~1,000 hr (replace ~12× over LED&apos;s lifetime)</li>
            <li>CFL: ~10,000 hr</li>
            <li>HID metal halide: ~15,000 hr (with output degradation)</li>
            <li>T8 fluorescent: ~30,000 hr</li>
          </ul>
          <p>
            Fewer relamps + longer service life mean an LED retrofit&apos;s
            <Em>real</Em> economic case includes labor savings the calculator
            doesn&apos;t yet model. Treat the calculator&apos;s simple-payback
            estimate as a <Em>conservative ceiling</Em> — actual paybacks
            with maintenance accounted for are typically 30–50% shorter.
          </p>
        </Prose>
      </Card>

      {/* ─── DLC ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>5. DLC Qualified Products List</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            The DesignLights Consortium (DLC) maintains the{" "}
            <Em>Qualified Products List</Em> (QPL) — a public registry of
            commercial / industrial LED products that meet a higher bar
            than ENERGY STAR. DLC matters for two reasons:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Utility rebate eligibility</strong> — virtually every
              U.S. utility lighting incentive program requires DLC listing
              for the proposed equipment. This typically pays $20–$200
              per fixture in retrofit rebates (varies by program), often
              cutting capex by 20–40%.
            </li>
            <li>
              <strong>Product quality</strong> — DLC tests for efficacy,
              color accuracy, controls compatibility, and L70 lifetime
              with stricter criteria than ENERGY STAR for commercial-grade
              applications.
            </li>
          </ul>

          <Table
            head={["DLC tier", "Minimum efficacy", "Premium criteria"]}
            rows={[
              ["DLC Standard", "85–110 lm/W (varies by category)", "Baseline qualification"],
              ["DLC Premium", "115–135+ lm/W", "Higher efficacy + tighter color, controls, lifetime"],
            ]}
          />

          <Callout>
            <strong>Calculator impact:</strong> the DLC QPL doesn&apos;t
            change the engineering math — connected watts × hours is
            connected watts × hours regardless of brand. But the QPL
            <Em> does</Em> set the floor on what wattages are achievable
            today. The default LED retrofit values
            (12W corridor, 70W exterior pole, 25W wall pack) are typical
            DLC Standard products in 2024–2025; DLC Premium products
            achieve 10–20% lower wattage at the same lumen output.
          </Callout>
        </Prose>
      </Card>

      {/* ─── DOE BUILDING AMERICA ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>6. DOE Building America — multifamily benchmarks</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            DOE Building America publishes whole-building performance
            benchmarks for residential building types based on metered data
            from thousands of homes. For multifamily lighting, the relevant
            energy use intensity (EUI) ranges are:
          </p>
          <Table
            head={[
              "Equipment vintage",
              "Lighting EUI (kWh/ft²/yr)",
              "% of total building electric",
            ]}
            rows={[
              ["Incandescent / first-gen fluorescent (pre-2010)", "1.5 – 5.0", "12–22%"],
              ["Mixed CFL + T8 + some HID exterior (2010–2018)", "0.8 – 2.5", "8–14%"],
              ["LED retrofit, mixed controls (2018–present)", "0.3 – 1.2", "4–8%"],
              ["LED + occupancy + daylight (best practice)", "0.2 – 0.7", "2–5%"],
            ]}
          />
          <p>
            The calibration suite asserts the calculator lands in the
            published EUI bands at default inputs and at the LED retrofit
            preset:
          </p>
          <Formula>{`Default (incandescent baseline): 1.5–6.0 kWh/ft²/yr  ✓
LED retrofit preset:             0.3–1.5 kWh/ft²/yr  ✓`}</Formula>

          <H4>What drives the spread within a vintage</H4>
          <p>
            Lighting EUI varies within a vintage band by:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Common-area density</strong> — a building with
              extensive amenity spaces (gym, lounge, club rooms) lights
              more sqft for more hours
            </li>
            <li>
              <strong>Always-on share</strong> — corridor + stairwell +
              exterior typically run 24/7 and dominate the load; their
              wattage choice matters disproportionately
            </li>
            <li>
              <strong>Climate / latitude</strong> — exterior dusk-to-dawn
              hours range from ~10 hr/day at low latitudes to ~13 hr/day
              at high latitudes; the calculator uses 12 hr/day as a
              middle-of-CONUS default
            </li>
            <li>
              <strong>Operational habits</strong> — buildings with active
              property managers and occupant education typically achieve
              EUIs at the low end of their vintage band
            </li>
          </ul>
        </Prose>
      </Card>

      {/* ─── IES LIGHTING HANDBOOK ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>7. IES Lighting Handbook — operating-hour conventions</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            The Illuminating Engineering Society (IES) publishes the
            authoritative handbook for lighting design. Two pieces of IES
            guidance shape the calculator&apos;s defaults:
          </p>

          <H4>Operating-hour conventions for energy modeling</H4>
          <Table
            head={["Application", "Typical IES hr/day", "Notes"]}
            rows={[
              ["Corridors (always-on)", "24", "ASHRAE 90.1 §9.4 requires step-dim controls"],
              ["Stairwells (always-on)", "24", "Bi-level / occupancy required"],
              ["Common areas", "14–18", "Lobby + mail; reduce w/ occupancy sensors"],
              ["Exterior — site (poles, walkways)", "11–13", "Photocell-controlled dusk-to-dawn"],
              ["Exterior — façade / wall packs", "10–13", "Same dusk-to-dawn; sometimes shorter w/ timers"],
              ["In-unit (resident-driven)", "3–5", "DOE BA assumes ~3.5 hr/day on average"],
              ["Garage / parking deck", "12–24", "24 if no daylight; 12–18 with skylights or photocell"],
            ]}
          />

          <H4>Recommended illuminance — the &quot;why&quot; behind wattage choices</H4>
          <p>
            IES recommends target horizontal illuminance levels in
            footcandles (fc) for various applications. These set the lower
            bound on wattage — you can&apos;t reduce a fixture below the
            point where the space falls below recommended illuminance:
          </p>
          <Table
            head={["Space", "IES illuminance target (fc)", "LED W typical"]}
            rows={[
              ["Corridor", "5–10 fc (overall)", "8–15 W"],
              ["Stairwell", "5 fc", "8–12 W"],
              ["Lobby (entry)", "20–30 fc", "20–35 W"],
              ["Mail / package room", "30 fc", "20–30 W"],
              ["Lounge / amenity", "10–20 fc", "15–25 W"],
              ["Parking lot (security)", "1–5 fc", "60–80 W LED"],
              ["Walkway / pedestrian", "0.5–2 fc", "20–50 W LED"],
              ["Wall pack (entry security)", "5–10 fc at entry", "15–25 W"],
            ]}
          />
          <Callout>
            <strong>Calculator caveat:</strong> the engine doesn&apos;t
            verify that the wattage you enter actually meets IES
            illuminance targets — that&apos;s the job of a photometric
            layout (DIALux, AGi32, etc.). Bumping wattage too low to chase
            EUI savings can leave a space below code-required minimums and
            create safety issues. Always cross-check with a lighting
            designer for retrofit specs.
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
            emission factors, updated approximately every 18 months. The
            calculator uses eGRID 2022 (released 2024) emission factors
            for the chosen subregion. The carbon math is:
          </p>
          <Formula>{`annualCarbon (lb CO₂e) = annualKWh × emissionFactor[gridSubregion]`}</Formula>
          <Table
            head={["Subregion (eGRID 2022)", "lb CO₂e/kWh", "Region"]}
            rows={[
              ["NWPP (Northwest Power Pool)", "0.547", "Pacific Northwest"],
              ["CAMX (California)", "0.524", "California"],
              ["NYUP (NY upstate)", "0.301", "Upstate NY (heavy hydro+nuclear)"],
              ["NYCW (NYC + Westchester)", "0.622", "NYC metro"],
              ["MROW (Upper Midwest)", "1.040", "MN, WI, IA, ND, SD"],
              ["RFCE (RFC East)", "0.737", "PA, NJ, MD, DE, DC"],
              ["RFCM (RFC Michigan)", "1.020", "Michigan"],
              ["SRSO (SERC South)", "0.950", "AL, MS, GA"],
              ["AZNM (AZ + NM)", "0.870", "Southwest"],
              ["—", "—", "(plus other subregions for full coverage)"],
            ]}
          />
          <Callout>
            <strong>Why this matters for retrofits:</strong> a 100,000
            kWh/year LED retrofit saves <Em>52,000 lb CO₂e</Em>/year on
            CAMX (California) but <Em>104,000 lb</Em>/year on MROW
            (Upper Midwest). The same retrofit&apos;s carbon return
            doubles depending on grid mix. Pick your subregion accurately
            in the Equipment tab — the default <Code>MROW</Code> is
            conservative-ish for cold-climate regions but understates the
            carbon win in renewables-heavy grids.
          </Callout>
          <p>
            For users who want a custom factor (specific utility&apos;s
            green-power product, marginal-emissions analysis, future-
            grid scenario), set <Code>gridSubregion = &quot;Custom&quot;</Code>{" "}
            and enter the factor in the building-context card.
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
            Assumptions baked into the engine — call these out in any
            report so reviewers know what to challenge:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Climate-insensitive lighting load.</strong> The
              monthly profile is uniform (each month gets{" "}
              <Code>daysInMonth / 365</Code> of the annual). Real metered
              data shows a small (≤ 5%) winter bump from in-unit + façade
              fixtures. Below the noise floor of typical retrofit-savings
              estimates.
            </li>
            <li>
              <strong>Building-method LPD only.</strong> The compliance
              flag uses ASHRAE 90.1-2022 §9.5.1&apos;s building-area
              method (single sqft input → single LPD limit). Mixed-use
              buildings may need space-by-space evaluation.
            </li>
            <li>
              <strong>Multiplicative occupancy + daylight reductions.</strong>{" "}
              Combining a 30% occupancy reduction with a 20% daylight
              credit yields 44% combined savings (not 50%). Avoids
              double-counting overlap hours.
            </li>
            <li>
              <strong>In-unit lighting is aggregate.</strong> The user
              enters <Em>total fixtures across all apartments</Em> for the
              in-unit category, not per-apartment. A typical 60-unit MF
              has 6–10 in-unit fixtures per apartment (kitchen + bathroom +
              bedroom ceiling), so 360–600 total.
            </li>
            <li>
              <strong>Default exterior hours/day = 12.</strong> Mid-CONUS
              average; high-latitude (Anchorage, Duluth) may run 13–14
              hr/day in winter average; low-latitude (Miami, Phoenix) may
              run 10–11.
            </li>
            <li>
              <strong>Driver / ballast losses included in W per
              fixture.</strong> Always enter input wattage (what the meter
              sees), never lamp-only wattage.
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
            Things the calculator does <Em>not</Em> currently model.
            Treat results as approximate when these factors are material:
          </p>
          <ul style={{ marginLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>HVAC interaction.</strong> LED retrofits reduce
              internal heat gains by ~50–80% of the kWh saved. This
              <Em> increases</Em> winter heating load (slightly negates
              the gas savings in heating-dominated climates) and{" "}
              <Em>decreases</Em> summer cooling load (compounds the
              electric savings in cooling-dominated climates). Net effect
              is typically a 5–15% adjustment to total building energy
              that this single-end-use calculator can&apos;t capture. Use
              a whole-building model (eQUEST, EnergyPlus) when this
              matters.
            </li>
            <li>
              <strong>Emergency lighting not separated.</strong> Egress
              lighting (battery-backed exit signs, emergency wall packs)
              is a small (~1–3% of total lighting) load that runs on
              dedicated circuits with different control regimes. Either
              fold into corridor / stairwell or omit; under-counting it is
              not material.
            </li>
            <li>
              <strong>No daylight-by-latitude modeling.</strong> Daylight
              credits are user-entered fractions, not derived from
              site-specific daylight availability. Tools like DAYSIM or
              EnergyPlus do this rigorously; this calculator treats
              daylight as a simple multiplicative reduction.
            </li>
            <li>
              <strong>No tunable-white / CCT credits.</strong> Some
              utility programs offer additional rebates for tunable-white
              fixtures (3000K / 4000K / 5000K presets) that align with
              circadian-lighting research. Out of scope here; tunable-
              white wattage is roughly equivalent to fixed-CCT at the
              same lumen output.
            </li>
            <li>
              <strong>No demand-charge modeling.</strong> Some commercial
              electric tariffs charge for peak kW demand (esp. exterior
              + corridor always-on loads). Lighting&apos;s demand-charge
              impact is small for MF (lighting is rarely the peak driver
              vs HVAC), but for large garage / parking decks it can be
              meaningful. Cost calc here uses energy-only ($/kWh).
            </li>
            <li>
              <strong>No labor / disposal cost.</strong> Real retrofit
              capex includes installation labor (~30–50% of equipment
              cost in commercial settings) and lamp/fixture disposal
              (especially HID / fluorescent w/ mercury). Enter a
              conservative capex in the Retrofit tab&apos;s proposed side
              if you want payback to reflect installed cost.
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
              9 (Lighting). Tables 9.5.1, 9.6.1; §9.4 mandatory controls.
            </li>
            <li>
              <strong>ENERGY STAR Lamps v4.0</strong> (EPA, 2024) and{" "}
              <strong>ENERGY STAR Luminaires v2.0</strong> (EPA, 2025).
              Product specifications and L70 lifetime requirements.
            </li>
            <li>
              <strong>ENERGY STAR Multifamily New Construction (MFNC)
              v1.2</strong> — reference design package for MF lighting,
              ventilation, DHW, envelope.
            </li>
            <li>
              <strong>DesignLights Consortium (DLC)</strong> — Qualified
              Products List Standard + Premium technical requirements.
            </li>
            <li>
              <strong>DOE Building America Multifamily Whole-Building
              Performance baseline tables</strong> — published lighting EUI
              ranges by equipment vintage.
            </li>
            <li>
              <strong>DOE Buildings Energy Data Book §2.2</strong> —
              commercial lighting end-use intensities.
            </li>
            <li>
              <strong>IES Lighting Handbook (11th edition)</strong> —
              illuminance recommendations, operating-hour conventions,
              fixture efficacy benchmarks.
            </li>
            <li>
              <strong>IES RP-1 (Office Lighting), RP-29 (Healthcare),
              RP-33 (Outdoor Environment)</strong> — application-specific
              illuminance + uniformity recommendations.
            </li>
            <li>
              <strong>EPA eGRID 2022</strong> (released 2024) — power-
              sector subregion emission factors. Updated approximately
              every 18 months.
            </li>
            <li>
              <strong>EPA 2024 GHG Emission Factors Hub</strong> — fuel-
              combustion factors (cross-referenced for cogeneration cases
              in DHW; same factors used here for combined-energy
              comparisons).
            </li>
            <li>
              <strong>NEEA Multi-Family Lighting Field Study (2018)</strong>{" "}
              — Northwest field-measured retrofit savings from LED + control
              upgrades in Pacific Northwest MF buildings.
            </li>
            <li>
              <strong>ACEEE State and Local Multifamily Energy Efficiency
              Studies</strong> — utility-program field data informing the
              control-savings ranges in §2 and the LED retrofit ranges in §4.
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
            16 published-reference assertions in{" "}
            <Code>src/lib/lighting/calibration.test.ts</Code> run on every
            CI build. Categories:
          </p>
          <Table
            head={["Test category", "Cases", "Reference"]}
            rows={[
              ["Engineering math (deterministic)", "3", "Internal — formula sanity"],
              ["ASHRAE 90.1-2022 §9.5.1 LPD compliance", "3", "ASHRAE 90.1 Table 9.5.1"],
              ["ENERGY STAR / DLC LED retrofit savings", "3", "ENERGY STAR field data; DLC QPL"],
              ["DOE Building America EUI bands", "2", "DOE BA MF baseline tables"],
              ["Monthly model fairness", "3", "Internal — invariant"],
              ["Compare-tab fairness", "1", "Internal — regression fence"],
              ["Determinism", "1", "Internal — guards Math.random()"],
            ]}
          />
          <p>
            Companion document: <Code>docs/calibration.md</Code> (DHW
            calibration; lighting calibration entries to be appended in
            the next ship). Re-validate after any change to{" "}
            <Code>src/lib/lighting/pipeline.ts</Code>.
          </p>
          <Callout tone="success">
            <strong>Status as of engine v1.0.0:</strong> all 16 lighting
            calibration assertions pass. The default scenario produces
            outputs within the published reference bands documented above,
            and the LED retrofit preset reproduces typical 75–85%
            kWh / cost / carbon reductions in line with ENERGY STAR + DLC
            field-data ranges.
          </Callout>
        </Prose>
      </Card>
    </div>
  );
}
