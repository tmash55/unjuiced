"use client";

import { cn } from "@/lib/utils";
import { TIME_RANGES, type TimeRangeKey } from "@/lib/line-history/types";

interface TimeRangeSelectorProps {
  value: TimeRangeKey;
  onChange: (v: TimeRangeKey) => void;
  className?: string;
}

export function TimeRangeSelector({ value, onChange, className }: TimeRangeSelectorProps) {
  return (
    <div className={cn("inline-flex rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/85 dark:bg-white/[0.05] p-1 shadow-sm", className)}>
      {TIME_RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          className={cn(
            "px-3 py-1.5 text-[11px] font-semibold rounded-xl transition-all",
            r.key === value
              ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
