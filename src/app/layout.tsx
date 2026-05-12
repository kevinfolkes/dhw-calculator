import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Multifamily Building Energy Calculator",
  description:
    "Engineering-grade sizing and retrofit-comparison calculators for every major multifamily building end use — DHW, lighting, HVAC, and more. ASHRAE / NEEA / EPA / NREL calibrated.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" style={{ colorScheme: "light" }}>
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "'Manrope', 'Segoe UI', sans-serif" }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
