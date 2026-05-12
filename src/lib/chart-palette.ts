/**
 * Centralized chart palette — single source of truth for the literal hex
 * values used in recharts `fill` / `stroke` attributes. recharts passes
 * these straight through to SVG attributes, which do NOT resolve CSS
 * `var(...)` references, so we can't use the globals.css custom properties
 * directly here. Instead this module mirrors the CSS palette one-for-one;
 * keep both in sync when adjusting brand colors.
 *
 * For non-chart UI (text colors, borders, backgrounds) prefer the CSS
 * variables in `src/app/globals.css` — they're hot-swappable for theme work.
 *
 * Naming follows the CSS variable names where they overlap (`navy` =
 * `--accent-blue`, etc.), with additional palette slots for categorical
 * series that have more buckets than the base accent set covers (lighting
 * = 7 categories, in-unit HVAC = 8 archetypes).
 */

/** Base palette — matches the `--accent-*` CSS variables in globals.css. */
export const CHART_NAVY = "#1E3A5F"; // matches --accent-blue
export const CHART_EMERALD = "#047857"; // matches --accent-emerald
export const CHART_OCHRE = "#B45309"; // matches --accent-amber
export const CHART_VIOLET = "#6D28D9"; // matches --accent-violet
export const CHART_ORANGE = "#C2410C"; // matches --accent-orange
export const CHART_RED = "#B91C1C"; // matches --accent-red

/** Extended palette — categorical-series buckets beyond the base accent set. */
export const CHART_MAGENTA = "#BE185D"; // lighting in-unit
export const CHART_TEAL = "#0E7490"; // cold-climate variant
export const CHART_TEAL_DARK = "#0F766E"; // central HP
export const CHART_OCHRE_DARK = "#A16207"; // central AC + resistance
export const CHART_SLATE = "#525252"; // neutral warm-gray (garage, window AC)
export const CHART_GRAY = "#6B7280"; // neutral cool-gray (mini-split cool-only)

/** Recharts axis + grid neutrals. Matches `--border-light` and `--text-muted`
 *  in spirit but with the literals recharts actually needs. */
export const CHART_GRID = "#E2E6EF";
export const CHART_AXIS = "#6B7280";

/** Lighting category palette — one entry per `LightingInputs` category.
 *  Imported by LightingCalculator's chart legend + bar fills. */
export const LIGHTING_CATEGORY_COLORS = {
  corridor: CHART_NAVY,
  stairwell: CHART_VIOLET,
  commonArea: CHART_EMERALD,
  exteriorSite: CHART_OCHRE,
  exteriorFacade: CHART_ORANGE,
  inUnit: CHART_MAGENTA,
  garageParking: CHART_SLATE,
} as const;

/** In-unit HVAC end-use palette — cooling vs heating, cool-tone vs warm-tone. */
export const INUNIT_HVAC_ENDUSE_COLORS = {
  cooling: CHART_NAVY,
  heating: CHART_OCHRE,
} as const;

/** In-unit HVAC archetype palette — per-tile accent bar in OverviewTab. */
export const INUNIT_HVAC_ARCHETYPE_COLORS = {
  ptac_resistance: CHART_OCHRE,
  pthp: CHART_NAVY,
  minisplit_hp: CHART_EMERALD,
  minisplit_cool_resist: CHART_GRAY,
  window_ac_resist: CHART_SLATE,
  ccshp: CHART_TEAL,
  central_split_hp: CHART_TEAL_DARK,
  central_split_ac_resist: CHART_OCHRE_DARK,
} as const;
