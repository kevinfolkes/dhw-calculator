"use client";

import type { ReactNode } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

/**
 * Methodology & data dictionary tab. Static reference content that walks an
 * engineer through every calculation step, every constant, and every data
 * source used by the calculator. Cross-references file paths in src/lib so
 * reviewers can jump straight to the implementation.
 */
export function MethodologyTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            This calculator sizes multifamily domestic-hot-water (DHW) systems using established
            engineering standards. Every coefficient and curve in use is traceable to a published
            source. Inputs flow through a single pure pipeline
            (<Code>src/lib/calc/pipeline.ts</Code> &rarr; <Code>runCalc()</Code>) that produces
            demand, sizing, monthly energy, auto-size recommendations, and compliance flags.
          </p>
          <p>
            The tool supports seven system archetypes: three central (gas, resistance, HPWH with
            recirculation) and four in-unit (gas tank, gas tankless, HPWH-only, combi HPWH+hydronic).
            Each system uses the same demand calculation but different sizing logic.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. Demand calculation</CardTitle>
        </CardHeader>
        <Prose>
          <p>Three methods run in parallel; the governing method drives downstream sizing.</p>

          <H4>1a. ASHRAE Ch. 51 Table 7 — Apartment tabular demand</H4>
          <p>
            ASHRAE publishes per-apartment hot-water demand coefficients calibrated to measured
            multifamily data. Three occupancy profiles are supported:
          </p>
          <Table
            head={["Profile", "Max hour (GPH/apt)", "Max day (GPH/apt)", "Avg day (GPH/apt)"]}
            rows={[
              ["Low (elderly/efficiency)", "10.8", "42.8", "34.6"],
              ["Medium (market-rate)", "12.0", "49.2", "39.6"],
              ["High (family/luxury)", "13.1", "55.6", "44.6"],
            ]}
          />
          <p>
            Building demand = profile × total units. All ASHRAE values are at 140 &deg;F
            storage; delivered-temperature corrections are applied separately.
          </p>

          <H4>1b. Hunter / ASPE Modified — Fixture-unit method</H4>
          <p>
            Aggregate Water Supply Fixture Units (WSFU) are computed from the unit mix using
            IPC Table 604.3 hot-water columns:
          </p>
          <Table
            head={["Fixture", "WSFU (hot)"]}
            rows={[
              ["Bathroom sink (lavatory)", "0.75"],
              ["Kitchen sink", "1.0"],
              ["Shower", "1.5"],
              ["Tub", "1.5"],
              ["Dishwasher", "1.0"],
              ["Clothes washer", "1.5"],
            ]}
          />
          <p>
            Per-unit fixture mixes assumed by bedroom count: Studio/0-BR gets 1 lav + kitchenette +
            shower + half-credit dishwasher &amp; washer (shared-laundry-friendly); 1-BR gets 2 lavs
            + kitchen + shower + 0.5 × washer; 2-BR adds a third lav, half a tub, half a dishwasher;
            3-BR is fully equipped with 4 lavs, a tub, and full dishwasher/washer credit.
          </p>
          <p>
            WSFU &rarr; GPM uses a piecewise fit to Hunter&rsquo;s curves
            (<Code>src/lib/engineering/hunter.ts</Code>). Two variants: Classical Hunter (1940) for
            legacy / non-low-flow fixture applications, and ASPE Modified Hunter for WaterSense /
            low-flow installations (~30% lower at mid-range). Accurate to &plusmn;5% over
            10&ndash;1000 WSFU.
          </p>
          <p>
            Peak-hour GPH = peak GPM &times; 60 &times; diversity factor. Diversity: 0.80 for
            WSFU &lt; 30, 0.65 for 30&ndash;100, 0.55 for 100+. Peak-day and avg-day scale from
            peak-hour using multipliers 4.0 and 3.2 respectively.
          </p>

          <H4>1c. Occupancy / gpcd method</H4>
          <p>
            Total occupants = sum of (units<sub>n-BR</sub> &times; occupants/unit). Daily hot-water
            demand = occupants &times; gpcd. Peak hour = 25% of daily (typical residential draw
            profile from ASHRAE Fundamentals). Default occupancy: 1.5/2.5/3.5 persons for
            1/2/3-BR units; default 20 gpcd hot-water per person.
          </p>

          <H4>1d. Fixture-flow editor (tankless peak)</H4>
          <p>
            For tankless sizing, the peak GPM is governed by the top-N simultaneous fixtures by
            flow. The calculator takes the largest N fixture GPM values (where N = the
            &ldquo;simultaneous fixtures&rdquo; input) and applies an 85% simultaneity derate
            from ASPE co-use analysis. Users can override default fixture GPMs on the Demand tab.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Recirculation standby loss</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            For systems with recirculation (<Em>central_gas</Em>, <Em>central_resistance</Em>,
            <Em>central_hpwh</Em>) the standby loss of the loop is a non-trivial fraction of
            total load. Simplified model (<Code>src/lib/engineering/recirc.ts</Code>):
          </p>
          <Formula>
            bare_loss_per_ft (BTU/hr/ft) = (T<sub>return</sub> &minus; T<sub>ambient</sub>) &times; 0.4
          </Formula>
          <Formula>
            insulated_loss_per_ft = bare_loss_per_ft / (1 + R / 0.35)
          </Formula>
          <Formula>
            loss_BTUH = insulated_loss_per_ft &times; loop_length &times; 2   (supply + return)
          </Formula>
          <p>
            The <Em>0.4</Em> coefficient is empirical for 1&Prime; nominal copper at 125 &deg;F.
            The <Em>0.35</Em> denominator normalizes against a bare-pipe baseline resistance.
            ASHRAE 90.1-2022 &sect;6.4.4.1.3 prescribes R-4 minimum for ≥2&Prime; pipe &mdash; a
            warning fires below that.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Storage and recovery (ASHRAE method)</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Central-system sizing follows the ASHRAE storage-plus-recovery approach. Coefficients
            by occupancy profile: storage fraction 1.25, recovery fraction 0.30 (applied to
            peak-hour demand).
          </p>
          <Formula>
            storage<sub>nominal</sub> = peak_hour_GPH &times; 1.25
          </Formula>
          <Formula>
            storage<sub>usable</sub> = storage<sub>nominal</sub> / 0.75
          </Formula>
          <p>
            The 0.75 usable-fraction accounts for tank stratification and outlet-temperature
            decay &mdash; a 100-gal tank at 140 &deg;F typically delivers ~75 gal of useful hot
            water before dropping below the 120 &deg;F delivery setpoint.
          </p>
          <p>
            When storage temperature exceeds delivered temperature (e.g. 140 &deg;F stored for
            Legionella safety, 120 &deg;F delivered via a thermostatic mixing valve), the
            effective tempered capacity is larger:
          </p>
          <Formula>
            tempered_capacity = storage<sub>usable</sub> &times; (T<sub>store</sub> &minus; T<sub>inlet</sub>) / (T<sub>deliver</sub> &minus; T<sub>inlet</sub>)
          </Formula>
          <p>Recovery sizing:</p>
          <Formula>
            recovery_GPH = peak_hour_GPH &times; 0.30
          </Formula>
          <Formula>
            recovery_BTUH = recovery_GPH &times; 8.33 lb/gal &times; 1 BTU/lb&middot;&deg;F &times; (T<sub>store</sub> &minus; T<sub>inlet</sub>)
          </Formula>
          <Formula>
            total_design_load = recovery_BTUH + recirc_loss_BTUH
          </Formula>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Technology comparison (central)</CardTitle>
        </CardHeader>
        <Prose>
          <p>For a given total design load:</p>
          <Formula>
            gas_input_BTUH = total_BTUH / &eta;<sub>gas</sub>
            (default 0.95 for condensing)
          </Formula>
          <Formula>
            resistance_input_kW = total_kW   (1:1 efficiency minus minor standby)
          </Formula>
          <Formula>
            hpwh_input_kW = total_kW / COP(T<sub>ambient,mech</sub>, T<sub>inlet</sub>, T<sub>store</sub>, refrigerant)
          </Formula>
          <Formula>
            hpwh_nameplate_kW = hpwh_input_kW / capacity_factor(T<sub>ambient</sub>, refrigerant)
          </Formula>
          <p>
            The capacity factor accounts for HPWH output derating in cold mech rooms &mdash; you
            must specify a larger nameplate to produce the rated output at design conditions.
            See &sect;5 for the curves.
          </p>
          <p>
            When <Em>swing tank</Em> is enabled (typical for central HPWH with recirc), an
            electric resistance boost is sized to cover recirc losses + a Legionella-disinfection
            allowance (~9 kW).
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. HPWH performance curves</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            <Code>src/lib/engineering/hpwh.ts</Code> &mdash; simplified piecewise fits to
            published manufacturer data (Colmac CxA/CxV, SANCO2, Mitsubishi QAHV, typical
            HFC residentials).
          </p>
          <H4>CO2 transcritical</H4>
          <Formula>
            inletPenalty = max(0, (T<sub>inlet</sub>&minus;50) &times; 0.015)
          </Formula>
          <Formula>
            ambientBoost = clamp(&minus;0.3, 0.8, (T<sub>ambient,C</sub> &minus; 10) &times; 0.04)
          </Formula>
          <Formula>
            COP = max(1.5, 3.2 + ambientBoost &minus; inletPenalty)
          </Formula>
          <H4>HFC (R134a / R513A / R454B)</H4>
          <Formula>
            ambientFactor = clamp(&minus;1.2, 0.6, (T<sub>ambient,C</sub> &minus; 15) &times; 0.055)
          </Formula>
          <Formula>
            liftPenalty = max(0, (&Delta;T &minus; 70) &times; 0.008)
          </Formula>
          <Formula>
            COP = max(1.3, 2.9 + ambientFactor &minus; liftPenalty)
          </Formula>
          <H4>Capacity derating (fraction of nameplate)</H4>
          <Formula>
            CO2:  max(0.55, min(1.1, 0.75 + T<sub>ambient,C</sub> &times; 0.012))
          </Formula>
          <Formula>
            HFC:  max(0.45, min(1.05, 0.70 + T<sub>ambient,C</sub> &times; 0.018))
          </Formula>
          <p>
            For higher-fidelity sizing, swap these for AHRI 1300 certified performance files per
            the target equipment.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. In-unit gas tank sizing</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            First-Hour Rating (FHR) per AHRI 1300 must meet per-unit ASHRAE peak hour. Supported
            sizes and ratings:
          </p>
          <Table
            head={["Gal", "Input MBH", "FHR atmos (GPH)", "FHR cond (GPH)", "UEF atmos", "UEF cond"]}
            rows={[
              ["40", "40", "67", "75", "0.64", "0.80"],
              ["50", "40", "75", "84", "0.64", "0.82"],
              ["75", "76", "129", "142", "0.64", "0.88"],
              ["100", "100", "175", "189", "0.64", "0.90"],
            ]}
          />
          <p>
            Annual therms = avg_daily_GPH &times; 365 &times; 8.33 &times; &Delta;T / (UEF &times; 100,000).
            Building gas demand applies a 70% diversity factor (IFGC) for buildings with 6+ units.
          </p>
          <p>
            Compliance flags (see <Em>Compliance</Em> tab): atmospheric venting &ge;50 gal is
            flagged against DOE UEF 2015; condensing requires Cat IV venting (IFGC &sect;503) and
            condensate drain.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7. In-unit gas tankless sizing</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Sized by peak instantaneous flow &times; &Delta;T. Peak GPM = top-N fixture flows
            &times; 85% simultaneity. Required BTUH = peak_GPM &times; 500 &times; &Delta;T
            (500 = 8.33 lb/gal &times; 60 min/hr &times; 1 BTU/lb&middot;&deg;F).
          </p>
          <p>Available equipment:</p>
          <Table
            head={["Input MBH", "UEF", "Peak GPM @ 35F rise", "Peak GPM @ 70F rise", "Modulation"]}
            rows={[
              ["150", "0.82", "4.5", "2.3", "4:1"],
              ["180", "0.93", "5.5", "2.8", "7:1"],
              ["199", "0.96", "6.5", "3.3", "10:1"],
            ]}
          />
          <p>
            Effective capacity at design rise = input_MBH &times; UEF &times; 1000 / (500 &times;
            &Delta;T). Lower modulation ratios (4:1) penalize real-world efficiency 5&ndash;10%
            below UEF on small draws due to cycling &mdash; reflected in an informational flag.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8. In-unit HPWH / Combi sizing</CardTitle>
        </CardHeader>
        <Prose>
          <p>Per-unit HPWH sizing from AHRI 1300 / ENERGY STAR certified ratings:</p>
          <Table
            head={["Gal", "FHR (GPH)", "UEF", "Compressor kW", "Resistance kW"]}
            rows={[
              ["50", "63", "3.45", "0.5", "4.5"],
              ["66", "72", "3.75", "0.5", "4.5"],
              ["80", "84", "3.88", "0.5", "4.5"],
              ["120", "120", "3.45", "1.0", "6.0"],
            ]}
          />
          <p>
            For <Em>inunit_combi</Em> systems, the same tank serves DHW and hydronic space
            heating. Space heating load is estimated via ACCA Manual J abbreviated method:
          </p>
          <Formula>
            Q<sub>heat</sub> = factor &times; floor_area &times; (T<sub>indoor</sub> &minus; T<sub>outdoor,design</sub>) + ventilation_load
          </Formula>
          <Formula>
            ventilation_load = cfm_per_unit &times; 1.08 &times; &Delta;T
          </Formula>
          <p>Envelope factors:</p>
          <Table
            head={["Preset", "UA / sqft / &deg;F", "Description"]}
            rows={[
              ["Passive / PHIUS", "0.012", "Ultra-tight envelope, HRV"],
              ["Above code / ENERGY STAR", "0.025", "IECC-plus, good windows"],
              ["Code 2021 (IECC)", "0.035", "Current minimum for new construction"],
              ["Retrofit / pre-2000", "0.055", "Older existing stock"],
            ]}
          />
          <p>
            The compressor can serve space-heat only when it has enough thermal headroom:
            compressor_BTUH = input_kW &times; 3412 &times; COP. Shortfall is made up with
            resistance backup. When ambient &lt; <Em>hpwhOpLimitF</Em> (default 37 &deg;F), the
            tank is treated as resistance-dominated for that period.
          </p>
          <p>
            Annual heating energy uses the degree-day approximation:
          </p>
          <Formula>
            annual_BTU<sub>heat</sub> = 24 &times; HDD65 &times; Q<sub>heat,design</sub> / &Delta;T<sub>design</sub>
          </Formula>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8b. Preheat modifiers (solar thermal + DWHR)</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Two architectural modifiers lift the effective inlet water temperature
            before any primary system runs. They apply uniformly to every system
            type via a single integration point — opt-in via the Building tab, with
            <code> preheat: &quot;none&quot;</code> as the default.
          </p>
          <p>
            <strong>Solar thermal.</strong> A glazed flat-plate collector array feeds
            a solar storage tank. The simplified monthly model computes a solar
            fraction from collector area, climate-archetype insolation, and monthly
            DHW load, then converts the fraction to an inlet temperature lift:
          </p>
          <Formula>
            SF<sub>m</sub> = clamp((A &times; insolation<sub>m</sub> &times; &eta;) / DHW<sub>m</sub>, 0, 0.85)
          </Formula>
          <Formula>
            lift<sub>solar,m</sub> = SF<sub>m</sub> &times; (storageSetpoint &minus; inletBase<sub>m</sub>)
          </Formula>
          <p>
            This is an annual-energy-equivalent simplification: real systems
            pre-heat through a separate solar storage tank that the primary heater
            tops up, but the equivalent monthly lift gives the same kWh / therms
            reduction at the primary heater. Insolation values (BTU/day/ft²) are
            aggregated NREL TMY3 normals across each climate archetype; default
            collector efficiency &eta; = 0.55 (typical flat-plate annual mean).
            Sources: ASHRAE Handbook Applications Ch. 36 (Solar Energy Use);
            ASHRAE 93 (collector test method).
          </p>
          <p>
            <strong>Drainwater heat recovery (DWHR).</strong> A vertical
            falling-film heat exchanger on the drain stack pre-heats incoming cold
            supply during simultaneous draws. The constant-lift approximation:
          </p>
          <Formula>
            lift<sub>dwhr</sub> = effectiveness &times; coverage &times; (drainTemp &minus; inletBase)
          </Formula>
          <p>
            DWHR only operates during simultaneous flow (water flowing in AND
            draining at the same time). Applying it as a constant lift across all
            months is conservative — actual savings depend on use patterns, but
            for typical residential profiles the model is within &plusmn;10% of
            measured savings. Drain temp is fixed at 95°F (post-shower mixing),
            and default effectiveness 0.50 reflects CSA B55.2 vertical-unit ratings
            (range 0.40&ndash;0.60). Sources: CSA B55.1 / B55.2; NREL DWHR studies
            (Schoenbauer 2012, 2017).
          </p>
          <p>
            <strong>Combined.</strong> Both lifts add but are bounded at
            0.95 &times; (storageSetpoint &minus; inletBase) so the math never
            approaches the asymptotic case where preheat == setpoint (zero primary
            load).
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9. Monthly energy model</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Annual energy is disaggregated into 12 monthly values so a reviewer can see seasonal
            COP, resistance backup share, and fuel consumption patterns.
          </p>
          <H4>Monthly HDD distribution</H4>
          <p>
            HDD65 is distributed across months using archetype-specific fractions
            (<Code>MONTHLY_HDD_FRAC</Code> in <Code>constants.ts</Code>, derived from NOAA 30-yr
            normals aggregated by climate-zone archetype: hot / mixed / cold / very_cold).
          </p>
          <H4>Monthly ambient temperature</H4>
          <Formula>
            T<sub>ambient</sub>(m) = T<sub>annual avg</sub> &minus; amplitude &times; cos(2&pi;m/12)
          </Formula>
          <p>
            Month 0 = January (coldest), month 6 = July (warmest). Amplitudes: 12 &deg;F (hot)
            &rarr; 26 &deg;F (very cold).
          </p>
          <H4>Monthly inlet water temperature</H4>
          <p>
            Ground water lags air temperature by ~1.5 months and has ~45% the amplitude (ASHRAE
            Handbook Fundamentals Ch. 32 / Burch &amp; Christensen 2007):
          </p>
          <Formula>
            T<sub>inlet</sub>(m) = T<sub>inlet,avg</sub> &minus; 0.45 &times; amp &times; cos(2&pi;(m&minus;1.5)/12)
          </Formula>
          <H4>Per-system monthly energy</H4>
          <p>
            Each month computes an ambient-corrected COP (for HPWH systems), a monthly
            &Delta;T-corrected DHW load (accounts for colder winter inlet), and a monthly
            resistance-backup share (ramps up as ambient drops below the HPWH op limit). The
            model produces kWh or therms + cost + carbon per month.
          </p>
          <H4>Steam-to-DHW HX caveat</H4>
          <p>
            For <Code>central_steam_hx</Code> systems, annual energy is reported as steam-therm
            equivalents using <Code>gasRate</Code> ($/therm) and <Code>NG_LB_CO2_PER_THERM</Code>{" "}
            as proxies for cost and carbon. <strong>This is an approximation.</strong> District
            steam pricing is more commonly billed in $/MMBtu, not per-therm, and carbon depends on
            the upstream plant fuel mix (natural gas, fuel oil, biomass, or co-gen) rather than a
            fixed natural-gas factor. Use the surfaced therm and carbon figures as order-of-magnitude
            estimates; for utility-bill validation override <Code>gasRate</Code> with the local
            steam tariff converted to per-therm, and adjust <Code>customEF</Code> to reflect the
            plant&rsquo;s carbon intensity if known.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>10. Auto-sizing logic</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            <Code>src/lib/sizing/auto-size.ts</Code>. For each system type, returns three
            recommendations:
          </p>
          <H4>Minimum</H4>
          <p>
            Smallest standard equipment size that passes demand + code requirements at unity
            margin. No safety factor.
          </p>
          <H4>Recommended</H4>
          <p>
            Industry-standard 15&ndash;25% safety margin applied on top of minimum:
          </p>
          <ul>
            <li>Central gas: +25% on input MBH (handles off-design, diversity error)</li>
            <li>Central resistance: +20% on kW</li>
            <li>Central HPWH: +25% on nameplate (absorbs cold-ambient derate)</li>
            <li>In-unit gas tank: +15% on FHR</li>
            <li>In-unit tankless: +15% on capacity at design rise</li>
            <li>In-unit HPWH / combi: +15% on FHR; combi additionally requires resistance backup &le;3 kW at recommended size</li>
          </ul>
          <H4>Lifecycle-optimal</H4>
          <p>
            Iterates through candidate sizes that pass demand, computes 15-year total cost (capex
            + 15 &times; annual energy cost), and selects the minimum. Capital cost model is in
            <Code>src/lib/sizing/cost-models.ts</Code> &mdash; 2024 US averages, intended for
            <Em>relative</Em> comparison only. A real MEP bid would use RSMeans / local rates.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>11. Carbon accounting</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Electricity: multiply annual kWh by the selected eGRID subregion emission factor
            (lb CO<sub>2</sub>e / kWh, EPA eGRID 2022):
          </p>
          <Table
            head={["Subregion", "EF (lb/kWh)", "Notes"]}
            rows={[
              ["CAMX (CA)", "0.48", "Mix of gas, renewables"],
              ["NWPP (PNW)", "0.62", "Hydro-heavy, some gas"],
              ["RMPA (Rockies)", "1.10", "Coal-dominant"],
              ["ERCT (TX)", "0.83", "Gas + growing wind"],
              ["MROW (Upper MW)", "1.04", "Coal + wind"],
              ["RFCE (Mid-Atl)", "0.65", "Nuclear + gas"],
              ["NYUP (Upstate NY)", "0.24", "Hydro-heavy, lowest"],
              ["NEWE (New England)", "0.52", "Gas + nuclear"],
              ["SRSO (Southeast)", "0.82", "Gas + coal"],
              ["FRCC (FL)", "0.83", "Gas-dominant"],
              ["Custom", "user-entered", "For project-specific factors"],
            ]}
          />
          <p>
            Natural gas: 11.7 lb CO<sub>2</sub> / therm (EPA combustion factor, no upstream methane
            leakage). For a fuller GHG accounting add 1.3&ndash;2% upstream leakage per NOAA / EPA.
          </p>
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>12. Compliance flag logic</CardTitle>
        </CardHeader>
        <Prose>
          <p>
            Flags fire at calc-time based on thresholds in current codes. Severity levels:
            <Em> ok</Em> &middot; <Em>info</Em> &middot; <Em>warn</Em> &middot; <Em>error</Em>.
          </p>
          <Table
            head={["Threshold", "Level", "Source"]}
            rows={[
              ["Storage < 140 &deg;F", "warn", "ASHRAE 188-2021 §7.2 (Legionella)"],
              ["Delivery > 120 &deg;F", "warn", "ASSE 1070 / IPC 424.3 (scald)"],
              ["Pipe insulation R < 4", "warn", "ASHRAE 90.1-2022 §6.4.4.1.3"],
              ["HPWH > 135 gal", "info", "ASHRAE 90.1-2022 Table 7.8"],
              ["Gas WH > 200 MBH & η < 82%", "warn", "ASHRAE 90.1-2022 Table 7.8"],
              ["Recirc loss > 30% of total", "warn", "ASHRAE 90.1-2022 §6.5.4.6"],
              ["Combi fan coil supply > DHW setpoint − 5", "warn", "AHRI 1230 (fan coil ΔT)"],
              ["Climate heatDB < HPWH op limit", "warn", "NEEA AWHS / manufacturer spec"],
              ["Atmospheric tank ≥ 50 gal", "warn", "DOE UEF 2015 / ASHRAE 90.1 §7.4"],
              ["Atmospheric venting (any size)", "info", "IFGC §304 combustion air; ASHRAE 62.2 tight envelope"],
              ["Condensing tank", "info", "IFGC §503 Cat IV vent; condensate drain"],
              ["Tankless at design rise < peak GPM", "warn", "ASPE sizing"],
              ["Tankless UEF < 0.80", "info", "ASHRAE 90.1 Table 7.8"],
              ["Any in-unit gas", "info", "Local AHJ gas-ban jurisdictions (CA Title 24, NYC LL154, …)"],
            ]}
          />
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>13. Data dictionary &mdash; inputs</CardTitle>
        </CardHeader>
        <Prose>
          <p>Complete list of <Code>DhwInputs</Code> fields (<Code>src/lib/calc/inputs.ts</Code>):</p>
          <Table
            head={["Field", "Type", "Default", "Meaning"]}
            rows={[
              ["systemType", "enum", "central_hpwh", "One of 7 system archetypes"],
              ["unitsStudio / 1BR / 2BR / 3BR", "number", "0 / 20 / 30 / 10", "Unit mix (studio = efficiency / 0-BR)"],
              ["occupancyProfile", "enum", "medium", "ASHRAE low/medium/high"],
              ["climateZone", "enum", "5A - Chicago", "ASHRAE climate zone string"],
              ["inletWaterF", "°F | null", "null (auto)", "Cold-water inlet annual avg; null = derive from climate zone"],
              ["storageSetpointF", "°F", "140", "Tank storage temp (Legionella: keep ≥140)"],
              ["deliveryF", "°F", "120", "Delivered hot-water temp at fixture"],
              ["demandMethod", "enum", "ashrae", "ashrae / hunter / occupancy"],
              ["occupantsPerUnit", "object", "1.5/2.5/3.5", "Occupants per BR count for gpcd method"],
              ["gpcd", "gal", "20", "Hot-water gpcd"],
              ["fixtureGPM", "object", "WaterSense defaults", "Per-fixture hot-water flow (tankless)"],
              ["recircLoopLengthFt", "ft", "800", "Supply-only length (×2 for return)"],
              ["pipeInsulationR", "R", "4", "Loop insulation R-value"],
              ["recircReturnTempF", "°F", "125", "Loop return temp"],
              ["ambientPipeF", "°F", "70", "Ambient around loop piping"],
              ["gasEfficiency", "0–1", "0.95", "Gas equipment thermal efficiency"],
              ["hpwhRefrigerant", "enum", "CO2", "CO2 / HFC"],
              ["hpwhAmbientF", "°F", "null", "HPWH design ambient (null = auto)"],
              ["swingTankEnabled", "bool", "true", "Electric resistance swing tank for recirc"],
              ["elecRate / gasRate", "$/kWh / $/therm", "0.14 / 1.20", "Utility rates"],
              ["gridSubregion", "enum", "MROW", "eGRID 2022 subregion"],
              ["customEF", "lb/kWh", "0.70", "Custom grid factor override"],
              ["envelopePreset", "enum", "code2021", "Envelope UA factor bucket"],
              ["avgUnitSqft", "object", "650/900/1200", "Unit floor area by BR count"],
              ["indoorDesignF", "°F", "70", "Interior design temp (Manual J)"],
              ["combiTankSize", "gal", "80", "HPWH tank for in-unit HPWH/combi"],
              ["fanCoilSupplyF", "°F", "125", "Hydronic supply temp (combi)"],
              ["combiDHWSetpointF", "°F", "130", "In-unit HPWH DHW setpoint"],
              ["hpwhOpLimitF", "°F", "37", "Ambient below which resistance carries load"],
              ["ventilationLoadPerUnit", "CFM", "40", "Unit ventilation load (Manual J)"],
              ["gasTankSize / Type", "gal / enum", "50 / condensing", "In-unit gas tank config"],
              ["gasTankSetpointF", "°F", "125", "In-unit gas tank setpoint"],
              ["gasTanklessInput", "MBH", "199", "Tankless input rating"],
              ["tanklessDesignRiseF", "°F", "70", "ΔT used for capacity check"],
              ["tanklessSimultaneousFixtures", "#", "2", "Concurrent fixture count for peak"],
              ["gasTanklessSetpointF", "°F", "120", "In-unit tankless setpoint"],
            ]}
          />
        </Prose>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>14. Full reference list</CardTitle>
        </CardHeader>
        <Prose>
          <ul>
            <li>
              <Em>ASHRAE HVAC Applications Handbook</Em>, Ch. 51 (Service Water Heating) &mdash;
              per-apartment demand, storage/recovery coefficients
            </li>
            <li><Em>ASHRAE 90.1-2022</Em> (Energy Standard) &mdash; pipe insulation, equipment minima</li>
            <li>
              <Em>ASHRAE 188-2021</Em> (Legionellosis Risk Management) &mdash; storage temperature,
              water management plan
            </li>
            <li><Em>ASHRAE Handbook Fundamentals</Em>, Ch. 14 (design temps) and Ch. 32 (ground water temperature)</li>
            <li>
              <Em>ASPE Data Book Vol. 2</Em>, Ch. 5 &mdash; Modified Hunter curve, fixture co-use
            </li>
            <li><Em>2021 IPC / 2021 UPC</Em> &mdash; WSFU tables, ASSE 1070 mixing-valve requirements</li>
            <li><Em>ACCA Manual J</Em> (abbreviated method) &mdash; residential heating load</li>
            <li><Em>EPA eGRID 2022</Em> &mdash; subregion electricity emission factors</li>
            <li><Em>NOAA Climate Normals (1991&ndash;2020)</Em> &mdash; HDD65, annual avg temperatures</li>
            <li><Em>DOE Uniform Energy Factor</Em> (UEF) test procedure &mdash; AHRI Directory 1300 &amp; 1700</li>
            <li><Em>AHRI 1230</Em> &mdash; hydronic fan coil performance</li>
            <li><Em>AHRI 1300</Em> &mdash; residential water heater FHR and UEF</li>
            <li><Em>AHRI 1700</Em> &mdash; commercial instantaneous water heater performance</li>
            <li><Em>NEC 220.83 / IFGC Ch. 3-4 / IFGC §503</Em> &mdash; diversity, combustion air, venting</li>
            <li><Em>NEEA Advanced Water Heater Specification</Em> &mdash; HPWH operating limits</li>
            <li>
              <Em>Burch &amp; Christensen (2007)</Em>, NREL/TP-550-41329 &mdash; monthly ground
              water temperature model
            </li>
          </ul>
        </Prose>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Presentation helpers (scoped to this tab)
// -----------------------------------------------------------------------------

function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        color: "var(--text-primary)",
        lineHeight: 1.7,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function H4({ children }: { children: ReactNode }) {
  return (
    <h4
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: "var(--accent-blue)",
        margin: "8px 0 0",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </h4>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        background: "var(--accent-blue-bg)",
        color: "var(--accent-blue)",
        padding: "1px 6px",
        borderRadius: 4,
      }}
    >
      {children}
    </code>
  );
}

function Em({ children }: { children: ReactNode }) {
  return <em style={{ fontStyle: "normal", fontWeight: 600, color: "var(--accent-violet)" }}>{children}</em>;
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        background: "#F8FAFC",
        border: "1px solid var(--border-light)",
        borderLeft: "3px solid var(--accent-blue)",
        padding: "8px 12px",
        borderRadius: 6,
        color: "var(--text-primary)",
        margin: "4px 0",
      }}
    >
      {children}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto", margin: "4px 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "6px 10px",
                  background: "var(--accent-blue-bg)",
                  color: "var(--accent-blue)",
                  fontWeight: 700,
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
              {r.map((c, j) => (
                <td
                  key={j}
                  style={{ padding: "6px 10px", color: "var(--text-primary)" }}
                  dangerouslySetInnerHTML={{ __html: c }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
