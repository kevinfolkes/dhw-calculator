/**
 * System type registry. A system type drives which tabs and inputs are shown
 * and which auto-sizing algorithm runs.
 */

export type Topology = "central" | "inunit";
export type Tech = "gas" | "resistance" | "hpwh";
export type SubTech = "tank" | "tankless";

export type SystemTypeKey =
  | "central_gas"
  | "central_gas_tankless"
  | "central_indirect"
  | "central_hybrid"
  | "central_steam_hx"
  | "central_resistance"
  | "central_hpwh"
  | "inunit_gas_tank"
  | "inunit_gas_tankless"
  | "inunit_hpwh"
  | "inunit_combi"
  | "inunit_combi_gas";

export interface SystemTypeDef {
  label: string;
  short: string;
  topology: Topology;
  tech: Tech;
  subtech?: SubTech;
  hasRecirc: boolean;
  hasSpaceHeating: boolean;
  description: string;
  archetypes: string;
  /** Accent color for this system type (hex) */
  color: string;
}

export const SYSTEM_TYPES: Record<SystemTypeKey, SystemTypeDef> = {
  central_gas: {
    label: "Central Gas (condensing) + Recirc",
    short: "Central Gas",
    topology: "central",
    tech: "gas",
    hasRecirc: true,
    hasSpaceHeating: false,
    description:
      "Traditional central plant. Gas condensing water heaters with storage tanks and recirculation loop serving all units. Baseline comparison for electrification projects.",
    archetypes: "Lochinvar Armor/Shield, AO Smith Cyclone, AERCO Innovation, RBI Futera",
    color: "#f2a85b",
  },
  central_gas_tankless: {
    label: "Central Gas Tankless (modulating condensing) + Recirc",
    short: "Central Gas Tankless",
    topology: "central",
    tech: "gas",
    subtech: "tankless",
    hasRecirc: true,
    hasSpaceHeating: false,
    description:
      "Central plant of modulating condensing tankless gas water heaters tied to a recirculation loop. No primary storage tank (or only a trivial buffer). Sized by peak instantaneous GPM × ΔT instead of FHR + storage.",
    archetypes: "Lochinvar Knight Tankless, AERCO Innovation, Camus Dynaflame, Patterson Kelley Mach",
    color: "#e8975c",
  },
  central_indirect: {
    label: "Central Indirect (boiler + indirect tank) + Recirc",
    short: "Central Indirect",
    topology: "central",
    tech: "gas",
    hasRecirc: true,
    hasSpaceHeating: false,
    description:
      "Central plant where one or more hydronic boilers heat a glycol/water loop that feeds an indirect-fired storage tank (or plate heat exchanger) on the potable side. Common in older urban high-rise where a single boiler serves both heating and DHW.",
    archetypes: "Weil-McLain Ultra + indirect HX, Lochinvar FTXL + Aerco SmartPlate, Aerco Benchmark + plate HX, Riello + indirect tank",
    color: "#d8924e",
  },
  central_hybrid: {
    label: "Central Hybrid (HPWH + gas backup) + Recirc",
    short: "Central Hybrid",
    topology: "central",
    tech: "hpwh",
    hasRecirc: true,
    hasSpaceHeating: false,
    description:
      "All-electric HPWH carries the baseload and shoulder seasons; a gas-fired backup (condensing tank or boiler) covers winter peak hour and rapid recovery. Standard transitional electrification configuration in cold climates (4A+) where a pure HPWH plant would oversize for peak hour or fail during compressor lockout.",
    archetypes: "Mitsubishi QAHV + Lochinvar Armor backup, Colmac CxV + AO Smith Cyclone, Aermec + boiler, SANCO2 + condensing gas tank",
    color: "#a3c8a8",
  },
  central_steam_hx: {
    label: "Central Steam-to-DHW HX + Recirc",
    short: "Central Steam HX",
    topology: "central",
    tech: "gas",
    hasRecirc: true,
    hasSpaceHeating: false,
    description:
      "Steam from a district loop (Con Edison-style) or in-building boiler is routed through a shell-and-tube heat exchanger that heats potable water in an indirect-fired storage tank. Standard in older urban high-rise multifamily (NYC, Boston, Chicago).",
    archetypes: "PVI TurboPower with steam coil, Bock SteamMaster, Aerco SmartPlate Steam, Cleaver-Brooks shell-and-tube",
    color: "#b8a3d3",
  },
  central_resistance: {
    label: "Central Electric Resistance + Recirc",
    short: "Central Resistance",
    topology: "central",
    tech: "resistance",
    hasRecirc: true,
    hasSpaceHeating: false,
    description:
      "Electric resistance tanks in central mech room. 1:1 efficiency — uneconomic at scale but may be used where HPWH infeasible or as redundancy/peaking.",
    archetypes: "PVI EZ, AO Smith Dura-Power, Lochinvar Power-Fin Electric",
    color: "#7dbbd3",
  },
  central_hpwh: {
    label: "Central HPWH (CO2 or HFC) + Recirc",
    short: "Central HPWH",
    topology: "central",
    tech: "hpwh",
    hasRecirc: true,
    hasSpaceHeating: false,
    description:
      "All-electric central plant. Heat pump water heaters with primary storage and optional swing tank for recirc/Legionella. Most common electrification retrofit approach.",
    archetypes: "Colmac CxA/CxV (HFC), SANCO2 (CO2), Mitsubishi QAHV (CO2), Aermec, Nyle",
    color: "#7dd3a3",
  },
  inunit_gas_tank: {
    label: "In-Unit Gas Tank (atmospheric or condensing)",
    short: "In-Unit Gas Tank",
    topology: "inunit",
    tech: "gas",
    subtech: "tank",
    hasRecirc: false,
    hasSpaceHeating: false,
    description:
      "Per-apartment gas-fired tank water heater. Atmospheric, power-vent, or condensing/direct-vent. Each unit has dedicated venting and tenant pays own gas.",
    archetypes: "AO Smith ProLine XE, Bradford White Defender, Rheem Performance Plus, State Select, Rinnai Tank",
    color: "#e89a6e",
  },
  inunit_gas_tankless: {
    label: "In-Unit Gas Tankless (instantaneous)",
    short: "In-Unit Gas Tankless",
    topology: "inunit",
    tech: "gas",
    subtech: "tankless",
    hasRecirc: false,
    hasSpaceHeating: false,
    description:
      "Per-apartment tankless gas water heater. No storage — burner modulates to meet instantaneous demand. Sized by peak GPM × ΔT, not storage + recovery.",
    archetypes: "Rinnai RU199, Navien NPE-240A2, Noritz NRCP, Rheem RTGH, Bosch Greentherm",
    color: "#d97a57",
  },
  inunit_hpwh: {
    label: "In-Unit HPWH (DHW only)",
    short: "In-Unit HPWH",
    topology: "inunit",
    tech: "hpwh",
    hasRecirc: false,
    hasSpaceHeating: false,
    description:
      "Per-apartment HPWH tank serving DHW only. Separate space heating system (VRF, mini-split, etc.) required. Eliminates recirc losses and central mech room.",
    archetypes: "Rheem ProTerra, AO Smith Voltex, State Premier Hybrid, Bradford White Aerotherm",
    color: "#a3d7dd",
  },
  inunit_combi: {
    label: "In-Unit Combi HPWH (DHW + Hydronic Fan Coil)",
    short: "In-Unit Combi HPWH",
    topology: "inunit",
    tech: "hpwh",
    hasRecirc: false,
    hasSpaceHeating: true,
    description:
      "Single per-apartment HPWH serves both DHW and space heating via hydronic fan coil. Integrated all-electric system — one piece of equipment per unit.",
    archetypes: "Sanden SANCO2 + buffer, Harvest Thermal, SpacePak Solstice, Ecologix combi HPWH",
    color: "#c3a3dd",
  },
  inunit_combi_gas: {
    label: "In-Unit Combi Gas (DHW + Hydronic Fan Coil)",
    short: "In-Unit Combi Gas",
    topology: "inunit",
    tech: "gas",
    subtech: "tank",
    hasRecirc: false,
    hasSpaceHeating: true,
    description:
      "Per-apartment gas storage water heater serves both DHW and space heating via a hydronic fan coil. Common in low/mid-rise multifamily where a single appliance covers both loads at low capex. Condensing or atmospheric tank options.",
    archetypes: "HTP Phoenix Sanctuary, AO Smith Cyclone Mxi, Rinnai i-series + buffer, Navien NCB combi (boiler variant)",
    color: "#e5b77a",
  },
};

export const SYSTEM_TYPE_KEYS = Object.keys(SYSTEM_TYPES) as SystemTypeKey[];
