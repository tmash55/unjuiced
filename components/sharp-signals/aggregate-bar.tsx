"use client";

import { cn } from "@/lib/utils";

interface AggregateBarProps {
  yesPercent: number;
  className?: string;
}

/**
 * Simple YES/NO aggregate bar showing market sentiment
 */
export function AggregateBar({ yesPercent, className }: AggregateBarProps) {
  const noPercent = 100 - yesPercent;
  return (
    <div className={cn("flex items-center gap-1.5 text-[10px]", className)}>
      <span className="text-emerald-400 font-medium">{yesPercent.toFixed(0)}%</span>
      <div className="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${yesPercent}%` }}
        />
      </div>
      <span className="text-red-400 font-medium">{noPercent.toFixed(0)}%</span>
    </div>
  );
}
