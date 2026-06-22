// src/components/RouteMap.tsx
// Decorative route sketch, ported from the prototype. Purely cosmetic — keyed
// off a run's routeType; carries no real GPS data.
import { useId } from "react";

const PATHS: Record<string, string> = {
  river: "M5 75 Q40 30 80 50 T140 35 T195 22",
  trail: "M10 80 Q30 40 55 60 Q80 80 100 45 Q125 18 150 40 Q180 65 195 28",
  park: "M8 80 Q40 50 70 65 T130 55 T195 38",
  coast: "M5 82 Q60 55 100 65 Q140 78 195 28",
  city: "M10 82 L42 82 L42 50 L82 50 L82 72 L122 72 L122 30 L195 30",
};

export function RouteMap({ variant = "river" }: { variant?: string }) {
  const id = useId().replace(/:/g, "");
  const d = PATHS[variant] ?? PATHS.river;
  const endY = d.match(/(\d+)\s*$/)?.[1] ?? "22";
  return (
    <svg viewBox="0 0 200 90" preserveAspectRatio="none" width="100%" height="100%">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#E8F7EF" />
          <stop offset="100%" stopColor="#D5F0E1" />
        </linearGradient>
      </defs>
      <rect width="200" height="90" fill={`url(#${id})`} />
      <path d={d} stroke="#00B86B" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="195" cy={endY} r="3.5" fill="#008F4F" />
    </svg>
  );
}
