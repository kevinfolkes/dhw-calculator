import DhwCalculator from "@/components/DhwCalculator";

/**
 * `/dhw` — domestic hot water calculator route. Mounts the existing
 * DhwCalculator component (no logic change). The AppShell in the root
 * layout provides the cross-calculator hamburger menu above this page.
 */
export default function DhwPage() {
  return <DhwCalculator />;
}
