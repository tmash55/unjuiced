"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { calculateKelly } from "@/lib/polymarket/kelly";

export function KellySizer({
  polyImplied,
  bookImplied,
  compact = false,
  className,
}: {
  polyImplied: number;
  bookImplied: number;
  compact?: boolean;
  className?: string;
}) {
  const [fraction, setFraction] = useState(0.5);
  const result = calculateKelly({ polyImplied, bookImplied, fraction });

  if (!result.hasEdge) {
    if (compact) return null;
    return (
      <div className={cn("text-xs text-neutral-500", className)}>
        No edge detected
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs", className)}>
        <span className="text-emerald-400 font-semibold">
          {(result.edge * 100).toFixed(1)}% edge
        </span>
        <span className="text-neutral-600">·</span>
        <span className="text-amber-400 font-semibold">{result.units}u</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-emerald-400 font-semibold">
          Edge: {(result.edge * 100).toFixed(1)}%
        </span>
        <span className="text-neutral-500">|</span>
        <span className="text-amber-400 font-semibold">
          {result.units}u
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0.25}
          max={1}
          step={0.25}
          value={fraction}
          onChange={(e) => setFraction(parseFloat(e.target.value))}
          className="w-20 h-1 accent-sky-500"
        />
        <span className="text-[10px] text-neutral-500">
          {fraction === 1 ? "Full" : fraction === 0.5 ? "Half" : `${fraction * 100}%`} Kelly
        </span>
      </div>
    </div>
  );
}
