"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatOdds, computeSummaryStats, relativeTime } from "@/lib/line-history/utils";
import type { LineHistoryBookData } from "@/lib/odds/line-history";

interface SummaryStatsProps {
  bookData: LineHistoryBookData | undefined;
  isMobile: boolean;
}

export function SummaryStats({ bookData, isMobile }: SummaryStatsProps) {
  const stats = useMemo(() => {
    if (!bookData?.entries?.length) return null;
    return computeSummaryStats(bookData.entries);
  }, [bookData]);

  if (!stats) return null;

  const changeColor =
    stats.impliedProbChange === 0
      ? "text-neutral-400"
      : stats.impliedProbChange > 0
        ? "text-rose-500 dark:text-rose-400"
        : "text-emerald-500 dark:text-emerald-400";

  const changeSign = stats.impliedProbChange > 0 ? "+" : "";

  const cells = [
    { label: "Open", value: formatOdds(stats.openPrice) },
    { label: "High", value: formatOdds(stats.highPrice), sub: relativeTime(stats.highTimestamp) },
    { label: "Low", value: formatOdds(stats.lowPrice), sub: relativeTime(stats.lowTimestamp) },
    { label: "Current", value: formatOdds(stats.currentPrice) },
    {
      label: "% Change",
      value: `${changeSign}${stats.impliedProbChange.toFixed(1)}%`,
      className: changeColor,
    },
    { label: "Moves", value: String(stats.lineMovesCount) },
  ];

  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200/70 dark:border-neutral-800/70 bg-white/50 dark:bg-neutral-900/30 px-2.5 py-2",
        isMobile ? "grid grid-cols-3 gap-x-3 gap-y-1.5" : "grid grid-cols-6 gap-3"
      )}
    >
      {cells.map((cell) => (
        <div key={cell.label}>
          <p className="text-[9px] text-neutral-500 uppercase tracking-wide font-medium">{cell.label}</p>
          <p className={cn("text-[13px] font-bold tabular-nums", cell.className)}>
            {cell.value}
          </p>
          {cell.sub && <p className="text-[9px] text-neutral-500">{cell.sub}</p>}
        </div>
      ))}
    </div>
  );
}
