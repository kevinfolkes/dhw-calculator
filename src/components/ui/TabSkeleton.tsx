"use client";

/**
 * Lightweight skeleton shown while a lazy-loaded tab chunk is being fetched.
 * Used by the `dynamic(() => import(...))` calls in each calculator shell
 * to defer recharts + heavy prose tabs (Energy / Calculations / Methodology)
 * off the first-paint critical path.
 *
 * The shell itself remains synchronous (TabNav + active-tab state) so
 * switching tabs is always instant from the user's perspective; only the
 * NEW tab's content shows the skeleton on first visit, and the chunk is
 * cached for subsequent visits.
 */
export function TabSkeleton({ label }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "8px 0",
      }}
      aria-busy="true"
      aria-live="polite"
    >
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </div>
      )}
      <SkeletonBar w="60%" h={28} />
      <SkeletonBar w="100%" h={140} radius={8} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <SkeletonBar h={64} radius={8} />
        <SkeletonBar h={64} radius={8} />
        <SkeletonBar h={64} radius={8} />
      </div>
      <SkeletonBar w="100%" h={200} radius={8} />
      <style>{`
        @keyframes tab-skeleton-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function SkeletonBar({
  w = "100%",
  h = 16,
  radius = 4,
}: {
  w?: string | number;
  h?: number;
  radius?: number;
}) {
  return (
    <div
      style={{
        width: typeof w === "number" ? `${w}px` : w,
        height: h,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 100%)",
        backgroundSize: "200% 100%",
        animation: "tab-skeleton-shimmer 1.6s ease-in-out infinite",
      }}
    />
  );
}
