import type { ReactNode } from "react";

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 className="ve-section-title" style={{ fontSize: 16 }}>
          {title}
        </h2>
        {description && (
          <p style={{ marginTop: 4, marginLeft: 15, fontSize: 13, color: "var(--text-secondary)" }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
