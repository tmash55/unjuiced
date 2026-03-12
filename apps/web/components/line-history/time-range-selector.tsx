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
    <div className={cn("inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700/80 overflow-hidden", className)}>
      {TIME_RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          className={cn(
            "px-3 py-1 text-[11px] font-semibold transition-colors",
            r.key === value
              ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
              : "bg-white dark:bg-neutral-800/60 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
