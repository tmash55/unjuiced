"use client";

import { cn } from "@/lib/utils";

interface BasesDiamondProps {
  runners: { first: boolean; second: boolean; third: boolean };
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { container: "w-6 h-6", diamond: 7, viewBox: "0 0 40 40" },
  md: { container: "w-9 h-9", diamond: 10, viewBox: "0 0 40 40" },
  lg: { container: "w-12 h-12", diamond: 12, viewBox: "0 0 40 40" },
} as const;

export function BasesDiamond({ runners, size = "md", className }: BasesDiamondProps) {
  const s = SIZE_MAP[size];
  const d = s.diamond;

  // Positions: second=top-center, third=center-left, first=center-right
  const bases = [
    { key: "second", cx: 20, cy: 8, active: runners.second },
    { key: "third", cx: 8, cy: 20, active: runners.third },
    { key: "first", cx: 32, cy: 20, active: runners.first },
  ];

  return (
    <svg
      viewBox={s.viewBox}
      className={cn(s.container, "shrink-0", className)}
      aria-label={`Bases: ${runners.first ? "1st" : ""}${runners.second ? " 2nd" : ""}${runners.third ? " 3rd" : ""}${!runners.first && !runners.second && !runners.third ? "empty" : ""}`}
    >
      {bases.map((base) => (
        <rect
          key={base.key}
          x={base.cx - d / 2}
          y={base.cy - d / 2}
          width={d}
          height={d}
          rx={1}
          transform={`rotate(45 ${base.cx} ${base.cy})`}
          className={cn(
            base.active
              ? "fill-amber-400 stroke-amber-500 dark:fill-amber-400 dark:stroke-amber-500"
              : "fill-transparent stroke-neutral-400 dark:stroke-neutral-600"
          )}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
