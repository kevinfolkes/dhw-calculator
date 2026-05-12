/**
 * Typed input shape for the multifamily lighting calculator. Mirrors the
 * `DhwInputs` pattern: a single object that can be serialized (URL params,
 * localStorage, PDF export) and threaded through a pure `runCalc()`
 * function.
 *
 * Engineering scope: every common-area + exterior + per-unit lighting
 * category in a typical multifamily building. Each category is one
 * configurable bucket of fixtures sharing a wattage / hours / control
 * profile. The retrofit comparison widget runs two LightingInputs through
 * the pipeline and surfaces savings deltas.
 *
 * References:
 *   - ASHRAE 90.1-2022 §9 (Lighting) — LPD limits by space type
 *   - DOE Building America MF Energy Use Intensity benchmarks (lighting)
 *   - ENERGY STAR LED retrofit savings ranges
 *   - DLC (DesignLights Consortium) Qualified Products List
 *   - IES Lighting Handbook (operating-hour conventions)
 */
import type { GridSubregion } from "@/lib/engineering/constants";

/** A single lighting category — one bucket of fixtures sharing a wattage,
 *  operating-hour profile, and control regime. The user configures one of
 *  these per category (corridor, stairwell, common area, etc.). */
export interface LightingCategoryConfig {
  /** Number of fixtures in this category across the entire building.
   *  For in-unit lighting this is total fixtures across all apartments
   *  (e.g., 60 apartments × 8 fixtures/unit = 480). */
  count: number;
  /** Average input wattage per fixture, including driver/ballast losses
   *  where applicable. Use the manufacturer's nameplate value or the
   *  measured pull from a metered sample. */
  wattsPerFixture: number;
  /** Average hours per day the fixture is energized BEFORE applying
   *  occupancy-sensor or daylight-credit reductions. Typical values:
   *  - Corridor / stairwell (always-on): 24
   *  - Common area (active hours): 14–18
   *  - Exterior site (dusk-to-dawn): ~12 (climate-dependent)
   *  - In-unit (occupant-driven): 3–5
   *  - Garage / parking deck: 24 if always-on, else photocell-controlled */
  hoursPerDay: number;
  /** Fraction of operating hours saved by occupancy sensors (0.0–0.7).
   *  ASHRAE 90.1-2022 §9.4 requires occupancy controls in many spaces;
   *  field-measured savings are typically 25–50% in corridors and 40–60%
   *  in stairwells. Default 0 = no controls. */
  occupancySensorReduction: number;
  /** Fraction of operating hours offset by daylight harvesting (0.0–0.5).
   *  Applies to exterior fixtures with photocells (where the ~12hr nominal
   *  schedule is already daylight-aware — set to 0 if hoursPerDay already
   *  reflects nighttime-only operation) and to perimeter common-area
   *  fixtures with daylight sensors. Default 0. */
  daylightCredit: number;
}

/** Categorical breakdown of multifamily lighting end uses. Each maps to one
 *  `LightingCategoryConfig` in `LightingInputs`. The set is fixed so the
 *  calculator can render a consistent UI; future categories (e.g.,
 *  emergency-egress lighting) can extend this union. */
export type LightingCategory =
  | "corridor"
  | "stairwell"
  | "commonArea"
  | "exteriorSite"
  | "exteriorFacade"
  | "inUnit"
  | "garageParking";

export const LIGHTING_CATEGORIES: readonly LightingCategory[] = [
  "corridor",
  "stairwell",
  "commonArea",
  "exteriorSite",
  "exteriorFacade",
  "inUnit",
  "garageParking",
] as const;

export const LIGHTING_CATEGORY_LABELS: Record<LightingCategory, string> = {
  corridor: "Corridors",
  stairwell: "Stairwells",
  commonArea: "Common areas (lobby / lounge / mail)",
  exteriorSite: "Exterior site (parking, walkways)",
  exteriorFacade: "Exterior façade (wall packs, security)",
  inUnit: "In-unit (per-apartment baseline)",
  garageParking: "Garage / parking deck",
};

/** Brief one-line description shown next to the category name in the UI,
 *  to remind users what's typical for this category. */
export const LIGHTING_CATEGORY_HINTS: Record<LightingCategory, string> = {
  corridor:
    "Always-on (24/7); ASHRAE 90.1 requires automatic step-dimming in spaces with bi-level/occupancy capability.",
  stairwell:
    "Always-on (24/7); strong candidate for occupancy sensors with bi-level or step-dimming controls.",
  commonArea:
    "Lobby, lounges, mail room, club rooms; typically 14–18hr/day with occupancy sensors in most jurisdictions.",
  exteriorSite:
    "Pole + bollard fixtures lighting parking lots and walkways; photocell-controlled (~10–13hr/day).",
  exteriorFacade:
    "Wall packs, security floods, signage; most run dusk-to-dawn (~10–13hr/day).",
  inUnit:
    "Per-apartment base lighting load; aggregate count = avg fixtures/unit × number of units.",
  garageParking:
    "Indoor parking decks; if 24/7 use 24, if dusk-to-dawn use ~12. Daylight credit only with effective skylights.",
};

export interface LightingInputs {
  /** One config per lighting category. */
  categories: Record<LightingCategory, LightingCategoryConfig>;
  /** Total conditioned + non-conditioned interior building area (ft²).
   *  Used to compute the building-method LPD for ASHRAE 90.1-2022 §9.5.1
   *  compliance. Includes corridors, stairwells, common areas, and
   *  apartments — basically the whole building envelope. */
  totalBuildingSqft: number;
  /** Site electricity rate ($/kWh). Drives the annual cost calc. */
  elecRate: number;
  /** EPA eGRID subregion for emission factor lookup. Same enum as the DHW
   *  calculator so users get the same regional choices everywhere. */
  gridSubregion: GridSubregion;
  /** Custom emission factor (lb CO₂e/kWh) used when `gridSubregion ===
   *  "Custom"`. */
  customEF: number;
}

/** Tier-keyed defaults that match a "typical" 60-unit mid-rise multifamily
 *  building running INCANDESCENT / FLUORESCENT incumbent technology — the
 *  pre-retrofit baseline most users will start from. Designed so a fresh
 *  user lands on a realistic-looking scenario, not zeros everywhere. */
export const DEFAULT_INPUTS: LightingInputs = {
  categories: {
    corridor: {
      // 60-unit mid-rise: ~12 fixtures per floor × 5 floors = 60 fixtures
      count: 60,
      wattsPerFixture: 60, // 60W incandescent / CFL — typical incumbent
      hoursPerDay: 24,
      occupancySensorReduction: 0,
      daylightCredit: 0,
    },
    stairwell: {
      count: 20, // 4 fixtures per stairwell × 5 floors
      wattsPerFixture: 60,
      hoursPerDay: 24,
      occupancySensorReduction: 0,
      daylightCredit: 0,
    },
    commonArea: {
      count: 30, // lobby + mail + lounge + club rooms
      wattsPerFixture: 75,
      hoursPerDay: 16,
      occupancySensorReduction: 0,
      daylightCredit: 0,
    },
    exteriorSite: {
      count: 12, // 8 pole fixtures + 4 bollards
      wattsPerFixture: 250, // typical HID / metal-halide pole fixture
      hoursPerDay: 12,
      occupancySensorReduction: 0,
      daylightCredit: 0,
    },
    exteriorFacade: {
      count: 16, // wall packs around the building perimeter
      wattsPerFixture: 100,
      hoursPerDay: 12,
      occupancySensorReduction: 0,
      daylightCredit: 0,
    },
    inUnit: {
      count: 480, // 60 units × 8 fixtures per unit (kitchen + bath + bedroom)
      wattsPerFixture: 60,
      hoursPerDay: 4,
      occupancySensorReduction: 0,
      daylightCredit: 0,
    },
    garageParking: {
      count: 0, // many MF buildings don't have indoor parking — opt-in
      wattsPerFixture: 100,
      hoursPerDay: 24,
      occupancySensorReduction: 0,
      daylightCredit: 0,
    },
  },
  totalBuildingSqft: 60000, // ~1000 sf/unit × 60 units (typical mid-rise)
  elecRate: 0.14,
  gridSubregion: "MROW (Upper MW)",
  customEF: 0.7,
};

/** A "typical LED retrofit" preset for users who want to populate the
 *  Proposed side of the retrofit widget with sensible defaults rather than
 *  retyping every category. Reduces wattage by ~75–85% across the board
 *  (typical LED swap), adds occupancy-sensor reductions in corridors /
 *  stairwells / common areas (per ASHRAE 90.1-2022 §9.4), and keeps
 *  hours-per-day unchanged. */
export const DEFAULT_LED_RETROFIT: LightingInputs = {
  ...DEFAULT_INPUTS,
  categories: {
    corridor: { count: 60, wattsPerFixture: 12, hoursPerDay: 24, occupancySensorReduction: 0.30, daylightCredit: 0 },
    stairwell: { count: 20, wattsPerFixture: 12, hoursPerDay: 24, occupancySensorReduction: 0.50, daylightCredit: 0 },
    commonArea: { count: 30, wattsPerFixture: 18, hoursPerDay: 16, occupancySensorReduction: 0.30, daylightCredit: 0 },
    exteriorSite: { count: 12, wattsPerFixture: 70, hoursPerDay: 12, occupancySensorReduction: 0, daylightCredit: 0 },
    exteriorFacade: { count: 16, wattsPerFixture: 25, hoursPerDay: 12, occupancySensorReduction: 0, daylightCredit: 0 },
    inUnit: { count: 480, wattsPerFixture: 10, hoursPerDay: 4, occupancySensorReduction: 0, daylightCredit: 0 },
    garageParking: { count: 0, wattsPerFixture: 30, hoursPerDay: 24, occupancySensorReduction: 0.40, daylightCredit: 0 },
  },
};
