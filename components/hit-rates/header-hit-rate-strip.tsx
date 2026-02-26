"use client";

import { cn } from "@/lib/utils";

export type HeaderGameCountFilter = 5 | 10 | 20 | "season" | "h2h";

export interface HeaderHitRateStripItem {
  label: string;
  value: number | null;
  count: HeaderGameCountFilter;
}

interface HeaderHitRateStripProps {
  items: HeaderHitRateStripItem[];
  selected: HeaderGameCountFilter;
  onSelect: (count: HeaderGameCountFilter) => void;
}

function getTone(value: number | null): "emerald" | "amber" | "red" | "neutral" {
  if (value === null) return "neutral";
  if (value >= 70) return "emerald";
  if (value >= 50) return "amber";
  return "red";
}

export function HeaderHitRateStrip({ items, selected, onSelect }: HeaderHitRateStripProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100/50 dark:bg-neutral-800/30">
      {items.map((stat) => {
        const isSelected = selected === stat.count;
        const tone = getTone(stat.value);
        return (
          <button
            key={stat.label}
            type="button"
            onClick={() => onSelect(stat.count)}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold",
              isSelected
                ? "bg-white dark:bg-neutral-800 shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
                : "hover:bg-white/50 dark:hover:bg-neutral-800/50"
            )}
          >
            <span
              className={cn(
                "font-bold tabular-nums tracking-tight",
                isSelected ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-500"
              )}
            >
              {stat.label}
            </span>
            <span
              className={cn(
                "font-bold tabular-nums",
                tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
                tone === "amber" && "text-amber-600 dark:text-amber-400",
                tone === "red" && "text-red-500 dark:text-red-400",
                tone === "neutral" && "text-neutral-400 dark:text-neutral-500"
              )}
            >
              {stat.value != null ? `${stat.value.toFixed(0)}%` : "-"}
            </span>
            {isSelected && (
              <div
                className={cn(
                  "absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full",
                  tone === "emerald" && "bg-emerald-500",
                  tone === "amber" && "bg-amber-500",
                  tone === "red" && "bg-red-500",
                  tone === "neutral" && "bg-neutral-400"
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
