import InUnitHvacCalculator from "@/components/InUnitHvacCalculator";

/**
 * `/inunit-hvac` — multifamily in-unit HVAC calculator route. Mounts the
 * InUnitHvacCalculator component below the AppShell brand bar. Covers
 * per-apartment cooling + heating equipment (PTAC, PTHP, mini-splits,
 * window AC, cold-climate HP).
 */
export default function InUnitHvacPage() {
  return <InUnitHvacCalculator />;
}
