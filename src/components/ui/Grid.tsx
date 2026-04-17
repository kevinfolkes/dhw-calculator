import type { ReactNode } from "react";

export function Grid({
  children,
  cols = 2,
  gap = 16,
}: {
  children: ReactNode;
  cols?: number;
  gap?: number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
      {children}
    </div>
  );
}

export function Stack({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}
