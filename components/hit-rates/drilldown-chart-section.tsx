"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { HeaderGameCountFilter } from "@/components/hit-rates/header-hit-rate-strip";

interface DrilldownChartStats {
  hitRate: number | null;
  hits: number;
  total: number;
  avg: number | null;
}

interface DrilldownChartSectionProps {
  gameCount: HeaderGameCountFilter;
  onGameCountChange: (count: HeaderGameCountFilter) => void;
  totalGamesAvailable: number;
  chartStats: DrilldownChartStats;
  activeLine: number | null;
  children: ReactNode;
  rightActions?: ReactNode;
}

export function DrilldownChartSection({
  gameCount,
  onGameCountChange,
  totalGamesAvailable,
  chartStats,
  activeLine,
  children,
  rightActions,
}: DrilldownChartSectionProps) {
  return (
    <div className="rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5">
      <div className="px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-r from-neutral-50/50 to-white dark:from-neutral-800/50 dark:to-neutral-900">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
              {([5, 10, 20, "season"] as HeaderGameCountFilter[]).map((count) => {
                const numericCount = count === "season" ? totalGamesAvailable : (typeof count === "number" ? count : 0);
                const isDisabled = numericCount > totalGamesAvailable;
                const displayCount = count === "season" ? "All" : `L${count}`;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => !isDisabled && onGameCountChange(count)}
                    disabled={isDisabled}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                      gameCount === count
                        ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                        : isDisabled
                          ? "text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    {displayCount}
                  </button>
                );
              })}
            </div>

            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700" />

            <div
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl",
                chartStats.hitRate !== null && chartStats.hitRate >= 70
                  ? "bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200/50 dark:ring-emerald-700/30"
                  : chartStats.hitRate !== null && chartStats.hitRate >= 50
                    ? "bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200/50 dark:ring-amber-700/30"
                    : chartStats.hitRate !== null
                      ? "bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200/50 dark:ring-red-700/30"
                      : "bg-neutral-50 dark:bg-neutral-800 ring-1 ring-neutral-200/50 dark:ring-neutral-700/30"
              )}
            >
              <span
                className={cn(
                  "text-2xl font-black tabular-nums tracking-tight",
                  chartStats.hitRate !== null
                    ? chartStats.hitRate >= 70
                      ? "text-emerald-600 dark:text-emerald-400"
                      : chartStats.hitRate >= 50
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-500 dark:text-red-400"
                    : "text-neutral-400"
                )}
              >
                {chartStats.hitRate !== null ? `${chartStats.hitRate}%` : "—"}
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Hit Rate
                </span>
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums">
                  {chartStats.hits}/{chartStats.total} games
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 ring-1 ring-neutral-200/50 dark:ring-neutral-700/30">
              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Avg</span>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums",
                  chartStats.avg !== null && activeLine !== null && chartStats.avg > activeLine
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-neutral-700 dark:text-neutral-300"
                )}
              >
                {chartStats.avg?.toFixed(1) ?? "—"}
              </span>
            </div>
          </div>

          {rightActions ? <div className="flex items-center gap-2" data-hide-on-capture>{rightActions}</div> : null}
        </div>
      </div>

      <div className="p-5">{children}</div>
    </div>
  );
}

