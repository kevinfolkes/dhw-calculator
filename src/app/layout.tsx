import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DHW Sizing — Multifamily Water Heating Calculator",
  description:
    "ASHRAE-based sizing and energy modeling for multifamily domestic hot water systems. Central and in-unit, gas and all-electric.",
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
        {children}
      </body>
    </html>
  );
}
